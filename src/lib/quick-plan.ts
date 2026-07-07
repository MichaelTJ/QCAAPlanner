import { getCurriculumForPlanType } from '$lib/curriculum/quick-plan-data';
import type { CurriculumContentDescriptor } from '$lib/curriculum/quick-plan-data';
import { createId } from '$lib/defaults';
import { syncCapabilityRowColumns, unitPlanForLevelIndex } from '$lib/general-capabilities';
import {
	aiField,
	type ContentDescriptionRow,
	type LevelPlan,
	type LevelPlanAssessment,
	type LevelPlanUnit,
	type QuickLevelPlan,
	type QuickPlanAssessment,
	type QuickPlanContentInclusion,
	type QuickPlanType,
	type QuickPlanUnit,
	type UnitAssessmentContentDescription,
	type UnitPlan
} from '$lib/types';

export const ASSESSMENTS_PER_UNIT = 2;
export const DEFAULT_UNIT_COUNT = 3;
const MIN_ASSESSMENTS_PER_UNIT = 1;

export function createQuickPlanAssessment(label: string): QuickPlanAssessment {
	return {
		id: createId('qassess'),
		title: label,
		description: ''
	};
}

export function createQuickPlanUnit(index: number): QuickPlanUnit {
	return {
		id: createId('qunit'),
		title: `Unit ${index}`,
		description: '',
		duration: '',
		assessments: [
			createQuickPlanAssessment('Assessment 1'),
			createQuickPlanAssessment('Assessment 2')
		]
	};
}

export function totalAssessmentColumns(units: QuickPlanUnit[]): number {
	return units.reduce((count, unit) => count + unit.assessments.length, 0);
}

export function assessmentColumnIndex(
	units: QuickPlanUnit[],
	unitIndex: number,
	assessmentIndex: number
): number {
	let col = 0;
	for (let ui = 0; ui < unitIndex; ui++) {
		col += units[ui].assessments.length;
	}
	return col + assessmentIndex;
}

export function createEmptyQuickLevelPlan(planType: QuickPlanType): QuickLevelPlan {
	const curriculum = getCurriculumForPlanType(planType);
	const units = Array.from({ length: DEFAULT_UNIT_COUNT }, (_, i) => createQuickPlanUnit(i + 1));
	const cols = totalAssessmentColumns(units);

	return {
		id: createId('quick-plan'),
		planType,
		title: curriculum.label,
		createdAt: new Date().toISOString(),
		modifiedAt: new Date().toISOString(),
		units,
		contentInclusions: curriculum.contentDescriptors.map((cd) => ({
			contentDescriptorId: cd.id,
			assessmentInclusions: Array(cols).fill(false)
		}))
	};
}

export function syncQuickPlanColumns(plan: QuickLevelPlan): QuickLevelPlan {
	const units = plan.units.map((unit) => ({
		...unit,
		duration: unit.duration ?? '',
		assessments:
			unit.assessments.length > 0
				? [...unit.assessments]
				: [createQuickPlanAssessment('Assessment 1')]
	}));
	const cols = totalAssessmentColumns(units);

	const contentInclusions = plan.contentInclusions.map((row) => {
		const inclusions = [...row.assessmentInclusions];
		while (inclusions.length < cols) inclusions.push(false);
		return {
			contentDescriptorId: row.contentDescriptorId,
			assessmentInclusions: inclusions.slice(0, cols)
		};
	});

	return { ...plan, units, contentInclusions };
}

export function addQuickPlanUnit(plan: QuickLevelPlan): QuickLevelPlan {
	const next = {
		...plan,
		units: [...plan.units, createQuickPlanUnit(plan.units.length + 1)]
	};
	return syncQuickPlanColumns(next);
}

export function removeQuickPlanUnit(plan: QuickLevelPlan, unitIndex: number): QuickLevelPlan {
	if (plan.units.length <= 1) return plan;

	const startCol = assessmentColumnIndex(plan.units, unitIndex, 0);
	const columnCount = plan.units[unitIndex].assessments.length;
	const units = plan.units.filter((_, i) => i !== unitIndex);
	const contentInclusions = plan.contentInclusions.map((row) => ({
		...row,
		assessmentInclusions: row.assessmentInclusions.filter(
			(_, col) => col < startCol || col >= startCol + columnCount
		)
	}));

	return syncQuickPlanColumns({ ...plan, units, contentInclusions });
}

