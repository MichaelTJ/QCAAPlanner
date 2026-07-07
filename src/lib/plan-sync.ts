import { assessmentTimingFromLevelPlan, createId } from '$lib/defaults';
import {
	applyDurationToUnitWeeks,
	resolveDurationForLevelPlanSync
} from '$lib/unit-duration';
import {
	applyUnitPlanCapabilitiesToLevelPlan,
	ensureUnitCapabilityChecks,
	formatCheckedSubElements,
	getCapabilityDefinition,
	syncCapabilityRowColumns,
	unitPlanForLevelIndex
} from '$lib/general-capabilities';
import {
	aiField,
	cloneAiField,
	type LevelPlan,
	type LevelPlanAssessment,
	type LevelPlanUnit,
	type UnitAssessment,
	type UnitPlan
} from '$lib/types';

export { unitPlanForLevelIndex };

function ensureUnitPlanDuration(unitPlan: UnitPlan) {
	if (!unitPlan.duration) {
		unitPlan.duration = aiField('');
	}
	return unitPlan.duration;
}

export function levelPlanTimingFromUnitAssessment(timing: string): {
	term: number | '';
	week: number | '';
} {
	const termMatch = timing.match(/Term\s*(\d+)/i);
	const weekMatch = timing.match(/Week\s*(\d+)/i);
	return {
		term: termMatch ? Number(termMatch[1]) : '',
		week: weekMatch ? Number(weekMatch[1]) : ''
	};
}

export function applyLevelPlanUnitFieldsToUnitPlan(
	levelUnit: LevelPlanUnit,
	unitPlan: UnitPlan,
	levelPlan: LevelPlan,
	unitIndex: number
) {
	unitPlan.unitNumber.value = unitIndex + 1;
	unitPlan.unitTitle = cloneAiField(levelUnit.unitTitle);
	unitPlan.yearLevel = cloneAiField(levelUnit.yearLevel);
	unitPlan.unitDescription = cloneAiField(levelUnit.description);
	unitPlan.subject = cloneAiField(levelPlan.bandSubjectTitle);
	unitPlan.year = cloneAiField(levelPlan.year);
	unitPlan.cohortAndClassConsiderations = cloneAiField(levelPlan.contextAndCohortConsiderations);
	ensureUnitPlanDuration(unitPlan).value = String(levelUnit.duration.value || '');
	const weeks = applyDurationToUnitWeeks(
		String(levelUnit.duration.value),
		String(unitPlan.startWeek.value),
		String(unitPlan.finishWeek.value)
	);
	unitPlan.startWeek.value = weeks.startWeek;
	unitPlan.finishWeek.value = weeks.finishWeek;
	unitPlan.assessments = syncAssessmentsLevelToUnit(
		levelUnit.assessments,
		unitPlan.assessments,
		levelUnit.yearLevel.value
	);
}

export function applyUnitPlanFieldsToLevelPlanUnit(unitPlan: UnitPlan, levelUnit: LevelPlanUnit) {
	levelUnit.unitTitle = cloneAiField(unitPlan.unitTitle);
	levelUnit.yearLevel = cloneAiField(unitPlan.yearLevel);
	levelUnit.description = cloneAiField(unitPlan.unitDescription);
	ensureUnitPlanDuration(unitPlan);
	if (String(unitPlan.duration.value).trim()) {
		const weeks = applyDurationToUnitWeeks(
			String(unitPlan.duration.value),
			String(unitPlan.startWeek.value),
			String(unitPlan.finishWeek.value)
		);
		unitPlan.startWeek.value = weeks.startWeek;
		unitPlan.finishWeek.value = weeks.finishWeek;
	}
	levelUnit.duration.value = resolveDurationForLevelPlanSync(
		String(unitPlan.duration.value),
		String(unitPlan.startWeek.value),
		String(unitPlan.finishWeek.value),
		String(levelUnit.duration.value)
	);
	if (!String(unitPlan.duration.value).trim() && levelUnit.duration.value) {
		unitPlan.duration.value = levelUnit.duration.value;
	}
	levelUnit.assessments = syncAssessmentsUnitToLevel(unitPlan.assessments, levelUnit.assessments);
}

