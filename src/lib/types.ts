import type { WorkbookActivity, WorkbookActivityKind } from '$lib/workbook/types';

export interface AiField<T = string> {
	value: T;
	aiNotes: string;
	lastGenerated?: string;
}

export function aiField<T = string>(value: T = '' as T): AiField<T> {
	return { value, aiNotes: '' };
}

export function cloneAiField<T>(field: AiField<T>): AiField<T> {
	return {
		value: field.value,
		aiNotes: field.aiNotes,
		...(field.lastGenerated ? { lastGenerated: field.lastGenerated } : {})
	};
}

export interface Settings {
	school: string;
	aiTone: string;
}

export interface FacultyRow {
	id: string;
	learningAreaSubject: string;
	yearLevelBand: string;
	/** Optional override: which AC curriculum catalogue this plan uses (e.g. Design criteria for Manual Arts). */
	curriculumPlanType?: string;
	dateLastModified: string;
}

export interface FacultyIndex {
	rows: FacultyRow[];
}

export type AssessmentTechnique =
	| 'Other'
	| 'Portfolio'
	| 'Examination'
	| 'Investigation'
	| 'Project';

export type AssessmentMode = 'Multimodal' | 'Written';

export type PlanStatus = 'Draft' | 'Draft (Validated)' | 'Approved for use';

export interface LevelPlanUnit {
	id: string;
	unitTitle: AiField;
	yearLevel: AiField<number | ''>;
	duration: AiField;
	description: AiField;
	assessments: LevelPlanAssessment[];
}

export interface LevelPlanAssessment {
	id: string;
	assessmentNumber: AiField<number | ''>;
	title: AiField;
	term: AiField<number | ''>;
	week: AiField<number | ''>;
	description: AiField;
	technique: AiField<AssessmentTechnique | ''>;
	mode: AiField<AssessmentMode | ''>;
	conditions: AiField;
	achievementStandard: AiField;
	moderation: AiField;
}

export interface ContentDescriptionRow {
	id: string;
	strand: AiField;
	subStrand: AiField;
	text: AiField;
	code: AiField;
	unitInclusions: boolean[];
}

export interface CapabilityRow {
	id: string;
	name: AiField;
	unitInclusions: boolean[];
	categoryInclusions?: Record<string, boolean[]>;
	subElementInclusions?: Record<string, boolean[]>;
}

export interface LevelPlan {
	id: string;
	bandSubjectTitle: AiField;
	school: AiField;
	year: AiField<number | ''>;
	status: AiField<PlanStatus | ''>;
	levelDescription: AiField;
	contextAndCohortConsiderations: AiField;
	units: LevelPlanUnit[];
	contentDescriptions: ContentDescriptionRow[];
	generalCapabilities: CapabilityRow[];
	crossCurriculumPriorities: CapabilityRow[];
}

export interface UnitAdjustment {
	id: string;
	studentIdentifier: AiField;
	assessmentBand: AiField;
	categoryOfNeed: AiField;
	adjustments: AiField;
	review: AiField;
}

export interface UnitAssessmentContentDescription {
	id: string;
	strand: AiField;
	subStrand: AiField;
	text: AiField;
	code: AiField;
}

export interface UnitAssessment {
	id: string;
	assessmentNumber: AiField<number | ''>;
	yearLevel: AiField<number | ''>;
	title: AiField;
	description: AiField;
	technique: AiField<AssessmentTechnique | ''>;
	mode: AiField<AssessmentMode | ''>;
	conditions: AiField;
	timing: AiField;
	achievementStandard: AiField;
	moderation: AiField;
	contentDescriptions: UnitAssessmentContentDescription[];
}

export interface UnitGeneralCapability {
	id: string;
	name: AiField;
	subElements: AiField;
	evidenceNotes: AiField;
	subElementChecks: Record<string, boolean>;
}

export type LessonEnhancePath = 'skill-building' | 'knowledge-building';

export type LessonActivityStage =
	| 'i-do'
	| 'we-do'
	| 'you-do'
	| 'vocabulary'
	| 'guided-notes'
	| 'generative';

export interface LessonActivity {
	id: string;
	minutes: number;
	timeLabel: string;
	title: string;
	stage: LessonActivityStage;
	teacherDoes: string;
	studentsDo: string;
	visibleInstructions: string;
	questioning: string;
	scaffolding: string;
	eLearning: string;
	transition: string;
	/** Chosen on generate pass from the workbook activity catalog. */
	workbookKind?: WorkbookActivityKind;
	/** Structured workbook widget filled on enrich (JSON matching workbookKind). */
	workbookSpec?: WorkbookActivity;
	/** Printable student worksheet content (matrices, label sheets, blank organisers). */
	workbookMaterials?: string;
	/** Worked examples and answers for the teacher document. */
	teacherAnswerKey?: string;
}