export function addQuickPlanAssessment(plan: QuickLevelPlan, unitIndex: number): QuickLevelPlan {
	const units = plan.units.map((unit, ui) => {
		if (ui !== unitIndex) return unit;
		const nextNum = unit.assessments.length + 1;
		return {
			...unit,
			assessments: [...unit.assessments, createQuickPlanAssessment(`Assessment ${nextNum}`)]
		};
	});
	const insertCol = assessmentColumnIndex(units, unitIndex, units[unitIndex].assessments.length - 1);
	const contentInclusions = plan.contentInclusions.map((row) => {
		const inclusions = [...row.assessmentInclusions];
		inclusions.splice(insertCol, 0, false);
		return { ...row, assessmentInclusions: inclusions };
	});

	return syncQuickPlanColumns({ ...plan, units, contentInclusions });
}

export function removeQuickPlanAssessment(
	plan: QuickLevelPlan,
	unitIndex: number,
	assessmentIndex: number
): QuickLevelPlan {
	const unit = plan.units[unitIndex];
	if (!unit || unit.assessments.length <= MIN_ASSESSMENTS_PER_UNIT) return plan;

	const removeCol = assessmentColumnIndex(plan.units, unitIndex, assessmentIndex);
	const units = plan.units.map((currentUnit, ui) => {
		if (ui !== unitIndex) return currentUnit;
		return {
			...currentUnit,
			assessments: currentUnit.assessments.filter((_, ai) => ai !== assessmentIndex)
		};
	});
	const contentInclusions = plan.contentInclusions.map((row) => ({
		...row,
		assessmentInclusions: row.assessmentInclusions.filter((_, col) => col !== removeCol)
	}));

	return syncQuickPlanColumns({ ...plan, units, contentInclusions });
}

export function clearAssessmentColumn(
	plan: QuickLevelPlan,
	unitIndex: number,
	assessmentIndex: number
): QuickLevelPlan {
	const col = assessmentColumnIndex(plan.units, unitIndex, assessmentIndex);
	const contentInclusions = plan.contentInclusions.map((row) => {
		if (col >= row.assessmentInclusions.length) return row;
		const inclusions = [...row.assessmentInclusions];
		inclusions[col] = false;
		return { ...row, assessmentInclusions: inclusions };
	});

	return { ...plan, contentInclusions };
}

export function contentDescriptorsFromLevelPlan(levelPlan: LevelPlan): CurriculumContentDescriptor[] {
	return levelPlan.contentDescriptions.map((row) => {
		const strandVal = row.strand.value;
		const isCategory =
			strandVal === 'Knowledge and understanding' ||
			strandVal === 'Processes and production skills';

		return {
			id: row.code.value || row.id,
			category: isCategory ? strandVal : 'Content descriptions',
			strand: isCategory ? row.subStrand.value : strandVal,
			subStrand: isCategory ? '' : row.subStrand.value,
			text: row.text.value,
			code: row.code.value
		};
	});
}

function descriptorMatchesCode(cd: CurriculumContentDescriptor, code: string): boolean {
	const normalized = code.trim();
	if (!normalized) return false;
	return cd.id === normalized || cd.code === normalized;
}

function unitContentDescriptionFromCurriculum(
	cd: CurriculumContentDescriptor
): UnitAssessmentContentDescription {
	const isCategory =
		cd.category === 'Knowledge and understanding' ||
		cd.category === 'Processes and production skills';

	return {
		id: createId('ucd'),
		strand: aiField(isCategory ? cd.category : cd.strand || cd.category),
		subStrand: aiField(isCategory ? cd.strand : cd.subStrand),
		text: aiField(cd.text),
		code: aiField(cd.code || cd.id)
	};
}

function unitPlanAssessmentForQuickAssessment(
	quickAssessment: QuickPlanAssessment,
	assessmentIndex: number,
	levelAssessment: LevelPlanAssessment | undefined,
	unitPlan: UnitPlan
) {
	if (levelAssessment?.id) {
		const byLevelId = unitPlan.assessments.find((assessment) => assessment.id === levelAssessment.id);
		if (byLevelId) return byLevelId;
	}

	const byQuickId = unitPlan.assessments.find((assessment) => assessment.id === quickAssessment.id);
	if (byQuickId) return byQuickId;

	const title = quickAssessment.title.trim().toLowerCase();
	if (title) {
		const byTitle = unitPlan.assessments.find(
			(assessment) => String(assessment.title.value).trim().toLowerCase() === title
		);
		if (byTitle) return byTitle;
	}

	return unitPlan.assessments[assessmentIndex];
}

