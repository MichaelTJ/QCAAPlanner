import { getLevelPlan, getUnitPlan } from '$lib/server/data';
import type { LevelPlan, LevelPlanUnit, UnitPlan } from '$lib/types';

/** Approved Year 7–8 reference plans used for length and tone guidance only. */
export const EXAMPLE_LEVEL_PLAN_ID = 'digital-technologies-band-7-8-2026';
const EXAMPLE_UNIT_PLAN_ID = 'unit-7-1-digital-literacy';

const EXAMPLE_NOTE =
	'These examples are from an approved 7-8 Digital Technologies plan. Use them ONLY as guides for appropriate length, structure, and professional tone for each field type. Do NOT copy, adapt, or mirror their specific topics, technologies, unit themes, assessment tasks, or other subject content. Generate original content appropriate to the year band, learning area, and context of the document you are writing for.';

export type ExampleScope = 'descriptions' | 'full';

type CachedExamples = Record<ExampleScope, Record<string, unknown> | null>;

let cachedExamples: CachedExamples | null = null;

function text(value: unknown): string | undefined {
	const s = String(value ?? '').trim();
	return s || undefined;
}

function summarizeLevelPlanExample(plan: LevelPlan) {
	return {
		bandSubjectTitle: text(plan.bandSubjectTitle.value),
		levelDescription: text(plan.levelDescription.value),
		contextAndCohortConsiderations: text(plan.contextAndCohortConsiderations.value),
		units: plan.units.map(summarizeLevelPlanUnitExample)
	};
}

function summarizeLevelPlanUnitExample(unit: LevelPlanUnit) {
	return {
		unitTitle: text(unit.unitTitle.value),
		yearLevel: unit.yearLevel.value,
		duration: text(unit.duration.value),
		description: text(unit.description.value),
		assessments: unit.assessments.map((a) => ({
			title: text(a.title.value),
			description: text(a.description.value),
			conditions: text(a.conditions.value),
			moderation: text(a.moderation.value)
		}))
	};
}

function summarizeUnitPlanExample(unit: UnitPlan) {
	const sampleWeek = unit.teachingSequence.find(
		(w) =>
			text(w.keyTeachingExperiences.value) ||
			text(w.theory.value) ||
			text(w.prac.value)
	);

	return {
		unitTitle: text(unit.unitTitle.value),
		unitDescription: text(unit.unitDescription.value),
		assessments: unit.assessments.slice(0, 1).map((a) => ({
			title: text(a.title.value),
			description: text(a.description.value),
			conditions: text(a.conditions.value)
		})),
		generalCapabilities: unit.generalCapabilities
			.filter((c) => text(c.subElements.value) || text(c.evidenceNotes.value))
			.slice(0, 2)
			.map((c) => ({
				name: text(c.name.value),
				subElements: text(c.subElements.value),
				evidenceNotes: text(c.evidenceNotes.value)
			})),
		sampleTeachingWeek: sampleWeek
			? {
					week: sampleWeek.week.value,
					keyTeachingExperiences: text(sampleWeek.keyTeachingExperiences.value),
					theory: text(sampleWeek.theory.value),
					prac: text(sampleWeek.prac.value),
					assessment: text(sampleWeek.assessment.value),
					resources: text(sampleWeek.resources.value)
				}
			: undefined
	};
}

async function buildCachedExamples(): Promise<CachedExamples> {
	const levelPlan = await getLevelPlan(EXAMPLE_LEVEL_PLAN_ID);
	if (!levelPlan) {
		return { descriptions: null, full: null };
	}

	const levelSummary = summarizeLevelPlanExample(levelPlan);
	const descriptions = {
		purpose: EXAMPLE_NOTE,
		sourceBand: '7-8 Digital Technologies (2026)',
		levelPlan: levelSummary
	};

	const sampleUnit = await getUnitPlan(EXAMPLE_LEVEL_PLAN_ID, EXAMPLE_UNIT_PLAN_ID);
	const full = {
		...descriptions,
		sampleUnitPlan: sampleUnit ? summarizeUnitPlanExample(sampleUnit) : undefined
	};

	return { descriptions, full };
}

export async function loadGenerationExamples(
	scope: ExampleScope = 'full'
): Promise<Record<string, unknown> | null> {
	if (!cachedExamples) {
		cachedExamples = await buildCachedExamples();
	}
	return cachedExamples[scope];
}

export function formatGenerationExamples(examples: Record<string, unknown> | null): string {
	if (!examples) return '';

	return `Reference examples — length and tone guidance only:
${EXAMPLE_NOTE}

Examples (JSON):
${JSON.stringify(examples, null, 2)}`;
}