export interface LessonOrientate {
	smartStart: string;
	learningGoalDisplay: string;
}

export interface LessonEnhance {
	activities: LessonActivity[];
}

export interface LessonCulminate {
	smartFinish: string;
	summarise: string;
	nextSteps: string;
}

export interface LessonPlan {
	id: string;
	lessonNumber: number;
	durationMinutes: number;
	title: string;
	enhancePath: LessonEnhancePath;
	learningGoal: string;
	orientate: LessonOrientate;
	enhance: LessonEnhance;
	culminate: LessonCulminate;
	resources: string;
	lastGenerated?: string;
	/** Model id that produced the ASPIRE script (generate pass). */
	generatedWith?: string;
	/** Model id that last filled workbook materials (enrich pass). */
	enrichedWith?: string;
}

export interface TeachingWeek {
	id: string;
	week: AiField<number | ''>;
	keyTeachingExperiences: AiField;
	adjustments: AiField;
	resources: AiField;
	theory: AiField;
	prac: AiField;
	assessment: AiField;
	outlineTheme?: AiField;
	/** ASPIRE lesson scripts (typically 3 × 60 min) generated after weekly detail. */
	lessons?: LessonPlan[];
}

export interface UnitPlan {
	id: string;
	levelPlanId: string;
	yearLevel: AiField<number | ''>;
	subject: AiField;
	unitNumber: AiField<number | ''>;
	unitTitle: AiField;
	year: AiField<number | ''>;
	status: AiField<PlanStatus | ''>;
	startWeek: AiField;
	finishWeek: AiField;
	duration: AiField;
	unitDescription: AiField;
	cohortAndClassConsiderations: AiField;
	adjustments: UnitAdjustment[];
	assessments: UnitAssessment[];
	generalCapabilities: UnitGeneralCapability[];
	teachingSequence: TeachingWeek[];
	evaluation: AiField;
	/** Saved AI learning guides, reused on export until unit content changes. */
	learningGuides?: SavedLearningGuides;
}

export interface SavedLearningGuideWeek {
	week: number | '';
	title: string;
	bullets: string[];
}

export interface SavedLearningGuideVariant {
	vocabulary: string;
	/** Summary guides store AI-condensed weeks; detailed guides rebuild weeks from the unit. */
	weeks?: SavedLearningGuideWeek[];
	lastGenerated: string;
}

export interface SavedLearningGuides {
	sourceHash: string;
	summary?: SavedLearningGuideVariant;
	detailed?: SavedLearningGuideVariant;
}

export interface AssessmentCheckpoint {
	id: string;
	label: string;
	week: AiField;
	action: AiField;
	checked: boolean;
}

export interface AssessmentAuthStrategy {
	id: string;
	label: string;
	selected: boolean;
}

export interface AssessmentInstrumentContentDescription {
	id: string;
	strand: AiField;
	subStrand: AiField;
	text: AiField;
	code: AiField;
	selected: boolean;
}

export interface AssessmentCriteriaDescriptors {
	A: string;
	B: string;
	C: string;
	D: string;
	E: string;
}

export interface AssessmentCriteriaRow {
	id: string;
	category: string;
	strand: string;
	enabled: boolean;
	descriptors: AssessmentCriteriaDescriptors;
	contentDescriptionCodes: string[];
}

export interface AssessmentExamQuestion {
	id: string;
	prompt: AiField;
	marks: AiField<number | ''>;
}

export interface AssessmentExamSection {
	id: string;
	title: AiField;
	questions: AssessmentExamQuestion[];
}

export interface AssessmentItem {
	id: string;
	unitPlanId: string;
	levelPlanId: string;
	assessmentNumber: AiField<number | ''>;
	instrumentNumber: AiField;
	yearLevel: AiField<number | ''>;
	subject: AiField;
	unitTitle: AiField;
	title: AiField;
	description: AiField;
	technique: AiField<AssessmentTechnique | ''>;
	mode: AiField<AssessmentMode | ''>;
	conditions: AiField;
	duration: AiField;
	length: AiField;
	individualOrGroup: AiField;
	conditionsOther: AiField;
	resourcesAvailable: AiField;
	examTimeMinutes: AiField;
	perusalMinutes: AiField;
	instructions: AiField;
	topics: AiField;
	context: AiField;
	task: AiField;
	toComplete: AiField;
	stimulus: AiField;
	scaffolding: AiField;
	checkpoints: AssessmentCheckpoint[];
	authenticationStrategies: AssessmentAuthStrategy[];
	contentDescriptions: AssessmentInstrumentContentDescription[];
	knowledgeUnderstandingResult: AiField;
	processProductionResult: AiField;
	overallResult: AiField;
	criteriaRows: AssessmentCriteriaRow[];
	examSections: AssessmentExamSection[];
	notes: AiField;
}