export function syncAssessmentsLevelToUnit(
	levelAssessments: LevelPlanAssessment[],
	unitAssessments: UnitAssessment[],
	yearLevel: number | '' = ''
): UnitAssessment[] {
	return levelAssessments.map((levelAssessment, index) => {
		const existing = unitAssessments[index];
		if (existing) {
			return {
				...existing,
				assessmentNumber: cloneAiField(levelAssessment.assessmentNumber),
				yearLevel: aiField(yearLevel),
				title: cloneAiField(levelAssessment.title),
				description: cloneAiField(levelAssessment.description),
				technique: cloneAiField(levelAssessment.technique),
				mode: cloneAiField(levelAssessment.mode),
				conditions: cloneAiField(levelAssessment.conditions),
				timing: aiField(assessmentTimingFromLevelPlan(levelAssessment)),
				achievementStandard: cloneAiField(levelAssessment.achievementStandard),
				moderation: cloneAiField(levelAssessment.moderation)
			};
		}

		return {
			id: createId('uassess'),
			assessmentNumber: cloneAiField(levelAssessment.assessmentNumber),
			yearLevel: aiField(yearLevel),
			title: cloneAiField(levelAssessment.title),
			description: cloneAiField(levelAssessment.description),
			technique: cloneAiField(levelAssessment.technique),
			mode: cloneAiField(levelAssessment.mode),
			conditions: cloneAiField(levelAssessment.conditions),
			timing: aiField(assessmentTimingFromLevelPlan(levelAssessment)),
			achievementStandard: cloneAiField(levelAssessment.achievementStandard),
			moderation: cloneAiField(levelAssessment.moderation),
			contentDescriptions: []
		};
	});
}

export function syncAssessmentsUnitToLevel(
	unitAssessments: UnitAssessment[],
	levelAssessments: LevelPlanAssessment[]
): LevelPlanAssessment[] {
	return unitAssessments.map((unitAssessment, index) => {
		const timing = levelPlanTimingFromUnitAssessment(String(unitAssessment.timing.value));
		const existing = levelAssessments[index];
		if (existing) {
			return {
				...existing,
				assessmentNumber: cloneAiField(unitAssessment.assessmentNumber),
				title: cloneAiField(unitAssessment.title),
				term: aiField(timing.term),
				week: aiField(timing.week),
				description: cloneAiField(unitAssessment.description),
				technique: cloneAiField(unitAssessment.technique),
				mode: cloneAiField(unitAssessment.mode),
				conditions: cloneAiField(unitAssessment.conditions),
				achievementStandard: cloneAiField(unitAssessment.achievementStandard),
				moderation: cloneAiField(unitAssessment.moderation)
			};
		}

		return {
			id: createId('assess'),
			assessmentNumber: cloneAiField(unitAssessment.assessmentNumber),
			title: cloneAiField(unitAssessment.title),
			term: aiField(timing.term),
			week: aiField(timing.week),
			description: cloneAiField(unitAssessment.description),
			technique: cloneAiField(unitAssessment.technique),
			mode: cloneAiField(unitAssessment.mode),
			conditions: cloneAiField(unitAssessment.conditions),
			achievementStandard: cloneAiField(unitAssessment.achievementStandard),
			moderation: cloneAiField(unitAssessment.moderation)
		};
	});
}

export function applyUnitContentDescriptionsToLevelPlanColumn(
	levelPlan: LevelPlan,
	unitPlan: UnitPlan,
	unitIndex: number
) {
	for (const row of levelPlan.contentDescriptions) {
		if (row.unitInclusions[unitIndex] !== undefined) {
			row.unitInclusions[unitIndex] = false;
		}
	}

	const codes = new Set<string>();
	for (const assessment of unitPlan.assessments) {
		for (const cd of assessment.contentDescriptions) {
			const code = String(cd.code.value).trim();
			if (code) codes.add(code);
		}
	}
	if (codes.size === 0) return;

	for (const row of levelPlan.contentDescriptions) {
		const code = String(row.code.value).trim();
		if (code && codes.has(code)) {
			row.unitInclusions[unitIndex] = true;
		}
	}
}

