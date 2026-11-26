/**
 * Sequentially generate + enrich ASPIRE lesson plans for Digital Technologies
 * and Design Technologies units (not Manual Arts).
 *
 * First week: Standard, 120s per generate model (find who answers).
 * Later weeks: Flex 10 min on the last success; 120s Standard probes on better models.
 * 503/timeout: 15 min cooldown (not all-day). Daily quota (PerDay 429) lasts until Pacific midnight.
 * Per-minute 429: wait the server's retry delay and retry the same model. Calls are paced
 * --pace-sec apart (default 4) per model per key.
 * GEMINI_API_KEY2 (optional second account): same model is retried on the other key before falling down.
 * Upgrade: regenerate on 3.8 → 3.7; re-enrich regenerated weeks with Flash-Lite (never enrich on 3.8).
 * Enrich stays Standard (one activity per call) — never Flex.
 * UI Generate stays Standard.
 *
 *   npm run lessons:batch
 *   npm run lessons:batch:status
 *   npm run lessons:batch -- --dry-run
 *   npm run lessons:batch:wait
 *   npm run lessons:batch:upgrade
 *   npm run lessons:batch:upgrade:wait
 *   npm run lessons:batch -- --unit unit-7-1-digital-literacy
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { LESSONS_PER_WEEK } from '$lib/defaults';
import {
	ENRICH_ACTIVITY_TIMEOUT_MS,
	ENRICH_MODEL_CASCADE,
	FLEX_REQUEST_TIMEOUT_MS,
	LESSON_REQUEST_TIMEOUT_MS,
	MODEL_CASCADE,
	type CascadeModel
} from '$lib/gemini-models';
import { saveUnitPlan } from '$lib/server/data';
import { generateWeekLessons } from '$lib/server/generate-lessons';
import {
	CascadeExhaustedError,
	configureRatePacing,
	geminiAccountCount,
	isQuotaError,
	isShortRateLimit,
	isTransientError,
	rateLimitDelayMs
} from '$lib/server/gemini';
import type { UnitPlan } from '$lib/types';
import {
	listTargetUnits,
	unitKey,
	weekHasDetail,
	weekNumberOf,
	weekRequest
} from './lesson-batch-shared';

const ROOT = process.cwd();
const PROGRESS_PATH = path.join(ROOT, 'data', 'lesson-batch-progress.json');
const BATCH_MODELS = MODEL_CASCADE.map((model) => ({ id: model.id, label: model.label }));
const ENRICH_MODELS = ENRICH_MODEL_CASCADE.map((model) => ({ id: model.id, label: model.label }));
const ENRICH_IDS = new Set(ENRICH_MODELS.map((model) => model.id));
/** Upgrade generate — top two Flash models only (enrich stays Flash-Lite). */
const UPGRADE_GENERATE_MODELS = BATCH_MODELS.slice(0, 2);
const UPGRADE_GENERATE_IDS = new Set(UPGRADE_GENERATE_MODELS.map((model) => model.id));
/** 503 / timeout benches a model briefly; quota still lasts until Pacific midnight. */
const BUSY_COOLDOWN_MS = 15 * 60_000;

type WeekStep = 'pending' | 'done' | 'skipped' | 'error';

interface WeekProgress {
	generate: WeekStep;
	enrich: WeekStep;
	generateModel?: string;
	enrichModel?: string;
	error?: string;
}

interface UnitProgress {
	title: string;
	levelPlanId: string;
	weeks: Record<string, WeekProgress>;
}

interface ProgressFile {
	version: 1;
	updatedAt: string;
	stoppedReason?: string;
	/** Pacific date (YYYY-MM-DD) the exhausted-model list belongs to. */
	quotaDate?: string;
	exhaustedModels?: string[];
	/** Epoch ms — 503/timeout cooldown (not quota). */
	unavailableUntil?: Record<string, number>;
	lastGenerateModel?: string;
	lastEnrichModel?: string;
	units: Record<string, UnitProgress>;
}

function argFlag(name: string): boolean {
	return process.argv.includes(`--${name}`);
}