export function refreshQuickPlanContentInclusionsFromUnitPlans(
	plan: QuickLevelPlan,
	levelPlan: LevelPlan,
	unitPlans: UnitPlan[]
): QuickLevelPlan {
	const curriculum = getCurriculumForPlanType(plan.planType);
	const descriptors =
		curriculum.contentDescriptors.length > 0
			? curriculum.contentDescriptors
			: contentDescriptorsFromLevelPlan(levelPlan);

	return {
		...plan,
		contentInclusions: buildContentInclusionsFromLevelPlan(
			levelPlan,
			descriptors,
			plan.units,
			unitPlans
		)
	};
}

export function buildContentInclusionsFromLevelPlan(
	levelPlan: LevelPlan,
	descriptors: CurriculumContentDescriptor[],
	units: QuickPlanUnit[],
	unitPlans: UnitPlan[] = []
): QuickPlanContentInclusion[] {
	const cols = totalAssessmentColumns(units);

	return descriptors.map((cd) => {
		const assessmentInclusions = Array(cols).fill(false);

		for (let ui = 0; ui < units.length; ui++) {
			const unitPlan = unitPlans.length
				? unitPlanForLevelIndex(levelPlan.units[ui], ui, unitPlans)
				: undefined;
			if (!unitPlan) continue;

			for (let ai = 0; ai < units[ui].assessments.length; ai++) {
				const assessment = unitPlanAssessmentForQuickAssessment(
					units[ui].assessments[ai],
					ai,
					levelPlan.units[ui]?.assessments[ai],
					unitPlan
				);
				if (!assessment) continue;

				const included = assessment.contentDescriptions.some((row) =>
					descriptorMatchesCode(cd, String(row.code.value))
				);
				if (included) {
					assessmentInclusions[assessmentColumnIndex(units, ui, ai)] = true;
				}
			}
		}

		return { contentDescriptorId: cd.id, assessmentInclusions };
	});
}

export function inferQuickPlanType(
	learningAreaSubject: string,
	yearLevelBand: string
): QuickPlanType | null {
	const subject = learningAreaSubject.toLowerCase();
	const band = yearLevelBand.toLowerCase().replace(/–/g, '-');

	if (subject.includes('engineering') && band.includes('10')) return '10-engineering';
	if (subject.includes('digital') && (band.includes('7') || band.includes('8'))) {
		return '7-8-digital-technologies';
	}
	if (subject.includes('design') && (band.includes('9') || band.includes('10'))) {
		return '9-10-design';
	}
	if (subject.includes('digital') && (band.includes('9') || band.includes('10'))) {
		return '9-10-digital-technologies';
	}
	return null;
}

export function inferQuickPlanTypeFromTitle(bandSubjectTitle: string): QuickPlanType | null {
	const title = bandSubjectTitle.toLowerCase().replace(/–/g, '-');
	if (title.includes('engineering') && title.includes('10')) return '10-engineering';
	if (title.includes('digital') && (title.includes('7-8') || title.includes('7') || title.includes('8'))) {
		return '7-8-digital-technologies';
	}
	if (title.includes('design') && (title.includes('9-10') || title.includes('9') || title.includes('10'))) {
		return '9-10-design';
	}
	if (title.includes('digital') && (title.includes('9-10') || title.includes('9') || title.includes('10'))) {
		return '9-10-digital-technologies';
	}
	return null;
}

function quickPlanAssessmentsFromLevelUnit(
	assessments: LevelPlanUnit['assessments']
): QuickPlanAssessment[] {
	if (assessments.length === 0) {
		return [createQuickPlanAssessment('Assessment 1'), createQuickPlanAssessment('Assessment 2')];
	}

	return assessments.map((assessment, assessmentIndex) => ({
		id: assessment.id || createId('qassess'),
		title: assessment.title.value || `Assessment ${assessmentIndex + 1}`,
		description: assessment.description.value || ''
	}));
}

