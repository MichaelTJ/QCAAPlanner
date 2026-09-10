/**
 * Sequentially generate + enrich ASPIRE lesson plans for Digital Technologies
 * and Design Technologies units (not Manual Arts).
 *
 * Uses Gemini 3.8 Flash until that quota is gone, then Gemini 3.7 Flash.
 * Weeks finished on 3.7 are marked so you can later re-run them on 3.8.
 *
 *   npm run lessons:batch
 *   npm run lessons:batch:status
 *   npm run lessons:batch -- --dry-run
 *   npm run lessons:batch:wait
 *   npm run lessons:batch:upgrade
 *   npm run lessons:batch -- --unit unit-7-1-digital-literacy
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { STANDALONE_LEVEL_PLAN_ID, LESSONS_PER_WEEK } from '$lib/defaults';
import { BEST_FLASH_MODEL, MODEL_CASCADE } from '$lib/gemini-models';
import { getFacultyIndex, listUnitPlans, saveUnitPlan } from '$lib/server/data';
import { generateWeekLessons } from '$lib/server/generate-lessons';
import { CascadeExhaustedError, isQuotaError } from '$lib/server/gemini';
import type { LessonPlan, TeachingWeek, UnitPlan } from '$lib/types';

const ROOT = process.cwd();
const PROGRESS_PATH = path.join(ROOT, 'data', 'lesson-batch-progress.json');
const BATCH_MODELS = MODEL_CASCADE.map((model) => ({ id: model.id, label: model.label }));
const BEST_ID = BEST_FLASH_MODEL.id;

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
	if (wp.generate !== 'done' || wp.enrich !== 'done') return false;
	const models = [wp.generateModel, wp.enrichModel].filter(Boolean);
	if (!models.length) return false;
	return models.some((id) => id !== BEST_ID);
}

function unitKey(levelPlanId: string, unitId: string) {
	return `${levelPlanId}/${unitId}`;
}

function isDtSubject(value: string): boolean {
	const text = value.toLowerCase();
	if (text.includes('manual arts')) return false;
	return /digital\s+technolog/i.test(text) || /design\s+(and\s+)?technolog/i.test(text);
}

function weekNumberOf(week: TeachingWeek): number {
	return Number(week.week.value);
}

function weekHasDetail(week: TeachingWeek): boolean {
	return [
		week.keyTeachingExperiences?.value,
		week.theory?.value,
		week.prac?.value,
		week.assessment?.value,
		week.resources?.value
	].some((value) => String(value ?? '').trim() !== '');
}

function sortedLessons(week: TeachingWeek): LessonPlan[] {
	return [...(week.lessons ?? [])].sort((a, b) => a.lessonNumber - b.lessonNumber);
}

function unitSnapshot(plan: UnitPlan) {
	return {
		unitTitle: String(plan.unitTitle.value),
		description: String(plan.unitDescription.value),
		assessments: plan.assessments.map((assess) => ({
			title: String(assess.title.value),
			description: String(assess.description.value),
			timing: String(assess.timing.value),
			technique: String(assess.technique.value)
		}))
	};
}

function weekContext(week: TeachingWeek) {
	return {
		week: week.week.value,
		outlineTheme: String(week.outlineTheme?.value ?? ''),
		keyTeachingExperiences: String(week.keyTeachingExperiences?.value ?? ''),
		theory: String(week.theory.value),
		prac: String(week.prac.value),
		assessment: String(week.assessment.value),
		resources: String(week.resources.value)
	};
}

function collectPriorLessons(plan: UnitPlan, weekNumber: number) {
	const prior: Array<{
		week: number;
		lessonNumber: number;
		title: string;
		learningGoal: string;
	}> = [];
	for (const week of plan.teachingSequence) {
		const num = weekNumberOf(week);
		if (Number.isNaN(num) || num >= weekNumber) continue;
		for (const lesson of sortedLessons(week)) {
			prior.push({
				week: num,
				lessonNumber: lesson.lessonNumber,
				title: lesson.title,
				learningGoal: lesson.learningGoal
			});
		}
	}
	return prior;
}

function nextWeekOutlineTheme(plan: UnitPlan, weekNumber: number): string | undefined {
	const next = plan.teachingSequence.find((week) => weekNumberOf(week) === weekNumber + 1);
	const theme = String(next?.outlineTheme?.value ?? '').trim();
	return theme || undefined;
}

function findWeek(plan: UnitPlan, weekNumber: number): TeachingWeek | undefined {
	return plan.teachingSequence.find((week) => weekNumberOf(week) === weekNumber);
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

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function listTargetUnits() {
	const index = await getFacultyIndex();
	const seen = new Set<string>();
	const units: UnitPlan[] = [];

	for (const row of index.rows) {
		if (!isDtSubject(row.learningAreaSubject)) continue;
		for (const plan of await listUnitPlans(row.id)) {
			const key = unitKey(plan.levelPlanId, plan.id);
			if (seen.has(key)) continue;
			seen.add(key);
			units.push(plan);
		}
	}

	for (const plan of await listUnitPlans(STANDALONE_LEVEL_PLAN_ID)) {
		if (!isDtSubject(String(plan.subject.value))) continue;
		const key = unitKey(plan.levelPlanId, plan.id);
		if (seen.has(key)) continue;
		seen.add(key);
		units.push(plan);
	}

	return units.sort((a, b) => {
		const faculty = String(a.levelPlanId).localeCompare(String(b.levelPlanId));
		if (faculty) return faculty;
		return Number(a.unitNumber.value || 0) - Number(b.unitNumber.value || 0);
	});
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
	model: { id: string; label: string }
) {
	const week = findWeek(plan, weekNumber);
	if (!week) throw new Error(`Week ${weekNumber} not found`);
	const nextTheme = nextWeekOutlineTheme(plan, weekNumber);
	return generateWeekLessons({
		levelPlanId: plan.levelPlanId,
		unitId: plan.id,
		weekNumber,
		aiNotes: '',
		mode,
		unitSnapshot: unitSnapshot(plan),
		weekContext: weekContext(week),
		...(nextTheme ? { nextWeekOutlineTheme: nextTheme } : {}),
		priorLessons: collectPriorLessons(plan, weekNumber),
		existingLessons: week.lessons ?? [],
		models: [model]
	});
}

function resetDailyQuota(progress: ProgressFile) {
	const today = pacificDate();
	if (progress.quotaDate !== today) {
		progress.quotaDate = today;
		progress.exhaustedModels = [];
		progress.stoppedReason = undefined;
	}
}

function currentModel(progress: ProgressFile): { id: string; label: string } | undefined {
	const exhausted = new Set(progress.exhaustedModels ?? []);
	return BATCH_MODELS.find((model) => !exhausted.has(model.id));
}

function markExhausted(progress: ProgressFile, modelId: string) {
	progress.quotaDate = pacificDate();
	progress.exhaustedModels = [...new Set([...(progress.exhaustedModels ?? []), modelId])];
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

	const progress = await loadProgress();
	resetDailyQuota(progress);
	const units = await listTargetUnits();
	const filtered = onlyUnit ? units.filter((plan) => plan.id === onlyUnit) : units;

	if (onlyUnit && !filtered.length) {
		throw new Error(`No Digital/Design Technologies unit found with id ${onlyUnit}`);
	}

	log(
		`Models: ${BATCH_MODELS.map((m) => m.id).join(' → ')}. Units: ${filtered.length}. Progress: ${PROGRESS_PATH}`
	);

	let pendingGenerate = 0;
	let pendingEnrich = 0;
	let doneBest = 0;
	let doneNeedsUpgrade = 0;

	for (const plan of filtered) {
		const entry = ensureUnitProgress(progress, plan);
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
			} else if (hasLessons && wp.generate !== 'done') {
				wp.generate = 'done';
			}
			const treatAsPendingUpgrade = upgrade && weekNeedsUpgrade(wp);
			if (wp.generate !== 'done' || treatAsPendingUpgrade) pendingGenerate += 1;
			else if (wp.enrich !== 'done') pendingEnrich += 1;
			else if (weekNeedsUpgrade(wp)) doneNeedsUpgrade += 1;
			else doneBest += 1;
		}
	}

	await saveProgress(progress);

	if (statusOnly || dryRun) {
		log(
			`Done on ${BEST_ID}: ${doneBest}. Done on 3.7 (upgrade later): ${doneNeedsUpgrade}. Need generate: ${pendingGenerate}. Need enrich: ${pendingEnrich}.`
		);
		if (progress.exhaustedModels?.length) {
			log(`Quota used today (Pacific): ${progress.exhaustedModels.join(', ')}`);
		}
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
			log('When 3.8 quota is back, run: npm run lessons:batch:upgrade');
		}
		return;
	}

	if (upgrade) {
		log(`Upgrade mode: re-generate + re-enrich 3.7 weeks on ${BEST_ID} only.`);
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
				wp.generate = 'pending';
				wp.enrich = 'pending';
				delete wp.error;
			}

			const runStep = async (mode: 'generate' | 'enrich'): Promise<'quota' | void> => {
				for (;;) {
					const model = upgrade ? BATCH_MODELS[0] : currentModel(progress);
					if (!model) {
						progress.stoppedReason = 'quota';
						await saveProgress(progress);
						if (!wait) {
							log(
								'3.8 and 3.7 quota are both gone. Progress saved. Rerun tomorrow, or use --wait.'
							);
							process.exitCode = 0;
							return 'quota';
						}
						log(
							`Both models exhausted. Sleeping ${sleepMs / 60000} minutes then retrying from 3.8…`
						);
						await sleep(sleepMs);
						progress.quotaDate = pacificDate();
						progress.exhaustedModels = [];
						progress.stoppedReason = undefined;
						await saveProgress(progress);
						continue;
					}

					try {
						log(`  Week ${weekNumber} ${mode} with ${model.id}…`);
						const result = await generateWeek(plan, weekNumber, mode, model);
						week.lessons = result.lessons;
						plan.teachingSequence = plan.teachingSequence.slice();
						await saveUnitPlan(plan);
						if (mode === 'generate') {
							wp.generate = 'done';
							wp.generateModel = result.model;
						} else {
							wp.enrich = 'done';
							wp.enrichModel = result.model;
						}
						delete wp.error;
						progress.stoppedReason = undefined;
						await saveProgress(progress);
						log(`  Week ${weekNumber} ${mode} ok (${result.modelLabel})`);
						return;
					} catch (error) {
						const message = errorMessage(error);
						const quota =
							isQuotaError(error) ||
							(error instanceof CascadeExhaustedError &&
								error.attemptedModels.some(
									(attempt) => attempt.error && isQuotaError(new Error(attempt.error))
								));
						wp.error = message;
						await saveProgress(progress);
						if (quota) {
							markExhausted(progress, model.id);
							await saveProgress(progress);
							log(`${model.label} quota exhausted. Switching models if any remain.`);
							if (upgrade) {
								progress.stoppedReason = 'quota';
								await saveProgress(progress);
								log(
									'Upgrade stopped (3.8 quota gone). Remaining 3.7 weeks stay marked for later.'
								);
								process.exitCode = 0;
								return 'quota';
							}
							continue;
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
	if (leftover) {
		log(
			`All pending generate/enrich jobs are done. ${leftover} week(s) still on 3.7 — later run: npm run lessons:batch:upgrade`
		);
	} else {
		log('All Digital/Design Technologies lesson generate+enrich jobs are done on 3.8.');
	}
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