function argValue(name: string): string | undefined {
	const idx = process.argv.indexOf(`--${name}`);
	if (idx < 0) return undefined;
	return process.argv[idx + 1];
}

function log(message: string) {
	const stamp = new Date().toISOString();
	console.log(`[${stamp}] ${message}`);
}

function pacificDate(): string {
	return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
}

function weekNeedsUpgrade(wp: WeekProgress): boolean {
	if (wp.generate === 'skipped') return false;
	if (wp.generate === 'error') return true;
	if (wp.generate !== 'done') return false;
	// Upgrade is about generate quality (3.8 / 3.7). Enrich stays on Flash-Lite.
	return !wp.generateModel || !UPGRADE_GENERATE_IDS.has(wp.generateModel);
}

async function loadProgress(): Promise<ProgressFile> {
	try {
		const raw = await fs.readFile(PROGRESS_PATH, 'utf-8');
		return JSON.parse(raw) as ProgressFile;
	} catch {
		return { version: 1, updatedAt: new Date().toISOString(), units: {} };
	}
}

async function saveProgress(progress: ProgressFile) {
	progress.updatedAt = new Date().toISOString();
	await fs.mkdir(path.dirname(PROGRESS_PATH), { recursive: true });
	await fs.writeFile(PROGRESS_PATH, JSON.stringify(progress, null, 2), 'utf-8');
}

function errorMessage(error: unknown): string {
	if (error instanceof Error) return error.message;
	return String(error);
}

function isParseError(error: unknown): boolean {
	return /JSON|parse activity|parse lesson|unparseable/i.test(errorMessage(error));
}

function isSkipWeekError(error: unknown): boolean {
	return /existingLessons|produced no lessons|Enrich mode requires|not found/i.test(
		errorMessage(error)
	);
}

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureUnitProgress(progress: ProgressFile, plan: UnitPlan): UnitProgress {
	const key = unitKey(plan.levelPlanId, plan.id);
	if (!progress.units[key]) {
		progress.units[key] = {
			title: String(plan.unitTitle.value),
			levelPlanId: plan.levelPlanId,
			weeks: {}
		};
	}
	progress.units[key].title = String(plan.unitTitle.value);
	return progress.units[key];
}

function weekProgress(entry: UnitProgress, weekNumber: number): WeekProgress {
	const id = String(weekNumber);
	if (!entry.weeks[id]) {
		entry.weeks[id] = { generate: 'pending', enrich: 'pending' };
	}
	return entry.weeks[id];
}

async function generateWeek(
	plan: UnitPlan,
	weekNumber: number,
	mode: 'generate' | 'enrich',
	models?: CascadeModel[]
) {
	return generateWeekLessons(weekRequest(plan, weekNumber, mode, models));
}

function resetDailyQuota(progress: ProgressFile) {
	const today = pacificDate();
	if (progress.quotaDate !== today) {
		progress.quotaDate = today;
		progress.exhaustedModels = [];
		progress.stoppedReason = undefined;
	}
}

function modelIsOnCooldown(progress: ProgressFile, modelId: string): boolean {
	const until = progress.unavailableUntil?.[modelId];
	return typeof until === 'number' && until > Date.now();
}

function pruneCooldowns(progress: ProgressFile) {
	const until = progress.unavailableUntil ?? {};
	const next: Record<string, number> = {};
	const now = Date.now();
	for (const [id, stamp] of Object.entries(until)) {
		if (stamp > now) next[id] = stamp;
	}
	progress.unavailableUntil = next;
}

function markCooldown(progress: ProgressFile, modelId: string, ms = BUSY_COOLDOWN_MS) {
	progress.unavailableUntil = {
		...(progress.unavailableUntil ?? {}),
		[modelId]: Date.now() + ms
	};
}

/** Per-minute 429 → bench for the server's retry delay; 503/timeout → 15 min. */
function cooldownMsFor(errorText: string): number {
	const error = new Error(errorText);
	return isShortRateLimit(error) ? Math.max(30_000, rateLimitDelayMs(error)) : BUSY_COOLDOWN_MS;
}

function formatWait(ms: number): string {
	return ms >= 120_000 ? `${Math.round(ms / 60_000)} min` : `${Math.round(ms / 1000)}s`;
}

