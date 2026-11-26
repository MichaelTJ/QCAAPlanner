/**
 * Generate / enrich lesson weeks with a model outside the Gemini API (e.g. a Cursor subagent on
 * Gemini 3.8 Flash). Prompts and parsing are identical to the batch path.
 *
 *   npm run lessons:agent -- plan
 *   npm run lessons:agent -- redo --unit <levelPlanId>/<unitId>      (queue every week to regenerate)
 *   npm run lessons:agent -- next --unit <levelPlanId>/<unitId>
 *   npm run lessons:agent -- import --unit <levelPlanId>/<unitId> --week 3 [--model gemini-3.8-flash]
 *   npm run lessons:agent -- enrich-next --unit <levelPlanId>/<unitId>
 *   npm run lessons:agent -- enrich-import --unit <levelPlanId>/<unitId> --week 3 [--model gemini-3.8-flash]
 *
 * Stop any running lessons:batch process first — it keeps unit plans in memory and saves over them.
 * Without enrich-import, lessons:batch re-enriches imported weeks on Flash-Lite.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { LESSONS_PER_WEEK } from '$lib/defaults';
import { MODEL_CASCADE } from '$lib/gemini-models';
import { getUnitPlan, saveUnitPlan } from '$lib/server/data';
import {
	buildEnrichWeekPrompt,
	buildGenerateWeekPrompt,
	enrichLessonsFromText,
	lessonsFromGenerateText
} from '$lib/server/generate-lessons';
import type { TeachingWeek, UnitPlan } from '$lib/types';
import {
	findWeek,
	listTargetUnits,
	unitKey,
	weekHasDetail,
	weekNumberOf,
	weekRequest
} from './lesson-batch-shared';

const OUT_DIR = path.join(process.cwd(), 'data', 'agent-lessons');
const BEST_IDS = new Set(MODEL_CASCADE.slice(0, 2).map((model) => model.id));
const DEFAULT_MODEL = MODEL_CASCADE[0].id;
const MIN_ACTIVITIES = 2;

function argValue(name: string): string | undefined {
	const idx = process.argv.indexOf(`--${name}`);
	if (idx < 0) return undefined;
	return process.argv[idx + 1];
}

function weekNeedsBest(week: TeachingWeek): boolean {
	if (!weekHasDetail(week)) return false;
	const lessons = week.lessons ?? [];
	if (lessons.length < LESSONS_PER_WEEK) return true;
	return !lessons.every((lesson) => lesson.generatedWith && BEST_IDS.has(lesson.generatedWith));
}

function weekNeedsEnrich(week: TeachingWeek): boolean {
	const lessons = week.lessons ?? [];
	return lessons.length > 0 && !lessons.every((lesson) => lesson.enrichedWith);
}

function sortedWeekNumbers(plan: UnitPlan, keep: (week: TeachingWeek) => boolean): number[] {
	return plan.teachingSequence
		.filter(keep)
		.map(weekNumberOf)
		.filter((n) => Number.isFinite(n) && n > 0)
		.sort((a, b) => a - b);
}

function baseName(plan: UnitPlan) {
	return `${plan.levelPlanId}__${plan.id}`;
}

function filesFor(plan: UnitPlan, weekNumber: number, kind: 'generate' | 'enrich' = 'generate') {
	const suffix = kind === 'enrich' ? '.enrich' : '';
	const base = `${baseName(plan)}__w${weekNumber}${suffix}`;
	return {
		prompt: path.join(OUT_DIR, `${base}.prompt.md`),
		response: path.join(OUT_DIR, `${base}.response.json`)
	};
}

function redoPath(plan: UnitPlan) {
	return path.join(OUT_DIR, `${baseName(plan)}.redo.json`);
}

async function readRedo(plan: UnitPlan): Promise<number[] | null> {
	try {
		const parsed = JSON.parse(await fs.readFile(redoPath(plan), 'utf-8')) as { weeks?: number[] };
		return parsed.weeks ?? [];
	} catch {
		return null;
	}
}

async function writeRedo(plan: UnitPlan, weeks: number[]) {
	await fs.mkdir(OUT_DIR, { recursive: true });
	if (!weeks.length) {
		await fs.rm(redoPath(plan), { force: true });
		return;
	}
	await fs.writeFile(redoPath(plan), JSON.stringify({ weeks }, null, 2), 'utf-8');
}

async function pendingWeeks(plan: UnitPlan): Promise<number[]> {
	const redo = await readRedo(plan);
	if (redo) return [...redo].sort((a, b) => a - b);
	return sortedWeekNumbers(plan, weekNeedsBest);
}

/** Parallel imports into one unit must not save over each other: reload + save inside a lock. */
async function withUnitLock<T>(plan: UnitPlan, fn: (fresh: UnitPlan) => Promise<T>): Promise<T> {
	await fs.mkdir(OUT_DIR, { recursive: true });
	const lockPath = path.join(OUT_DIR, `${baseName(plan)}.lock`);
	const deadline = Date.now() + 120_000;
	for (;;) {
		try {
			const handle = await fs.open(lockPath, 'wx');
			await handle.close();
			break;
		} catch {
			if (Date.now() > deadline) throw new Error(`Timed out waiting for ${lockPath}`);
			await new Promise((resolve) => setTimeout(resolve, 250));
		}
	}
	try {
		return await fn(await loadUnit(unitKey(plan.levelPlanId, plan.id)));
	} finally {
		await fs.rm(lockPath, { force: true });
	}
}

