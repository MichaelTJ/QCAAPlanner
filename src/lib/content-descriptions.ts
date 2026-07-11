import { createId } from '$lib/defaults';
import {
	getCurriculumForPlanType,
	inferCurriculumPlanType,
	inferCurriculumPlanTypeFromTitle,
	type CurriculumPlanTypeId
} from '$lib/curriculum/curriculum-catalogue';
import { yearBandFromYearLevel } from '$lib/curriculum-match';
import { aiField, type ContentDescriptionRow, type UnitAssessmentContentDescription } from '$lib/types';

export function descriptorCodeKey(code: string): string {
	return code.trim().toUpperCase();
}

export function assessmentHasContentCode(
	assessmentCds: UnitAssessmentContentDescription[],
	code: string
): boolean {
	const key = descriptorCodeKey(code);
	if (!key) return false;
	return assessmentCds.some((cd) => descriptorCodeKey(String(cd.code.value)) === key);
}

export function resolveCurriculumPlanTypeForUnit(
	subject: string,
	yearLevel: number | ''
): CurriculumPlanTypeId | null {
	const band = yearBandFromYearLevel(yearLevel) || String(yearLevel || '');
	return (
		inferCurriculumPlanType(subject, band) ||
		inferCurriculumPlanTypeFromTitle(`${subject} ${band}`)
	);
}

export interface PickerContentDescriptor {
	id: string;
	strand: string;
	subStrand: string;
	text: string;
	code: string;
}

/** Prefer curriculum catalogue; fall back to level-plan content description rows. */
export function resolveContentDescriptorsForUnit(options: {
	subject: string;
	yearLevel: number | '';
	levelPlanContentDescriptions?: ContentDescriptionRow[];
}): PickerContentDescriptor[] {
	const planType = resolveCurriculumPlanTypeForUnit(options.subject, options.yearLevel);
	if (planType) {
		const curriculum = getCurriculumForPlanType(planType);
		if (curriculum.contentDescriptors.length) {
			return curriculum.contentDescriptors.map((cd) => {
				const isCategory =
					cd.category === 'Knowledge and understanding' ||
					cd.category === 'Processes and production skills';
				return {
					id: cd.id,
					strand: isCategory ? cd.category : cd.strand || cd.category,
					subStrand: isCategory ? cd.strand : cd.subStrand,
					text: cd.text,
					code: cd.code || cd.id
				};
			});
		}
	}

	const fromLevel = options.levelPlanContentDescriptions ?? [];
	return fromLevel.map((row) => ({
		id: row.id,
		strand: String(row.strand.value),
		subStrand: String(row.subStrand.value),
		text: String(row.text.value),
		code: String(row.code.value)
	}));
}

export function toggleAssessmentContentDescription(
	assessmentCds: UnitAssessmentContentDescription[],
	descriptor: PickerContentDescriptor,
	checked: boolean
): UnitAssessmentContentDescription[] {
	const key = descriptorCodeKey(descriptor.code);
	if (checked) {
		if (assessmentHasContentCode(assessmentCds, descriptor.code)) return assessmentCds;
		return [
			...assessmentCds,
			{
				id: createId('ucd'),
				strand: aiField(descriptor.strand),
				subStrand: aiField(descriptor.subStrand),
				text: aiField(descriptor.text),
				code: aiField(descriptor.code)
			}
		];
	}
	return assessmentCds.filter((cd) => descriptorCodeKey(String(cd.code.value)) !== key);
}
