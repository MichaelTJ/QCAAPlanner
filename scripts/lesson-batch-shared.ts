import { STANDALONE_LEVEL_PLAN_ID } from '$lib/defaults';
import type { CascadeModel } from '$lib/gemini-models';
import { getFacultyIndex, listUnitPlans } from '$lib/server/data';
import type { LessonGenerateRequest, LessonPlan, TeachingWeek, UnitPlan } from '$lib/types';

export function unitKey(levelPlanId: string, unitId: string) {
	return `${levelPlanId}/${unitId}`;
}

export function isDtSubject(value: string): boolean {
	const text = value.toLowerCase();
	if (text.includes('manual arts')) return false;
	return /digital\s+technolog/i.test(text) || /design\s+(and\s+)?technolog/i.test(text);
}

export function weekNumberOf(week: TeachingWeek): number {
	return Number(week.week.value);
}

export function weekHasDetail(week: TeachingWeek): boolean {
	return [
		week.keyTeachingExperiences?.value,
		week.theory?.value,
		week.prac?.value,
		week.assessment?.value,
		week.resources?.value
	].some((value) => String(value ?? '').trim() !== '');
}

export function sortedLessons(week: TeachingWeek): LessonPlan[] {
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

export function findWeek(plan: UnitPlan, weekNumber: number): TeachingWeek | undefined {
	return plan.teachingSequence.find((week) => weekNumberOf(week) === weekNumber);
}

export function weekRequest(
	plan: UnitPlan,
	weekNumber: number,
	mode: 'generate' | 'enrich',
	models?: CascadeModel[]
): LessonGenerateRequest {
	const week = findWeek(plan, weekNumber);
	if (!week) throw new Error(`Week ${weekNumber} not found`);
	const nextTheme = nextWeekOutlineTheme(plan, weekNumber);
	return {
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
		...(models?.length ? { models } : {})
	};
}

export async function listTargetUnits() {
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