/** A 429 without a daily marker that never clears is treated as a daily cap. */
const RATE_LIMIT_STRIKES_TO_DAILY = 4;
const rateLimitStrikes = new Map<string, number>();

function soonestCooldownMs(progress: ProgressFile): number | undefined {
	const stamps = Object.values(progress.unavailableUntil ?? {}).filter((stamp) => stamp > Date.now());
	if (!stamps.length) return undefined;
	return Math.max(5_000, Math.min(...stamps) - Date.now());
}

function describeCascade(models: CascadeModel[]): string {
	return models
		.map((model) => {
			const secs = Math.round((model.timeoutMs ?? LESSON_REQUEST_TIMEOUT_MS) / 1000);
			const tier = model.serviceTier === 'flex' ? ' flex' : '';
			return `${model.id} (${secs}s${tier})`;
		})
		.join(' → ');
}

function availableFrom(
	list: { id: string; label: string }[],
	progress: ProgressFile
): { id: string; label: string }[] {
	pruneCooldowns(progress);
	const exhausted = new Set(progress.exhaustedModels ?? []);
	return list.filter((model) => !exhausted.has(model.id) && !modelIsOnCooldown(progress, model.id));
}

function allQuotaExhausted(list: { id: string }[], progress: ProgressFile): boolean {
	const exhausted = new Set(progress.exhaustedModels ?? []);
	return list.length > 0 && list.every((model) => exhausted.has(model.id));
}

function remainingGenerateModels(progress: ProgressFile, upgrade: boolean): CascadeModel[] {
	if (upgrade) {
		const available = availableFrom(UPGRADE_GENERATE_MODELS, progress);
		const lastId = progress.lastGenerateModel;
		const last = lastId ? available.find((model) => model.id === lastId) : undefined;
		const asStandard = (model: { id: string; label: string }): CascadeModel => ({
			...model,
			timeoutMs: LESSON_REQUEST_TIMEOUT_MS
		});
		if (!last) {
			// First contact: Standard probes on both; prefer 3.8 then 3.7.
			return available.map(asStandard);
		}
		const lastIdx = UPGRADE_GENERATE_MODELS.findIndex((model) => model.id === last.id);
		const better = available.filter(
			(model) => UPGRADE_GENERATE_MODELS.findIndex((item) => item.id === model.id) < lastIdx
		);
		const worse = available.filter(
			(model) =>
				model.id !== last.id &&
				UPGRADE_GENERATE_MODELS.findIndex((item) => item.id === model.id) > lastIdx
		);
		return [
			...better.map(asStandard),
			{ ...last, timeoutMs: FLEX_REQUEST_TIMEOUT_MS, serviceTier: 'flex' },
			...worse.map(asStandard)
		];
	}
	const available = availableFrom(BATCH_MODELS, progress);
	const lastId = progress.lastGenerateModel;
	const last = lastId ? available.find((model) => model.id === lastId) : undefined;
	const asStandard = (model: { id: string; label: string }): CascadeModel => ({
		...model,
		timeoutMs: LESSON_REQUEST_TIMEOUT_MS
	});
	if (!last) return available.map(asStandard);
	const lastIdx = BATCH_MODELS.findIndex((model) => model.id === last.id);
	const better = available.filter(
		(model) => BATCH_MODELS.findIndex((item) => item.id === model.id) < lastIdx
	);
	const worse = available.filter(
		(model) =>
			model.id !== last.id && BATCH_MODELS.findIndex((item) => item.id === model.id) > lastIdx
	);
	return [
		...better.map(asStandard),
		{ ...last, timeoutMs: FLEX_REQUEST_TIMEOUT_MS, serviceTier: 'flex' },
		...worse.map(asStandard)
	];
}