export function importLevelPlanToQuickPlan(
	levelPlan: LevelPlan,
	planType: QuickPlanType,
	sourceLevelPlanId: string,
	existing?: QuickLevelPlan,
	unitPlans: UnitPlan[] = []
): QuickLevelPlan {
	const curriculum = getCurriculumForPlanType(planType);
	const descriptors =
		curriculum.contentDescriptors.length > 0
			? curriculum.contentDescriptors
			: contentDescriptorsFromLevelPlan(levelPlan);

	const units: QuickPlanUnit[] = levelPlan.units.map((unit, unitIndex) => ({
		id: unit.id || createId('qunit'),
		title: unit.unitTitle.value || `Unit ${unitIndex + 1}`,
		description: unit.description.value,
		duration: String(unit.duration.value || ''),
		assessments: quickPlanAssessmentsFromLevelUnit(unit.assessments)
	}));

	const contentInclusions = buildContentInclusionsFromLevelPlan(
		levelPlan,
		descriptors,
		units,
		unitPlans
	);

	const now = new Date().toISOString();
	return {
		id: existing?.id || createId('quick-plan'),
		planType,
		title: levelPlan.bandSubjectTitle.value || curriculum.label,
		sourceLevelPlanId,
		createdAt: existing?.createdAt || now,
		modifiedAt: now,
		units,
		contentInclusions
	};
}

function syncLevelPlanMatrixColumns(levelPlan: LevelPlan) {
	const count = levelPlan.units.length;
	for (const row of levelPlan.contentDescriptions) {
		while (row.unitInclusions.length < count) row.unitInclusions.push(false);
		row.unitInclusions = row.unitInclusions.slice(0, count);
	}
	for (const row of levelPlan.generalCapabilities) {
		syncCapabilityRowColumns(row, count);
	}
	for (const row of levelPlan.crossCurriculumPriorities) {
		while (row.unitInclusions.length < count) row.unitInclusions.push(false);
		row.unitInclusions = row.unitInclusions.slice(0, count);
	}
}

function createLevelPlanAssessment(
	quickAssessment: QuickPlanAssessment,
	assessmentIndex: number
): LevelPlanAssessment {
	return {
		id: quickAssessment.id || createId('assess'),
		assessmentNumber: aiField(assessmentIndex + 1),
		title: aiField(quickAssessment.title),
		term: aiField(''),
		week: aiField(''),
		description: aiField(quickAssessment.description),
		technique: aiField(''),
		mode: aiField(''),
		conditions: aiField(''),
		achievementStandard: aiField(''),
		moderation: aiField('')
	};
}

function applyQuickUnitToLevelUnit(quickUnit: QuickPlanUnit, levelUnit: LevelPlanUnit) {
	levelUnit.unitTitle.value = quickUnit.title;
	levelUnit.description.value = quickUnit.description;
	if (quickUnit.duration.trim()) {
		levelUnit.duration.value = quickUnit.duration.trim();
	}

	for (let assessmentIndex = 0; assessmentIndex < quickUnit.assessments.length; assessmentIndex++) {
		const quickAssessment = quickUnit.assessments[assessmentIndex];
		const existing = levelUnit.assessments[assessmentIndex];
		if (existing) {
			existing.title.value = quickAssessment.title;
			existing.description.value = quickAssessment.description;
			continue;
		}
		levelUnit.assessments.push(createLevelPlanAssessment(quickAssessment, assessmentIndex));
	}

	levelUnit.assessments = levelUnit.assessments.slice(0, quickUnit.assessments.length);
}

function quickInclusionForLevelRow(
	quickPlan: QuickLevelPlan,
	lpRow: ContentDescriptionRow,
	descriptors: CurriculumContentDescriptor[]
): QuickPlanContentInclusion | undefined {
	const code = String(lpRow.code.value).trim();
	const rowId = String(lpRow.id).trim();

	return quickPlan.contentInclusions.find((row) => {
		if (row.contentDescriptorId === code || row.contentDescriptorId === rowId) return true;
		const descriptor = descriptors.find((cd) => cd.id === row.contentDescriptorId);
		return Boolean(descriptor && (descriptor.code === code || descriptor.id === code));
	});
}

function unitIncludedInQuickPlan(
	quickRow: QuickPlanContentInclusion | undefined,
	units: QuickPlanUnit[],
	unitIndex: number
): boolean {
	if (!quickRow) return false;
	const unit = units[unitIndex];
	return unit.assessments.some(
		(_, assessmentIndex) =>
			quickRow.assessmentInclusions[assessmentColumnIndex(units, unitIndex, assessmentIndex)]
	);
}