async function loadUnit(key: string | undefined): Promise<UnitPlan> {
	if (!key || !key.includes('/')) throw new Error('Pass --unit <levelPlanId>/<unitId>');
	const [levelPlanId, unitId] = key.split('/');
	const plan = await getUnitPlan(levelPlanId, unitId);
	if (!plan) throw new Error(`Unit plan not found: ${key}`);
	return plan;
}

async function cmdPlan() {
	const units = await listTargetUnits();
	const rows = [];
	for (const plan of units) {
		const weeks = await pendingWeeks(plan);
		if (weeks.length) {
			rows.push({ unit: unitKey(plan.levelPlanId, plan.id), title: String(plan.unitTitle.value), weeks });
		}
	}
	console.log(
		JSON.stringify(
			{ units: rows, totalWeeks: rows.reduce((sum, row) => sum + row.weeks.length, 0) },
			null,
			2
		)
	);
}

async function cmdRedo() {
	const plan = await loadUnit(argValue('unit'));
	const weeks = sortedWeekNumbers(plan, weekHasDetail);
	await writeRedo(plan, weeks);
	console.log(JSON.stringify({ redo: weeks }));
}

async function cmdNext() {
	const plan = await loadUnit(argValue('unit'));
	const weekNumber = (await pendingWeeks(plan))[0];
	if (weekNumber == null) {
		console.log(JSON.stringify({ done: true }));
		return;
	}
	const { systemInstruction, userPrompt } = await buildGenerateWeekPrompt(
		weekRequest(plan, weekNumber, 'generate')
	);
	const files = filesFor(plan, weekNumber);
	await fs.mkdir(OUT_DIR, { recursive: true });
	await fs.writeFile(
		files.prompt,
		`# SYSTEM INSTRUCTION\n\n${systemInstruction}\n\n# USER PROMPT\n\n${userPrompt}\n`,
		'utf-8'
	);
	console.log(JSON.stringify({ week: weekNumber, ...files }));
}