function currentEnrichModels(progress: ProgressFile, _upgrade = false): CascadeModel[] {
	// Upgrade and normal batch both enrich with Flash-Lite (never spend 3.8 on enrich).
	const available = availableFrom(ENRICH_MODELS, progress);
	const lastId = progress.lastEnrichModel;
	const last = lastId ? available.find((model) => model.id === lastId) : undefined;
	const asStandard = (model: { id: string; label: string }): CascadeModel => ({
		...model,
		timeoutMs: ENRICH_ACTIVITY_TIMEOUT_MS
	});
	if (!last) return available.map(asStandard);
	const lastIdx = ENRICH_MODELS.findIndex((model) => model.id === last.id);
	const better = available.filter(
		(model) => ENRICH_MODELS.findIndex((item) => item.id === model.id) < lastIdx
	);
	const worse = available.filter(
		(model) =>
			model.id !== last.id && ENRICH_MODELS.findIndex((item) => item.id === model.id) > lastIdx
	);
	return [...better.map(asStandard), asStandard(last), ...worse.map(asStandard)];
}

function markExhausted(progress: ProgressFile, modelId: string) {
	progress.quotaDate = pacificDate();
	progress.exhaustedModels = [...new Set([...(progress.exhaustedModels ?? []), modelId])];
}

/** Bench a model after a failed attempt; escalates repeated per-minute 429s to a daily skip. */
function benchModel(progress: ProgressFile, modelId: string, label: string, errorText: string) {
	const error = new Error(errorText);
	if (isQuotaError(error)) {
		markExhausted(progress, modelId);
		log(`  Skipping ${label} for the rest of today (daily quota: ${errorText})`);
		return;
	}
	if (isShortRateLimit(error)) {
		const strikes = (rateLimitStrikes.get(modelId) ?? 0) + 1;
		rateLimitStrikes.set(modelId, strikes);
		if (strikes >= RATE_LIMIT_STRIKES_TO_DAILY) {
			markExhausted(progress, modelId);
			log(
				`  ${label} hit "too many requests" ${strikes} times in a row — treating as daily quota (${errorText})`
			);
			return;
		}
	}
	const ms = cooldownMsFor(errorText);
	markCooldown(progress, modelId, ms);
	log(`  Cooling ${label} for ${formatWait(ms)} (${errorText})`);
}