export function clearLevelPlanSlotMatrix(levelPlan: LevelPlan, unitIndex: number) {
	const unitCount = levelPlan.units.length;
	for (const row of levelPlan.contentDescriptions) {
		if (row.unitInclusions[unitIndex] !== undefined) {
			row.unitInclusions[unitIndex] = false;
		}
	}
	for (const row of levelPlan.generalCapabilities) {
		syncCapabilityRowColumns(row, unitCount);
		row.unitInclusions[unitIndex] = false;
		if (row.categoryInclusions) {
			for (const key of Object.keys(row.categoryInclusions)) {
				row.categoryInclusions[key][unitIndex] = false;
			}
		}
		if (row.subElementInclusions) {
			for (const key of Object.keys(row.subElementInclusions)) {
				row.subElementInclusions[key][unitIndex] = false;
			}
		}
	}
	for (const row of levelPlan.crossCurriculumPriorities) {
		while (row.unitInclusions.length < unitCount) row.unitInclusions.push(false);
		row.unitInclusions = row.unitInclusions.slice(0, unitCount);
		row.unitInclusions[unitIndex] = false;
	}
}

export function applyUnitPlanToLevelPlan(
	levelPlan: LevelPlan,
	unitPlan: UnitPlan,
	unitIndex: number
) {
	if (unitIndex < 0 || unitIndex >= levelPlan.units.length) return;
	applyUnitPlanFieldsToLevelPlanUnit(unitPlan, levelPlan.units[unitIndex]);
	applyUnitPlanCapabilitiesToLevelPlan(levelPlan, unitPlan, unitIndex);
	applyUnitContentDescriptionsToLevelPlanColumn(levelPlan, unitPlan, unitIndex);
}

export function applyLevelPlanUnitToUnitPlan(
	levelPlan: LevelPlan,
	levelUnit: LevelPlanUnit,
	unitPlan: UnitPlan,
	unitIndex: number
) {
	if (unitIndex < 0 || unitIndex >= levelPlan.units.length) return;
	unitPlan.unitNumber.value = unitIndex + 1;
	applyLevelPlanUnitFieldsToUnitPlan(levelUnit, unitPlan, levelPlan, unitIndex);
}

/** Overlay unit plan content onto the level plan for display and export. */
export function syncUnitPlansIntoLevelPlan(levelPlan: LevelPlan, unitPlans: UnitPlan[]) {
	for (let unitIndex = 0; unitIndex < levelPlan.units.length; unitIndex++) {
		const unitPlan = unitPlanForLevelIndex(levelPlan.units[unitIndex], unitIndex, unitPlans);
		if (unitPlan) applyUnitPlanToLevelPlan(levelPlan, unitPlan, unitIndex);
	}
}

/** Push level plan unit content into linked unit plans. */
export function syncLevelPlanIntoUnitPlans(levelPlan: LevelPlan, unitPlans: UnitPlan[]): UnitPlan[] {
	const updated: UnitPlan[] = [];
	for (let unitIndex = 0; unitIndex < levelPlan.units.length; unitIndex++) {
		const unitPlan = unitPlanForLevelIndex(levelPlan.units[unitIndex], unitIndex, unitPlans);
		if (!unitPlan) continue;
		applyLevelPlanUnitToUnitPlan(levelPlan, levelPlan.units[unitIndex], unitPlan, unitIndex);
		applyLevelPlanCapabilitiesToUnitPlan(levelPlan, unitPlan, unitIndex);
		updated.push(unitPlan);
	}
	return updated;
}

