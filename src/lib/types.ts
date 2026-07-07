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
}

export interface AssessmentItem {
	id: string;
	unitPlanId: string;
	levelPlanId: string;
	title: AiField;
	description: AiField;
	technique: AiField<AssessmentTechnique | ''>;
	mode: AiField<AssessmentMode | ''>;
	conditions: AiField;
	markingCriteria: AiField;
	notes: AiField;
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

export type QuickPlanType =
	| '7-8-digital-technologies'
	| '9-10-design'
	| '9-10-digital-technologies'
	| '10-engineering';

export interface QuickPlanAssessment {
	id: string;
	title: string;
	description: string;
}

export interface QuickPlanUnit {
	id: string;
	title: string;
	description: string;
	duration: string;
	assessments: QuickPlanAssessment[];
}

export interface QuickPlanContentInclusion {
	contentDescriptorId: string;
	assessmentInclusions: boolean[];
}

export interface QuickLevelPlan {
	id: string;
	planType: QuickPlanType;
	title: string;
	createdAt: string;
	modifiedAt: string;
	sourceLevelPlanId?: string;
	units: QuickPlanUnit[];
	contentInclusions: QuickPlanContentInclusion[];
}

export interface QuickLevelPlanSummary {
	id: string;
	planType: QuickPlanType;
	title: string;
	modifiedAt: string;
	sourceLevelPlanId?: string;
}

export interface QuickPlanRefineRequest {
	target: 'unit' | 'assessment';
	planType: QuickPlanType;
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