async function main() {
	const dryRun = argFlag('dry-run');
	const statusOnly = argFlag('status');
	const wait = argFlag('wait');
	const force = argFlag('force');
	const upgrade = argFlag('upgrade');
	const onlyUnit = argValue('unit');
	const sleepMin = Number(argValue('sleep-min') || 30);
	const sleepMs = Math.max(5, Number.isFinite(sleepMin) ? sleepMin : 30) * 60_000;
	const paceSec = Number(argValue('pace-sec') ?? 4);
	const paceMs = Math.max(0, Number.isFinite(paceSec) ? paceSec : 4) * 1000;
	configureRatePacing({
		minIntervalMs: paceMs,
		rateLimitWaitMaxMs: 120_000,
		rateLimitRounds: 3,
		onRateLimitWait: (model, waitMs, round) =>
			log(`  ${model}: too many requests on every key (per-minute limit). Waiting ${formatWait(waitMs)} then retrying (${round}/3)…`)
	});

	const progress = await loadProgress();
	resetDailyQuota(progress);
	if (progress.exhaustedModels?.length && !Object.keys(progress.unavailableUntil ?? {}).length) {
		for (const id of progress.exhaustedModels) markCooldown(progress, id);
		log(
			`Converted leftover all-day skips (${progress.exhaustedModels.join(', ')}) into 15 min cooldowns.`
		);
		progress.exhaustedModels = [];
	}
	const units = await listTargetUnits();
	const filtered = onlyUnit ? units.filter((plan) => plan.id === onlyUnit) : units;

	if (onlyUnit && !filtered.length) {
		throw new Error(`No Digital/Design Technologies unit found with id ${onlyUnit}`);
	}

	log(
		`API accounts: ${geminiAccountCount()}. Pacing: ${paceMs / 1000}s between calls per model per key (--pace-sec); per-minute 429s wait and retry, daily 429s skip the model until Pacific midnight. Generate: ${BATCH_MODELS.map((m) => m.id).join(' → ')}. First week Standard ${LESSON_REQUEST_TIMEOUT_MS / 1000}s; later weeks Flex ${FLEX_REQUEST_TIMEOUT_MS / 60000} min on last success. Enrich: ${ENRICH_MODELS.map((m) => m.id).join(' → ')} Standard ${ENRICH_ACTIVITY_TIMEOUT_MS / 1000}s/activity. Units: ${filtered.length}. Progress: ${PROGRESS_PATH}`
	);

	let pendingGenerate = 0;
	let pendingEnrich = 0;
	let doneBest = 0;
	let doneNeedsUpgrade = 0;

	for (const plan of filtered) {
		const entry = ensureUnitProgress(progress, plan);
		const liveWeeks = new Set(plan.teachingSequence.map((week) => String(weekNumberOf(week))));
		for (const id of Object.keys(entry.weeks)) {
			if (!liveWeeks.has(id)) delete entry.weeks[id];
		}
		for (const week of plan.teachingSequence) {
			const weekNumber = weekNumberOf(week);
			if (Number.isNaN(weekNumber) || weekNumber <= 0) continue;
			if (!weekHasDetail(week)) {
				const wp = weekProgress(entry, weekNumber);
				wp.generate = 'skipped';
				wp.enrich = 'skipped';
				continue;
			}
			const wp = weekProgress(entry, weekNumber);
			const hasLessons = (week.lessons?.length ?? 0) >= LESSONS_PER_WEEK;
			if (force && !upgrade) {
				wp.generate = 'pending';
				wp.enrich = 'pending';
				delete wp.generateModel;
				delete wp.enrichModel;
				delete wp.error;
			} else {
				const lessonModel = week.lessons?.find((lesson) => lesson.generatedWith)?.generatedWith;
				if (hasLessons && lessonModel && wp.generateModel && lessonModel !== wp.generateModel) {
					// Regenerated outside this batch (UI or lessons:agent import) — needs a fresh enrich.
					wp.generate = 'done';
					wp.generateModel = lessonModel;
					delete wp.error;
					if (!week.lessons?.every((lesson) => lesson.enrichedWith)) {
						wp.enrich = 'pending';
						delete wp.enrichModel;
					}
				} else if (hasLessons && wp.generate !== 'done') {
					wp.generate = 'done';
				}
			}
			if (!wp.generateModel) {
				wp.generateModel = week.lessons?.find((lesson) => lesson.generatedWith)?.generatedWith;
			}
			if (
				hasLessons &&
				wp.generate === 'done' &&
				wp.enrich !== 'done' &&
				week.lessons?.every((lesson) => lesson.enrichedWith)
			) {
				// Enriched outside this batch (UI or lessons:agent enrich-import).
				wp.enrich = 'done';
				wp.enrichModel = week.lessons[0].enrichedWith;
			}
			if (!wp.enrichModel) {
				wp.enrichModel = week.lessons?.find((lesson) => lesson.enrichedWith)?.enrichedWith;
			}
			const treatAsPendingUpgrade = upgrade && weekNeedsUpgrade(wp);
			if (wp.generate !== 'done' || treatAsPendingUpgrade) pendingGenerate += 1;
			else if (wp.enrich !== 'done') pendingEnrich += 1;
			else if (weekNeedsUpgrade(wp)) doneNeedsUpgrade += 1;
			else doneBest += 1;
		}
	}

	if (!progress.lastGenerateModel) {
		const ids = Object.values(progress.units).flatMap((entry) =>
			Object.values(entry.weeks)
				.map((wp) => wp.generateModel)
				.filter((id): id is string => Boolean(id))
		);
		progress.lastGenerateModel = ids.at(-1);
	}
	if (!progress.lastEnrichModel) {
		const ids = Object.values(progress.units).flatMap((entry) =>
			Object.values(entry.weeks)
				.map((wp) => wp.enrichModel)
				.filter((id): id is string => Boolean(id))
		);
		progress.lastEnrichModel = ids.at(-1);
	}

	await saveProgress(progress);

	if (statusOnly || dryRun) {
		log(
			`Done on 3.8/3.7: ${doneBest}. Done on older models (upgrade later): ${doneNeedsUpgrade}. Need generate: ${pendingGenerate}. Need enrich: ${pendingEnrich}.`
		);
		if (progress.exhaustedModels?.length) {
			log(`Quota used today (Pacific): ${progress.exhaustedModels.join(', ')}`);
		}
		if (progress.lastGenerateModel) log(`Last generate success: ${progress.lastGenerateModel}`);
		if (progress.lastEnrichModel) log(`Last enrich success: ${progress.lastEnrichModel}`);
		pruneCooldowns(progress);
		const cooling = Object.entries(progress.unavailableUntil ?? {})
			.filter(([, stamp]) => stamp > Date.now())
			.map(([id, stamp]) => `${id} (${Math.ceil((stamp - Date.now()) / 60000)} min)`);
		if (cooling.length) log(`Busy cooldown: ${cooling.join(', ')}`);
		for (const plan of filtered) {
			const entry = progress.units[unitKey(plan.levelPlanId, plan.id)];
			const open = Object.entries(entry?.weeks ?? {}).filter(([, wp]) => {
				if (upgrade) return weekNeedsUpgrade(wp) || wp.generate !== 'done' || wp.enrich !== 'done';
				return wp.generate !== 'done' || wp.enrich !== 'done';
			});
			if (!open.length) continue;
			log(
				`${plan.levelPlanId} / ${String(plan.unitTitle.value)} (${plan.id}): ${open
					.map(([n, wp]) => {
						const models = [wp.generateModel, wp.enrichModel].filter(Boolean).join('/');
						const upgradeMark = weekNeedsUpgrade(wp) ? ' upgrade' : '';
						return `w${n} gen=${wp.generate} enr=${wp.enrich}${models ? ` ${models}` : ''}${upgradeMark}`;
					})
					.join(', ')}`
			);
		}
		if (!upgrade && doneNeedsUpgrade) {
			log('When 3.8/3.7 are available again, run: npm run lessons:batch:upgrade:wait');
		}
		return;
	}

	if (upgrade) {
		log(
			`Upgrade mode: regenerate older-model weeks on ${UPGRADE_GENERATE_MODELS.map((m) => m.id).join(' → ')}; re-enrich those weeks with Flash-Lite${wait ? ' (wait until done)' : ''}.`
		);
	}

	let pass = 0;
	work: for (;;) {
		pass += 1;
		if (wait && upgrade && pass > 1) {
			log(
				`Upgrade pass ${pass}: retrying remaining weeks on ${UPGRADE_GENERATE_MODELS.map((m) => m.id).join(' → ')}…`
			);
		}

	for (const plan of filtered) {
		const entry = ensureUnitProgress(progress, plan);
		log(`Unit: ${String(plan.unitTitle.value)} (${plan.levelPlanId}/${plan.id})`);

		for (const week of plan.teachingSequence) {
			const weekNumber = weekNumberOf(week);
			if (Number.isNaN(weekNumber) || weekNumber <= 0) continue;
			const wp = weekProgress(entry, weekNumber);
			if (wp.generate === 'skipped') continue;

			const wantsWork = upgrade
				? weekNeedsUpgrade(wp) || wp.generate !== 'done' || wp.enrich !== 'done'
				: wp.generate !== 'done' || wp.enrich !== 'done';
			if (!wantsWork) continue;
			if (upgrade && weekNeedsUpgrade(wp)) {
				// Regenerate on 3.8/3.7, then always re-enrich with Flash-Lite.
				wp.generate = 'pending';
				wp.enrich = 'pending';
				delete wp.error;
			}

			const runStep = async (mode: 'generate' | 'enrich'): Promise<'quota' | void> => {
				let busyAttempt = 0;
				for (;;) {
					const models =
						mode === 'enrich'
							? currentEnrichModels(progress, upgrade)
							: remainingGenerateModels(progress, upgrade);
					if (!models.length) {
						const cooldownWait = soonestCooldownMs(progress);
						const quotaPool =
							mode === 'enrich'
								? ENRICH_MODELS
								: upgrade
									? UPGRADE_GENERATE_MODELS
									: BATCH_MODELS;
						const quotaAll = allQuotaExhausted(quotaPool, progress);
						if (cooldownWait && !quotaAll) {
							if (!wait) {
								log(
									'Remaining models are cooling down (15 min). Progress saved. Rerun later, or use --wait.'
								);
								process.exitCode = 0;
								return 'quota';
							}
							log(
								`All remaining models cooling down. Sleeping ${Math.ceil(cooldownWait / 60000)} min then retrying…`
							);
							await sleep(cooldownWait);
							continue;
						}
						progress.stoppedReason = 'quota';
						await saveProgress(progress);
						if (!wait) {
							log(
								mode === 'enrich'
									? 'Flash-Lite quota is gone. Progress saved. Rerun later, or use --wait.'
									: 'All generate models are exhausted. Progress saved. Rerun later, or use --wait.'
							);
							process.exitCode = 0;
							return 'quota';
						}
						if (mode === 'enrich') {
							log(
								`Flash-Lite exhausted. Sleeping ${sleepMs / 60000} minutes then retrying enrich…`
							);
							await sleep(sleepMs);
							progress.exhaustedModels = (progress.exhaustedModels ?? []).filter(
								(id) => !ENRICH_IDS.has(id)
							);
						} else {
							log(
								`All generate models exhausted. Sleeping ${sleepMs / 60000} minutes then retrying from 3.8…`
							);
							await sleep(sleepMs);
							progress.quotaDate = pacificDate();
							progress.exhaustedModels = [];
						}
						progress.stoppedReason = undefined;
						await saveProgress(progress);
						continue;
					}

					const modelLabel = describeCascade(models);
					if (mode === 'enrich' && (week.lessons?.length ?? 0) === 0) {
						log(`  Week ${weekNumber} enrich skipped (generate has no lessons).`);
						return;
					}
					try {
						log(
							mode === 'enrich'
								? `  Week ${weekNumber} enrich with ${modelLabel} (one activity at a time)…`
								: `  Week ${weekNumber} generate with ${modelLabel}…`
						);
						const result = await generateWeek(plan, weekNumber, mode, models);
						week.lessons = result.lessons;
						plan.teachingSequence = plan.teachingSequence.slice();
						await saveUnitPlan(plan);
						if (mode === 'generate') {
							wp.generate = 'done';
							wp.generateModel = result.model;
							progress.lastGenerateModel = result.model;
						} else {
							wp.enrich = 'done';
							wp.enrichModel = result.model;
							progress.lastEnrichModel = result.model;
						}
						delete wp.error;
						busyAttempt = 0;
						rateLimitStrikes.delete(result.model);
						const benched = new Set<string>();
						for (const attempt of result.attemptedModels ?? []) {
							if (!attempt.error) continue;
							if (attempt.model === result.model || benched.has(attempt.model)) continue;
							benched.add(attempt.model);
							benchModel(progress, attempt.model, attempt.label, attempt.error);
						}
						progress.stoppedReason = undefined;
						await saveProgress(progress);
						const account =
							result.apiAccount && geminiAccountCount() > 1 ? `, account ${result.apiAccount}` : '';
						log(`  Week ${weekNumber} ${mode} ok (${result.modelLabel}${account})`);
						return;
					} catch (error) {
						const message = errorMessage(error);
						const busyText = (text: string) => {
							const err = new Error(text);
							return (
								isQuotaError(err) ||
								isShortRateLimit(err) ||
								isTransientError(err) ||
								/503|unavailable|high demand|timed?\s*out|timeout|aborted|fetch failed|network/i.test(
									text
								)
							);
						};
						// Last error per model (a model may have failed on several keys / wait rounds).
						const lastByModel = new Map<string, { model: string; label: string; error: string }>();
						if (error instanceof CascadeExhaustedError) {
							for (const attempt of error.attemptedModels) {
								if (attempt.error) lastByModel.set(attempt.model, { ...attempt, error: attempt.error });
							}
						} else {
							for (const item of models) {
								lastByModel.set(item.id, { model: item.id, label: item.label, error: message });
							}
						}
						const failures = [...lastByModel.values()].filter((item) => busyText(item.error));
						const quota = failures.some((item) => isQuotaError(new Error(item.error)));
						const transient = failures.length > 0;
						wp.error = message;
						await saveProgress(progress);
						if (transient) {
							for (const item of failures) {
								benchModel(progress, item.model, item.label, item.error);
							}
							await saveProgress(progress);
						}
						if (quota) {
							busyAttempt = 0;
							log(`${modelLabel}: daily quota hit. Switching models if any remain.`);
							if (upgrade && !wait && mode === 'generate') {
								progress.stoppedReason = 'quota';
								await saveProgress(progress);
								log(
									'Upgrade stopped (3.8/3.7 unavailable). Remaining older-model weeks stay marked for later. Use npm run lessons:batch:upgrade:wait to keep retrying.'
								);
								process.exitCode = 0;
								return 'quota';
							}
							continue;
						}
						if (transient) {
							const failedIds = failures.map((item) => item.model);
							const remainingAfterSkip = availableFrom(
								mode === 'enrich'
									? ENRICH_MODELS
									: upgrade
										? UPGRADE_GENERATE_MODELS
										: BATCH_MODELS,
								progress
							);
							if (remainingAfterSkip.length) {
								log(
									`${failedIds.join(' / ') || modelLabel} unavailable (${message}). Trying remaining models now.`
								);
								continue;
							}
							busyAttempt += 1;
							const maxBusy = wait ? Number.POSITIVE_INFINITY : 3;
							if (busyAttempt > maxBusy) {
								if (upgrade) {
									progress.stoppedReason = 'quota';
									wp.generate = mode === 'generate' ? 'pending' : wp.generate;
									wp.enrich = mode === 'enrich' ? 'pending' : wp.enrich;
									await saveProgress(progress);
									log(
										`${modelLabel} still unavailable after retries. Progress saved. Use npm run lessons:batch:upgrade:wait to keep retrying.`
									);
									process.exitCode = 0;
									return 'quota';
								}
								wp.generate = mode === 'generate' ? 'error' : wp.generate;
								wp.enrich = mode === 'enrich' ? 'error' : wp.enrich;
								await saveProgress(progress);
								throw error;
							}
							const waitMs = soonestCooldownMs(progress) ?? BUSY_COOLDOWN_MS;
							log(
								`${modelLabel} unavailable (${message}). Sleeping ${Math.round(waitMs / 1000)}s then retrying…`
							);
							await sleep(waitMs);
							continue;
						}
						if (isParseError(error)) {
							wp.generate = mode === 'generate' ? 'error' : wp.generate;
							wp.enrich = mode === 'enrich' ? 'error' : wp.enrich;
							await saveProgress(progress);
							log(
								`  Week ${weekNumber} ${mode} JSON failed after retries (${message}). Skipping this week, continuing.`
							);
							return;
						}
						if (isSkipWeekError(error)) {
							if (mode === 'enrich') wp.enrich = 'pending';
							else wp.generate = 'error';
							await saveProgress(progress);
							log(`  Week ${weekNumber} ${mode} skipped (${message}). Continuing.`);
							return;
						}
						wp.generate = mode === 'generate' ? 'error' : wp.generate;
						wp.enrich = mode === 'enrich' ? 'error' : wp.enrich;
						await saveProgress(progress);
						throw error;
					}
				}
			};

			if (wp.generate !== 'done') {
				const stop = await runStep('generate');
				if (stop === 'quota') return;
			}
			if (wp.generate !== 'done') continue;
			if (wp.enrich !== 'done') {
				const stop = await runStep('enrich');
				if (stop === 'quota') return;
			}
		}
	}

		progress.stoppedReason = undefined;
		await saveProgress(progress);
		const leftover = Object.values(progress.units).reduce(
			(count, entry) => count + Object.values(entry.weeks).filter(weekNeedsUpgrade).length,
			0
		);
		if (leftover && wait && upgrade) {
			log(
				`Upgrade pass ${pass} finished with ${leftover} week(s) still not on 3.8/3.7. Sleeping ${sleepMs / 60000} minutes then scanning again…`
			);
			await sleep(sleepMs);
			continue work;
		}
		if (leftover) {
			log(
				`All pending generate/enrich jobs are done. ${leftover} week(s) still on older models — later run: npm run lessons:batch:upgrade:wait`
			);
		} else {
			log('All Digital/Design Technologies lesson generate+enrich jobs are done on 3.8/3.7.');
		}
		break;
	}
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