async function cmdImport() {
	const plan = await loadUnit(argValue('unit'));
	const weekNumber = Number(argValue('week'));
	const model = argValue('model') || DEFAULT_MODEL;
	const week = findWeek(plan, weekNumber);
	if (!week) throw new Error(`Week ${weekNumber} not found`);

	const files = filesFor(plan, weekNumber);
	const text = await fs.readFile(files.response, 'utf-8');
	const lessons = await lessonsFromGenerateText(weekRequest(plan, weekNumber, 'generate'), text, model);

	const thin = lessons.filter((lesson) => lesson.enhance.activities.length < MIN_ACTIVITIES);
	if (lessons.length < LESSONS_PER_WEEK || thin.length) {
		throw new Error(
			`Response has ${lessons.length} lesson(s); lessons with fewer than ${MIN_ACTIVITIES} Enhance activities: ${
				thin.map((lesson) => lesson.lessonNumber).join(', ') || 'none'
			}. Fix the response file and import again.`
		);
	}

	await withUnitLock(plan, async (fresh) => {
		findWeek(fresh, weekNumber)!.lessons = lessons;
		await saveUnitPlan(fresh);
	});
	const redo = await readRedo(plan);
	if (redo) await writeRedo(plan, redo.filter((n) => n !== weekNumber));
	console.log(
		JSON.stringify({
			imported: true,
			week: weekNumber,
			model,
			lessons: lessons.map((lesson) => ({
				lessonNumber: lesson.lessonNumber,
				title: lesson.title,
				activities: lesson.enhance.activities.length
			}))
		})
	);
}

async function cmdEnrichNext() {
	const plan = await loadUnit(argValue('unit'));
	const weekArg = argValue('week');
	const weekNumber = weekArg ? Number(weekArg) : sortedWeekNumbers(plan, weekNeedsEnrich)[0];
	if (weekNumber == null) {
		console.log(JSON.stringify({ done: true }));
		return;
	}
	const { systemInstruction, sections } = await buildEnrichWeekPrompt(
		weekRequest(plan, weekNumber, 'enrich')
	);
	const keys = sections.map((section) => section.key);
	const files = filesFor(plan, weekNumber, 'enrich');
	const body = [
		'# SYSTEM INSTRUCTION',
		'',
		systemInstruction,
		'',
		'# TASK',
		'',
		`Each "## Activity" section below is a separate enrich request. Answer every one.`,
		`Return ONE JSON object whose keys are exactly: ${keys.join(', ')}.`,
		'Each value is the single activity object that request asks for.',
		'',
		...sections.flatMap((section) => [`## Activity ${section.key}`, '', section.prompt, ''])
	].join('\n');
	await fs.mkdir(OUT_DIR, { recursive: true });
	await fs.writeFile(files.prompt, body, 'utf-8');
	console.log(JSON.stringify({ week: weekNumber, keys, ...files }));
}

async function cmdEnrichImport() {
	const plan = await loadUnit(argValue('unit'));
	const weekNumber = Number(argValue('week'));
	const model = argValue('model') || DEFAULT_MODEL;
	const week = findWeek(plan, weekNumber);
	if (!week) throw new Error(`Week ${weekNumber} not found`);

	const files = filesFor(plan, weekNumber, 'enrich');
	const text = await fs.readFile(files.response, 'utf-8');
	const lessons = enrichLessonsFromText(weekRequest(plan, weekNumber, 'enrich'), text, model);
	await withUnitLock(plan, async (fresh) => {
		findWeek(fresh, weekNumber)!.lessons = lessons;
		await saveUnitPlan(fresh);
	});
	console.log(
		JSON.stringify({
			enriched: true,
			week: weekNumber,
			model,
			activities: lessons.reduce((sum, lesson) => sum + lesson.enhance.activities.length, 0)
		})
	);
}

async function main() {
	const command = process.argv[2];
	if (command === 'plan') return cmdPlan();
	if (command === 'redo') return cmdRedo();
	if (command === 'next') return cmdNext();
	if (command === 'import') return cmdImport();
	if (command === 'enrich-next') return cmdEnrichNext();
	if (command === 'enrich-import') return cmdEnrichImport();
	throw new Error(
		'Usage: lessons-agent.ts plan | redo --unit <key> | next --unit <key> | import --unit <key> --week <n> | enrich-next --unit <key> | enrich-import --unit <key> --week <n>'
	);
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
});
