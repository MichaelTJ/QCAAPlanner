import { createId } from '$lib/defaults';
import { cloneAiField, type LevelPlan, type LevelPlanUnit, type UnitPlan } from '$lib/types';

export function unitCopyLabel(title: string): string {
	const trimmed = title.trim();
	if (!trimmed) return 'Copy';
	if (/\(copy\)$/i.test(trimmed)) return trimmed;
	return `${trimmed} (copy)`;
}

export function cloneLevelPlanUnit(unit: LevelPlanUnit): LevelPlanUnit {
	return {
		id: createId('unit'),
		unitTitle: cloneAiField(unit.unitTitle),
		yearLevel: cloneAiField(unit.yearLevel),
		duration: cloneAiField(unit.duration),
		description: cloneAiField(unit.description),
		assessments: unit.assessments.map((assessment) => ({
			...structuredClone(assessment),
			id: createId('assess')
		}))
	};
}

export function cloneLevelPlanWithNewIds(plan: LevelPlan, newId: string): LevelPlan {
	return {
		...structuredClone(plan),
		id: newId,
		units: plan.units.map((unit) => ({
			...unit,
			id: createId('unit'),
			assessments: unit.assessments.map((assessment) => ({
				...assessment,
				id: createId('assess')
			}))
		})),
		contentDescriptions: plan.contentDescriptions.map((row) => ({
			...row,
			id: createId('cd')
		})),
		generalCapabilities: plan.generalCapabilities.map((row) => ({
			...row,
			id: createId('cap')
		})),
		crossCurriculumPriorities: plan.crossCurriculumPriorities.map((row) => ({
			...row,
			id: createId('ccp')
		}))
	};
}

export function cloneUnitPlanWithNewIds(plan: UnitPlan, newId: string): UnitPlan {
	return {
		...structuredClone(plan),
		id: newId,
		assessments: plan.assessments.map((assessment) => ({
			...assessment,
			id: createId('uassess'),
			contentDescriptions: assessment.contentDescriptions.map((cd) => ({
				...cd,
				id: createId('ucd')
			}))
		})),
		adjustments: plan.adjustments.map((row) => ({
			...row,
			id: createId('adj')
		})),
		generalCapabilities: plan.generalCapabilities.map((cap) => ({
			...cap,
			id: createId('ucap')
		})),
		teachingSequence: plan.teachingSequence.map((week) => ({
			...week,
			id: createId('week')
		}))
	};
}