export function applyLevelPlanCapabilitiesToUnitPlan(
	levelPlan: LevelPlan,
	unitPlan: UnitPlan,
	unitIndex: number
) {
	for (const unitCap of unitPlan.generalCapabilities) {
		const levelRow = levelPlan.generalCapabilities.find(
			(row) => row.name.value === unitCap.name.value
		);
		if (!levelRow) continue;

		const checks = ensureUnitCapabilityChecks(unitCap);
		const def = getCapabilityDefinition(unitCap.name.value);
		if (!def) continue;

		for (const category of def.categories) {
			for (const sub of category.subElements) {
				checks[sub.id] = Boolean(levelRow.subElementInclusions?.[sub.id]?.[unitIndex]);
			}
		}
		unitCap.subElements.value = formatCheckedSubElements(unitCap.name.value, checks);
	}
}


export function resetLevelPlanUnitSlot(unit: LevelPlanUnit, unitNumber: number): LevelPlanUnit {
	return {
		id: unit.id,
		unitTitle: aiField(`Unit ${unitNumber}`),
		yearLevel: aiField(''),
		duration: aiField(''),
		description: aiField(''),
		assessments: []
	};
}

export function orphanedUnitPlans(levelPlan: LevelPlan, unitPlans: UnitPlan[]): UnitPlan[] {
	const matchedIds = new Set<string>();
	for (let unitIndex = 0; unitIndex < levelPlan.units.length; unitIndex++) {
		const unitPlan = unitPlanForLevelIndex(levelPlan.units[unitIndex], unitIndex, unitPlans);
		if (unitPlan) matchedIds.add(unitPlan.id);
	}
	return unitPlans.filter((plan) => !matchedIds.has(plan.id));
}

function moveArrayElement<T>(array: T[], fromIndex: number, toIndex: number): T[] {
	if (fromIndex === toIndex) return array;
	const next = [...array];
	const [item] = next.splice(fromIndex, 1);
	next.splice(toIndex, 0, item);
	return next;
}

function moveMatrixColumn(columns: boolean[], fromIndex: number, toIndex: number): boolean[] {
	return moveArrayElement(columns, fromIndex, toIndex);
}

export function reorderLevelPlanUnits(levelPlan: LevelPlan, fromIndex: number, toIndex: number) {
	if (fromIndex === toIndex) return;
	if (fromIndex < 0 || fromIndex >= levelPlan.units.length) {
		throw new Error('Invalid source unit index');
	}
	if (toIndex < 0 || toIndex >= levelPlan.units.length) {
		throw new Error('Invalid target unit index');
	}

	levelPlan.units = moveArrayElement(levelPlan.units, fromIndex, toIndex);

	for (const row of levelPlan.contentDescriptions) {
		row.unitInclusions = moveMatrixColumn(row.unitInclusions, fromIndex, toIndex);
	}

	for (const row of levelPlan.generalCapabilities) {
		row.unitInclusions = moveMatrixColumn(row.unitInclusions, fromIndex, toIndex);
		if (row.categoryInclusions) {
			for (const key of Object.keys(row.categoryInclusions)) {
				row.categoryInclusions[key] = moveMatrixColumn(
					row.categoryInclusions[key],
					fromIndex,
					toIndex
				);
			}
		}
		if (row.subElementInclusions) {
			for (const key of Object.keys(row.subElementInclusions)) {
				row.subElementInclusions[key] = moveMatrixColumn(
					row.subElementInclusions[key],
					fromIndex,
					toIndex
				);
			}
		}
	}

	for (const row of levelPlan.crossCurriculumPriorities) {
		row.unitInclusions = moveMatrixColumn(row.unitInclusions, fromIndex, toIndex);
	}

	for (let index = 0; index < levelPlan.units.length; index++) {
		const title = String(levelPlan.units[index].unitTitle.value);
		if (/^Unit \d+$/.test(title)) {
			levelPlan.units[index].unitTitle.value = `Unit ${index + 1}`;
		}
	}
}

