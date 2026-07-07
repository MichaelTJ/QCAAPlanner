import { aiField, cloneAiField, type LevelPlan, type LevelPlanAssessment, type Settings, type UnitAssessment, type UnitPlan } from '$lib/types';

export const DEFAULT_SETTINGS: Settings = {
	school: "St Brendan's College (Yeppoon)",
	aiTone:
		'Professional QCAA curriculum language. Concise, achievement-standard aligned. Australian English.'
};

export const ASSESSMENT_TECHNIQUES = [
	'Other',
	'Portfolio',
	'Examination',
	'Investigation',
	'Project'
] as const;

export const ASSESSMENT_MODES = ['Multimodal', 'Written'] as const;

export const PLAN_STATUSES = ['Draft', 'Draft (Validated)', 'Approved for use'] as const;

export const GENERAL_CAPABILITY_NAMES = [
	'Critical and creative thinking',
	'Digital literacy',
	'Ethical understanding',
	'Intercultural understanding',
	'Literacy',
	'Numeracy',
	'Personal and social capability'
];

export const CROSS_CURRICULUM_PRIORITIES = [
	'Aboriginal and Torres Strait Islander histories and cultures',
	"Asia and Australia's engagement with Asia",
	'Sustainability'
];

/** Storage bucket for unit plans not linked to a faculty level plan. */
export const STANDALONE_LEVEL_PLAN_ID = 'standalone';

export function createId(prefix = 'id'): string {
	return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

/** Normalise year band to e.g. "7-8" or "9-10". */
export function normalizeYearBand(band: string): string {
	return band
		.replace(/^band\s+/i, '')
		.replace(/\s*\d{4}$/, '')
		.replace(/\s*v\d+$/i, '')
		.replace(/–/g, '-')
		.trim();
}

/** Display name for a level plan, e.g. "7-8 Digital Technologies". */
export function formatBandSubjectTitle(yearLevelBand: string, learningAreaSubject: string): string {
	const band = normalizeYearBand(yearLevelBand);
	const subject = learningAreaSubject.replace(/^Design and Technologies$/i, 'Design Technologies');
	return `${band} ${subject}`;
}

export function createEmptyLevelPlan(id: string, learningArea?: string, band?: string): LevelPlan {
	const unitCount = 3;
	return {
		id,
		bandSubjectTitle: aiField(
			learningArea && band ? formatBandSubjectTitle(band, learningArea) : ''
		),
		school: aiField(DEFAULT_SETTINGS.school),
		year: aiField(new Date().getFullYear()),
		status: aiField('Draft'),
		levelDescription: aiField(),
		contextAndCohortConsiderations: aiField(),
		units: Array.from({ length: unitCount }, (_, i) => ({
			id: createId('unit'),
			unitTitle: aiField(`Unit ${i + 1}`),
			yearLevel: aiField<number | ''>(''),
			duration: aiField(''),
			description: aiField(),
			assessments: []
		})),
		contentDescriptions: [],
		generalCapabilities: GENERAL_CAPABILITY_NAMES.map((name) => ({
			id: createId('cap'),
			name: aiField(name),
			unitInclusions: Array(unitCount).fill(false)
		})),
		crossCurriculumPriorities: CROSS_CURRICULUM_PRIORITIES.map((name) => ({
			id: createId('ccp'),
			name: aiField(name),
			unitInclusions: Array(unitCount).fill(false)
		}))
	};
}

export function createEmptyUnitPlan(
	id: string,
	levelPlanId: string,
	unitNumber = 1
): UnitPlan {
	return {
		id,
		levelPlanId,
		yearLevel: aiField<number | ''>(''),
		subject: aiField(''),
		unitNumber: aiField(unitNumber),
		unitTitle: aiField(`Unit ${unitNumber}`),
		year: aiField(new Date().getFullYear()),
		status: aiField('Draft'),
		startWeek: aiField(''),
		finishWeek: aiField(''),
		unitDescription: aiField(),
		cohortAndClassConsiderations: aiField(),
		adjustments: [],
		assessments: [],
		generalCapabilities: GENERAL_CAPABILITY_NAMES.map((name) => ({
			id: createId('ucap'),
			name: aiField(name),
			subElements: aiField(),
			evidenceNotes: aiField(),
			subElementChecks: {}
		})),
		teachingSequence: [],
		evaluation: aiField()
	};
}

export function createTeachingWeeks(count: number, startAt = 1) {
	return Array.from({ length: count }, (_, i) => ({
		id: createId('week'),
		week: aiField(startAt + i),
		keyTeachingExperiences: aiField(),
		adjustments: aiField(),
		resources: aiField(),
		theory: aiField(),
		prac: aiField(),
		assessment: aiField(),
		outlineTheme: aiField()
	}));
}

export function assessmentTimingFromLevelPlan(assessment: LevelPlanAssessment): string {
	const parts: string[] = [];
	if (assessment.term.value !== '' && assessment.term.value != null) {
		parts.push(`Term ${assessment.term.value}`);
	}
	if (assessment.week.value !== '' && assessment.week.value != null) {
		parts.push(`Week ${assessment.week.value}`);
	}
	return parts.join(', ');
}

export function mapLevelPlanAssessmentsToUnitAssessments(
	assessments: LevelPlanAssessment[],
	yearLevel: number | '' = ''
): UnitAssessment[] {
	return assessments.map((assessment) => ({
		id: createId('uassess'),
		assessmentNumber: cloneAiField(assessment.assessmentNumber),
		yearLevel: aiField(yearLevel),
		title: cloneAiField(assessment.title),
		description: cloneAiField(assessment.description),
		technique: cloneAiField(assessment.technique),
		mode: cloneAiField(assessment.mode),
		conditions: cloneAiField(assessment.conditions),
		timing: aiField(assessmentTimingFromLevelPlan(assessment)),
		achievementStandard: cloneAiField(assessment.achievementStandard),
		moderation: cloneAiField(assessment.moderation),
		contentDescriptions: []
	}));
}
