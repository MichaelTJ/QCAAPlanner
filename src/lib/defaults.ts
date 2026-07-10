import {
	aiField,
	cloneAiField,
	type AssessmentAuthStrategy,
	type AssessmentCheckpoint,
	type AssessmentExamSection,
	type AssessmentItem,
	type LevelPlan,
	type LevelPlanAssessment,
	type Settings,
	type UnitAssessment,
	type UnitPlan
} from '$lib/types';
import { offsetWeekLabel } from '$lib/unit-duration';

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

export const ASSESSMENT_INDIVIDUAL_OR_GROUP = ['Individual', 'Group', 'Individual/group'] as const;

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

/** Sentinel unitPlanId for assessment items not linked to a unit plan. */
export const STANDALONE_UNIT_PLAN_ID = 'standalone';

export const DEFAULT_AUTHENTICATION_STRATEGIES: { id: string; label: string }[] = [
	{ id: 'class-time', label: 'You will be provided class time for task completion.' },
	{
		id: 'supervised-sections',
		label: 'You will produce sections of the final response under supervised conditions.'
	},
	{ id: 'progress-docs', label: 'You will provide documentation of your progress.' },
	{
		id: 'monitor-junctures',
		label: 'Your teacher will collect copies of your response and monitor at key junctures.'
	},
	{ id: 'annotate-draft', label: 'Your teacher will collect and annotate a draft.' },
	{
		id: 'consultations',
		label: 'Your teacher will conduct interviews or consultations as you develop the response.'
	},
	{ id: 'acknowledge-sources', label: 'You must acknowledge all sources.' },
	{ id: 'declaration', label: 'You must submit a declaration of authenticity.' },
	{ id: 'summaries', label: 'You will produce summaries during your response preparation.' },
	{
		id: 'post-interviews',
		label:
			'Your teacher will conduct interviews after submission to clarify or explore aspects of your response.'
	},
	{
		id: 'group-compare',
		label: 'Your teacher will compare the responses of students who have worked together in groups.'
	},
	{ id: 'cross-marking', label: 'Your teacher will ensure class cross-marking occurs.' }
];

export function createDefaultAuthenticationStrategies(): AssessmentAuthStrategy[] {
	return DEFAULT_AUTHENTICATION_STRATEGIES.map((s) => ({
		id: s.id,
		label: s.label,
		selected: false
	}));
}

export function createDefaultCheckpoints(unitFinishWeek = ''): AssessmentCheckpoint[] {
	const finish = String(unitFinishWeek).trim();
	// Due = week before unit end; Conferencing = week before due; Monitoring = two weeks before conferencing.
	const dueWeek = finish ? offsetWeekLabel(finish, -1) : '';
	const conferencingWeek = dueWeek ? offsetWeekLabel(dueWeek, -1) : '';
	const monitoringWeek = conferencingWeek ? offsetWeekLabel(conferencingWeek, -2) : '';

	return [
		{
			id: createId('cp'),
			label: 'Monitoring',
			week: aiField(monitoringWeek),
			action: aiField('Monitoring'),
			checked: true
		},
		{
			id: createId('cp'),
			label: 'Conferencing',
			week: aiField(conferencingWeek),
			action: aiField('Conferencing'),
			checked: true
		},
		{
			id: createId('cp'),
			label: 'Due Date',
			week: aiField(dueWeek),
			action: aiField('Due'),
			checked: true
		}
	];
}

export function createDefaultExamSections(): AssessmentExamSection[] {
	return [
		{
			id: createId('examsec'),
			title: aiField('Multiple choice'),
			questions: Array.from({ length: 5 }, (_, i) => ({
				id: createId('q'),
				prompt: aiField(`Question ${i + 1}`),
				marks: aiField<number | ''>('')
			}))
		},
		{
			id: createId('examsec'),
			title: aiField('Short response questions — simple'),
			questions: Array.from({ length: 4 }, (_, i) => ({
				id: createId('q'),
				prompt: aiField(`Question ${i + 1}`),
				marks: aiField<number | ''>('')
			}))
		},
		{
			id: createId('examsec'),
			title: aiField('Short response questions'),
			questions: Array.from({ length: 6 }, (_, i) => ({
				id: createId('q'),
				prompt: aiField(`Question ${i + 1}`),
				marks: aiField<number | ''>('')
			}))
		}
	];
}