export function insertLevelPlanUnitColumnAfter(
	levelPlan: LevelPlan,
	sourceIndex: number,
	newUnit: LevelPlanUnit
) {
	if (sourceIndex < 0 || sourceIndex >= levelPlan.units.length) {
		throw new Error('Invalid source unit index');
	}

	const insertAt = sourceIndex + 1;
	levelPlan.units = [
		...levelPlan.units.slice(0, insertAt),
		newUnit,
		...levelPlan.units.slice(insertAt)
	];

	for (const row of levelPlan.contentDescriptions) {
		const sourceValue = row.unitInclusions[sourceIndex] ?? false;
		row.unitInclusions = [
			...row.unitInclusions.slice(0, insertAt),
			sourceValue,
			...row.unitInclusions.slice(insertAt)
		];
	}

	for (const row of levelPlan.generalCapabilities) {
		const sourceValue = row.unitInclusions[sourceIndex] ?? false;
		row.unitInclusions = [
			...row.unitInclusions.slice(0, insertAt),
			sourceValue,
			...row.unitInclusions.slice(insertAt)
		];
		if (row.categoryInclusions) {
			for (const key of Object.keys(row.categoryInclusions)) {
				const sourceCategoryValue = row.categoryInclusions[key][sourceIndex] ?? false;
				row.categoryInclusions[key] = [
					...row.categoryInclusions[key].slice(0, insertAt),
					sourceCategoryValue,
					...row.categoryInclusions[key].slice(insertAt)
				];
			}
		}
		if (row.subElementInclusions) {
			for (const key of Object.keys(row.subElementInclusions)) {
				const sourceSubValue = row.subElementInclusions[key][sourceIndex] ?? false;
				row.subElementInclusions[key] = [
					...row.subElementInclusions[key].slice(0, insertAt),
					sourceSubValue,
					...row.subElementInclusions[key].slice(insertAt)
				];
			}
		}
		syncCapabilityRowColumns(row, levelPlan.units.length);
	}

	for (const row of levelPlan.crossCurriculumPriorities) {
		const sourceValue = row.unitInclusions[sourceIndex] ?? false;
		row.unitInclusions = [
			...row.unitInclusions.slice(0, insertAt),
			sourceValue,
			...row.unitInclusions.slice(insertAt)
		];
	}
}

export function removeLevelPlanUnitColumn(levelPlan: LevelPlan, unitIndex: number) {
	if (levelPlan.units.length <= 1) {
		throw new Error('At least one unit column is required');
	}
	if (unitIndex < 0 || unitIndex >= levelPlan.units.length) {
		throw new Error('Invalid unit column');
	}

	levelPlan.units = levelPlan.units.filter((_, index) => index !== unitIndex);
	const unitCount = levelPlan.units.length;

	for (const row of levelPlan.contentDescriptions) {
		row.unitInclusions = row.unitInclusions.filter((_, index) => index !== unitIndex);
		while (row.unitInclusions.length < unitCount) row.unitInclusions.push(false);
	}

	for (const row of levelPlan.generalCapabilities) {
		row.unitInclusions = row.unitInclusions.filter((_, index) => index !== unitIndex);
		if (row.categoryInclusions) {
			for (const key of Object.keys(row.categoryInclusions)) {
				row.categoryInclusions[key] = row.categoryInclusions[key].filter(
					(_, index) => index !== unitIndex
				);
			}
		}
		if (row.subElementInclusions) {
			for (const key of Object.keys(row.subElementInclusions)) {
				row.subElementInclusions[key] = row.subElementInclusions[key].filter(
					(_, index) => index !== unitIndex
				);
			}
		}
		syncCapabilityRowColumns(row, unitCount);
	}

	for (const row of levelPlan.crossCurriculumPriorities) {
		row.unitInclusions = row.unitInclusions.filter((_, index) => index !== unitIndex);
		while (row.unitInclusions.length < unitCount) row.unitInclusions.push(false);
	}

	for (let index = 0; index < levelPlan.units.length; index++) {
		const title = String(levelPlan.units[index].unitTitle.value);
		if (/^Unit \d+$/.test(title)) {
			levelPlan.units[index].unitTitle.value = `Unit ${index + 1}`;
		}
	}
}
