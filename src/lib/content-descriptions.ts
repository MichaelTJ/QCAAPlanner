import { createId } from '$lib/defaults';
import {
	CURRICULUM_PLAN_TYPE_LIST,
	getAchievementStandardForPlanType,
	getCurriculumForPlanType,
	inferCurriculumPlanType,
	inferCurriculumPlanTypeFromTitle,
	type CurriculumContentDescriptor,
	type CurriculumPlanTypeId
} from '$lib/curriculum/curriculum-catalogue';
import { parseYearBandFromText, yearBandFromYearLevel } from '$lib/curriculum-match';
import { aiField, type ContentDescriptionRow, type UnitAssessmentContentDescription } from '$lib/types';

export const KNOWLEDGE_AND_UNDERSTANDING = 'Knowledge and understanding';
export const PROCESSES_AND_PRODUCTION_SKILLS = 'Processes and production skills';

export type ContentDescriptionSide = 'knowledge' | 'processes' | 'other';

export function descriptorCodeKey(code: string): string {
	return code.trim().toUpperCase();
}

/** AC codes like AC9TDE8P01 / AC9TDI10K03 → K or P. */
export function contentDescriptionCodeLetter(code: string): 'K' | 'P' | null {
	const match = code.trim().toUpperCase().match(/\d([KP])\d+$/);
	if (!match) return null;
	return match[1] as 'K' | 'P';
}

/**
 * Classify a content description for Knowledge vs Processes columns.
 * Prefers the category strand name; falls back to the AC code letter when strand
 * holds a context/process-step label (common in Design Technologies sync).
 */
export function contentDescriptionSide(strand: string, code = ''): ContentDescriptionSide {
	const s = strand.trim();
	if (s === KNOWLEDGE_AND_UNDERSTANDING) return 'knowledge';
	if (s === PROCESSES_AND_PRODUCTION_SKILLS) return 'processes';
	const letter = contentDescriptionCodeLetter(code);
	if (letter === 'K') return 'knowledge';
	if (letter === 'P') return 'processes';
	return 'other';
}

/** Label shown before the CD text in exports (context / process step). */
export function contentDescriptionExportLabel(strand: string, subStrand: string): string {
	const sub = subStrand.trim();
	if (sub) return sub;
	const s = strand.trim();
	if (s === KNOWLEDGE_AND_UNDERSTANDING || s === PROCESSES_AND_PRODUCTION_SKILLS) return '';
	return s;
}

/** Promote context labels stored in `strand` into category + subStrand shape. */
export function normalizePlanContentFields(
	strand: string,
	subStrand: string,
	code: string
): { strand: string; subStrand: string } {
	const s = strand.trim();
	const sub = subStrand.trim();
	if (s === KNOWLEDGE_AND_UNDERSTANDING || s === PROCESSES_AND_PRODUCTION_SKILLS) {
		return { strand: s, subStrand: sub };
	}
	const side = contentDescriptionSide(s, code);
	if (side === 'knowledge') {
		return { strand: KNOWLEDGE_AND_UNDERSTANDING, subStrand: sub || s };
	}
	if (side === 'processes') {
		return { strand: PROCESSES_AND_PRODUCTION_SKILLS, subStrand: sub || s };
	}
	return { strand: s, subStrand: sub };
}

export interface PickerContentDescriptor {
	id: string;
	strand: string;
	subStrand: string;
	text: string;
	code: string;
}

/** Map catalogue fields onto plan/picker shape (category → strand). */
export function planFieldsFromCatalogueDescriptor(
	cd: CurriculumContentDescriptor
): PickerContentDescriptor {
	const isCategory =
		cd.category === KNOWLEDGE_AND_UNDERSTANDING ||
		cd.category === PROCESSES_AND_PRODUCTION_SKILLS;
	return {
		id: cd.id,
		strand: isCategory ? cd.category : cd.strand || cd.category,
		subStrand: isCategory ? cd.strand : cd.subStrand,
		text: cd.text,
		code: cd.code || cd.id
	};
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
	const band =
		yearBandFromYearLevel(yearLevel) ||
		parseYearBandFromText(subject) ||
		String(yearLevel || '');
	return (
		inferCurriculumPlanType(subject, band) ||
		inferCurriculumPlanTypeFromTitle(`${subject} ${band}`) ||
		inferCurriculumPlanTypeFromTitle(subject)
	);
}

/** Official AC v9.0 achievement standard for the unit's subject/year band, if known. */
export function achievementStandardForUnit(
	subject: string,
	yearLevel: number | ''
): string {
	return getAchievementStandardForPlanType(
		resolveCurriculumPlanTypeForUnit(subject, yearLevel)
	);
}

export function achievementStandardForLevelPlanTitle(bandSubjectTitle: string): string {
	return getAchievementStandardForPlanType(
		inferCurriculumPlanTypeFromTitle(bandSubjectTitle)
	);
}

export const CURRICULUM_CATALOGUE_OPTIONS = CURRICULUM_PLAN_TYPE_LIST.map((planType) => ({
	id: planType.id,
	label: planType.label
}));

export function pickerDescriptorsForPlanType(
	planType: CurriculumPlanTypeId
): PickerContentDescriptor[] {
	const curriculum = getCurriculumForPlanType(planType);
	return curriculum.contentDescriptors.map(planFieldsFromCatalogueDescriptor);
}

/** Prefer curriculum catalogue; fall back to level-plan content description rows. */
export function resolveContentDescriptorsForUnit(options: {
	subject: string;
	yearLevel: number | '';
	planType?: CurriculumPlanTypeId | null;
	levelPlanContentDescriptions?: ContentDescriptionRow[];
}): PickerContentDescriptor[] {
	const planType =
		options.planType ?? resolveCurriculumPlanTypeForUnit(options.subject, options.yearLevel);
	if (planType) {
		const descriptors = pickerDescriptorsForPlanType(planType);
		if (descriptors.length) return descriptors;
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