export function createEmptyAssessmentItem(
	id: string,
	levelPlanId: string,
	unitPlanId: string,
	title = 'New assessment item'
): AssessmentItem {
	return {
		id,
		levelPlanId,
		unitPlanId,
		assessmentNumber: aiField<number | ''>(''),
		instrumentNumber: aiField(''),
		yearLevel: aiField<number | ''>(''),
		subject: aiField(''),
		unitTitle: aiField(''),
		title: aiField(title),
		description: aiField(''),
		technique: aiField(''),
		mode: aiField(''),
		conditions: aiField(''),
		duration: aiField(''),
		length: aiField(''),
		individualOrGroup: aiField(''),
		conditionsOther: aiField(''),
		resourcesAvailable: aiField(''),
		examTimeMinutes: aiField(''),
		perusalMinutes: aiField(''),
		instructions: aiField(''),
		topics: aiField(''),
		context: aiField(''),
		task: aiField(''),
		toComplete: aiField(''),
		stimulus: aiField('See Stimulus at end of task sheet'),
		scaffolding: aiField(''),
		checkpoints: createDefaultCheckpoints(),
		authenticationStrategies: createDefaultAuthenticationStrategies(),
		contentDescriptions: [],
		knowledgeUnderstandingResult: aiField(''),
		processProductionResult: aiField(''),
		overallResult: aiField(''),
		criteriaRows: [],
		examSections: createDefaultExamSections(),
		notes: aiField('')
	};
}

/** Fill missing fields when loading older stub assessment JSON. */
export function normalizeAssessmentItem(raw: Partial<AssessmentItem> & { id: string }): AssessmentItem {
	const base = createEmptyAssessmentItem(
		raw.id,
		raw.levelPlanId ?? STANDALONE_LEVEL_PLAN_ID,
		raw.unitPlanId ?? STANDALONE_UNIT_PLAN_ID,
		typeof raw.title === 'object' && raw.title?.value ? String(raw.title.value) : 'Assessment item'
	);

	const legacy = raw as Partial<AssessmentItem> & { markingCriteria?: { value?: string; aiNotes?: string } };

	return {
		...base,
		...raw,
		assessmentNumber: raw.assessmentNumber ?? base.assessmentNumber,
		instrumentNumber: raw.instrumentNumber ?? base.instrumentNumber,
		yearLevel: raw.yearLevel ?? base.yearLevel,
		subject: raw.subject ?? base.subject,
		unitTitle: raw.unitTitle ?? base.unitTitle,
		title: raw.title ?? base.title,
		description: raw.description ?? base.description,
		technique: raw.technique ?? base.technique,
		mode: raw.mode ?? base.mode,
		conditions: raw.conditions ?? base.conditions,
		duration: raw.duration ?? base.duration,
		length: raw.length ?? base.length,
		individualOrGroup: raw.individualOrGroup ?? base.individualOrGroup,
		conditionsOther: raw.conditionsOther ?? base.conditionsOther,
		resourcesAvailable: raw.resourcesAvailable ?? base.resourcesAvailable,
		examTimeMinutes: raw.examTimeMinutes ?? base.examTimeMinutes,
		perusalMinutes: raw.perusalMinutes ?? base.perusalMinutes,
		instructions: raw.instructions ?? base.instructions,
		topics: raw.topics ?? base.topics,
		context: raw.context ?? base.context,
		task: raw.task ?? base.task,
		toComplete: raw.toComplete ?? base.toComplete,
		stimulus: raw.stimulus ?? base.stimulus,
		scaffolding: raw.scaffolding ?? base.scaffolding,
		checkpoints: raw.checkpoints ?? base.checkpoints,
		authenticationStrategies: raw.authenticationStrategies ?? base.authenticationStrategies,
		contentDescriptions: raw.contentDescriptions ?? base.contentDescriptions,
		knowledgeUnderstandingResult: raw.knowledgeUnderstandingResult ?? base.knowledgeUnderstandingResult,
		processProductionResult: raw.processProductionResult ?? base.processProductionResult,
		overallResult: raw.overallResult ?? base.overallResult,
		criteriaRows: raw.criteriaRows ?? base.criteriaRows,
		examSections: raw.examSections ?? base.examSections,
		notes:
			raw.notes ??
			(legacy.markingCriteria
				? {
						value: legacy.markingCriteria.value ?? '',
						aiNotes: legacy.markingCriteria.aiNotes ?? ''
					}
				: base.notes)
	};
}

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
		duration: aiField(''),
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