export interface AssessmentItemSummary {
	id: string;
	unitPlanId: string;
	levelPlanId: string;
	title: string;
	technique: string;
	assessmentNumber: number | '';
	yearLevel: number | '';
	subject: string;
	unitTitle: string;
	isStandalone: boolean;
}

export interface GenerateRequest {
	docType: 'level-plan' | 'unit-plan' | 'assessment-item';
	docId: string;
	levelPlanId?: string;
	fieldPath: string;
	fieldLabel: string;
	currentValue: string;
	aiNotes: string;
}

export interface ChunkTeachingWeekContext {
	week: number | string;
	outlineTheme?: string;
	keyTeachingExperiences?: string;
	theory?: string;
	prac?: string;
	assessment?: string;
	resources?: string;
}

export interface ChunkGenerateRequest {
	levelPlanId: string;
	unitId: string;
	mode: 'outline' | 'weekly';
	chunkSize: number;
	startWeek: number;
	endWeek: number;
	aiNotes: string;
	/** Client-side teaching sequence snapshot so batch runs see prior generated weeks. */
	teachingSequenceContext?: ChunkTeachingWeekContext[];
	/** In-memory unit fields so generation matches unsaved editor state. */
	unitSnapshot?: {
		unitTitle: string;
		description: string;
		assessments: Array<{
			title: string;
			description: string;
			timing: string;
			technique: string;
		}>;
	};
}

export interface LessonGeneratePriorLesson {
	week: number;
	lessonNumber: number;
	title: string;
	learningGoal: string;
}

export interface LessonGenerateRequest {
	levelPlanId: string;
	unitId: string;
	weekNumber: number;
	aiNotes: string;
	/** generate = full ASPIRE scripts; enrich = concrete materials / answer keys on existing lessons. */
	mode?: 'generate' | 'enrich';
	/** When set, regenerate only this lesson within the week (others preserved). */
	lessonNumber?: number;
	/** Preferred Enhance path for a single-lesson regenerate. */
	enhancePath?: LessonEnhancePath;
	unitSnapshot?: {
		unitTitle: string;
		description: string;
		assessments: Array<{
			title: string;
			description: string;
			timing: string;
			technique: string;
		}>;
	};
	weekContext: {
		week: number | string;
		outlineTheme?: string;
		keyTeachingExperiences?: string;
		theory?: string;
		prac?: string;
		assessment?: string;
		resources?: string;
	};
	nextWeekOutlineTheme?: string;
	priorLessons?: LessonGeneratePriorLesson[];
	/** Existing lessons for this week when revising or enriching. */
	existingLessons?: LessonPlan[];
	/** Override the default cascade. Generate uses Flash; enrich uses Flash-Lite unless set. */
	models?: Array<{
		id: string;
		label: string;
		timeoutMs?: number;
		serviceTier?: 'flex' | 'standard' | 'priority';
	}>;
	/** Batch overnight jobs use Flex; the UI omits this (Standard). */
	serviceTier?: 'flex';
}

export interface CapabilitiesGenerateRequest {
	levelPlanId: string;
	unitId: string;
	capabilityName?: string;
	aiNotes?: string;
}

export interface LearningGuideVocabularyGenerateRequest {
	levelPlanId: string;
	unitId: string;
	aiNotes?: string;
}

export interface UnitPlanSummary {
	id: string;
	levelPlanId: string;
	levelPlanLabel: string;
	unitTitle: string;
	unitNumber: number | '';
	yearLevel: number | '';
	subject: string;
	status: string;
	isStandalone: boolean;
	curriculumLabel: string;
	curriculumSortKey: string;
	/** True when any teaching week already has saved ASPIRE lessons. */
	hasLessons: boolean;
}

export interface OverviewUnitEntry {
	slotIndex: number;
	levelUnitId: string;
	unitPlanId: string | null;
	title: string;
	unitNumber: number | '';
	yearLevel: number | '';
	duration: string;
	status: string;
	hasUnitPlan: boolean;
}

export interface FacultyOverviewEntry extends FacultyRow {
	bandSubjectTitle: string;
	levelPlanStatus: string;
	units: OverviewUnitEntry[];
}

export interface DescriptionRefineRequest {
	target: 'unit' | 'assessment';
	planType: string;
	levelDescription: string;
	unitTitle: string;
	assessmentTitle?: string;
	currentValue: string;
	selectedContentDescriptors: {
		code: string;
		text: string;
		strand: string;
	}[];
}