function applyQuickPlanContentInclusionsToLevelPlan(
	levelPlan: LevelPlan,
	quickPlan: QuickLevelPlan,
	descriptors: CurriculumContentDescriptor[]
) {
	syncLevelPlanMatrixColumns(levelPlan);

	for (const lpRow of levelPlan.contentDescriptions) {
		const quickRow = quickInclusionForLevelRow(quickPlan, lpRow, descriptors);
		for (let unitIndex = 0; unitIndex < quickPlan.units.length; unitIndex++) {
			lpRow.unitInclusions[unitIndex] = unitIncludedInQuickPlan(
				quickRow,
				quickPlan.units,
				unitIndex
			);
		}
	}
}

export function applyQuickPlanContentInclusionsToUnitPlans(
	quickPlan: QuickLevelPlan,
	levelPlan: LevelPlan,
	unitPlans: UnitPlan[],
	descriptors: CurriculumContentDescriptor[]
) {
	for (let unitIndex = 0; unitIndex < quickPlan.units.length; unitIndex++) {
		const unitPlan = unitPlanForLevelIndex(levelPlan.units[unitIndex], unitIndex, unitPlans);
		if (!unitPlan) continue;

		for (let assessmentIndex = 0; assessmentIndex < quickPlan.units[unitIndex].assessments.length; assessmentIndex++) {
			const assessment = unitPlanAssessmentForQuickAssessment(
				quickPlan.units[unitIndex].assessments[assessmentIndex],
				assessmentIndex,
				levelPlan.units[unitIndex]?.assessments[assessmentIndex],
				unitPlan
			);
			if (!assessment) continue;

			const selected = getSelectedDescriptorsForAssessment(
				quickPlan,
				descriptors,
				unitIndex,
				assessmentIndex
			);
			assessment.contentDescriptions = selected.map(unitContentDescriptionFromCurriculum);
		}
	}
}

export function exportQuickPlanToLevelPlan(
	quickPlan: QuickLevelPlan,
	levelPlan: LevelPlan,
	descriptors: CurriculumContentDescriptor[]
) {
	if (quickPlan.title.trim()) {
		levelPlan.bandSubjectTitle.value = quickPlan.title.trim();
	}

	while (levelPlan.units.length < quickPlan.units.length) {
		const unitIndex = levelPlan.units.length;
		const quickUnit = quickPlan.units[unitIndex];
		levelPlan.units.push({
			id: quickUnit.id || createId('unit'),
			unitTitle: aiField(quickUnit.title || `Unit ${unitIndex + 1}`),
			yearLevel: aiField(''),
			duration: aiField(quickUnit.duration || ''),
			description: aiField(quickUnit.description),
			assessments: []
		});
	}

	syncLevelPlanMatrixColumns(levelPlan);

	for (let unitIndex = 0; unitIndex < quickPlan.units.length; unitIndex++) {
		applyQuickUnitToLevelUnit(quickPlan.units[unitIndex], levelPlan.units[unitIndex]);
	}

	applyQuickPlanContentInclusionsToLevelPlan(levelPlan, quickPlan, descriptors);
}

export function getSelectedDescriptorsForUnit(
	plan: QuickLevelPlan,
	descriptors: CurriculumContentDescriptor[],
	unitIndex: number
) {
	return descriptors.filter((cd) => {
		const row = plan.contentInclusions.find((r) => r.contentDescriptorId === cd.id);
		if (!row) return false;
		const unit = plan.units[unitIndex];
		return unit.assessments.some(
			(_, ai) => row.assessmentInclusions[assessmentColumnIndex(plan.units, unitIndex, ai)]
		);
	});
}

export function getSelectedDescriptorsForAssessment(
	plan: QuickLevelPlan,
	descriptors: CurriculumContentDescriptor[],
	unitIndex: number,
	assessmentIndex: number
) {
	return descriptors.filter((cd) => {
		const row = plan.contentInclusions.find((r) => r.contentDescriptorId === cd.id);
		if (!row) return false;
		return row.assessmentInclusions[assessmentColumnIndex(plan.units, unitIndex, assessmentIndex)];
	});
}
