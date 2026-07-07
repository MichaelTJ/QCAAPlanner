import { normalizeYearBand } from '$lib/defaults';

export type CurriculumSubjectFamily = 'design' | 'digital' | 'engineering' | 'other';

export interface CurriculumMatchKey {
	subjectFamily: CurriculumSubjectFamily;
	yearBand: string;
}

export interface CurriculumMatchLabel {
	key: CurriculumMatchKey;
	label: string;
	sortKey: string;
}

function normalizeText(value: string): string {
	return value.toLowerCase().replace(/–/g, '-').trim();
}

export function parseSubjectFamily(text: string): CurriculumSubjectFamily {
	const value = normalizeText(text);
	if (value.includes('engineering')) return 'engineering';
	if (value.includes('digital')) return 'digital';
	if (value.includes('design')) return 'design';
	return 'other';
}

export function parseYearBandFromText(text: string): string {
	const value = normalizeText(text);
	const rangeMatch = value.match(/\b(\d{1,2})\s*-\s*(\d{1,2})\b/);
	if (rangeMatch) return `${rangeMatch[1]}-${rangeMatch[2]}`;
	if (/\b10\b/.test(value) && !/\b9\s*-\s*10\b/.test(value)) return '10';
	if (/\b9\b/.test(value) && !/\b9\s*-\s*10\b/.test(value)) return '9';
	if (/\b8\b/.test(value) && !/\b7\s*-\s*8\b/.test(value)) return '8';
	if (/\b7\b/.test(value) && !/\b7\s*-\s*8\b/.test(value)) return '7';
	const bandMatch = value.match(/\bband\s+(\d{1,2}(?:\s*-\s*\d{1,2})?)/i);
	if (bandMatch) return normalizeYearBand(bandMatch[1]);
	return '';
}

export function yearBandFromYearLevel(yearLevel: number | ''): string {
	if (yearLevel === '') return '';
	const year = Number(yearLevel);
	if (year === 7 || year === 8) return '7-8';
	if (year === 9 || year === 10) return '9-10';
	return String(year);
}

export function curriculumMatchFromFaculty(
	learningAreaSubject: string,
	yearLevelBand: string
): CurriculumMatchLabel {
	const yearBand = normalizeYearBand(yearLevelBand) || parseYearBandFromText(yearLevelBand);
	const subjectFamily = parseSubjectFamily(learningAreaSubject);
	return toLabel({ subjectFamily, yearBand });
}

export function curriculumMatchFromBandSubjectTitle(bandSubjectTitle: string): CurriculumMatchLabel {
	const yearBand =
		parseYearBandFromText(bandSubjectTitle) || normalizeYearBand(bandSubjectTitle);
	const subjectFamily = parseSubjectFamily(bandSubjectTitle);
	return toLabel({ subjectFamily, yearBand });
}

export function curriculumMatchFromUnit(subject: string, yearLevel: number | ''): CurriculumMatchLabel {
	const yearBand = parseYearBandFromText(subject) || yearBandFromYearLevel(yearLevel);
	const subjectFamily = parseSubjectFamily(subject);
	return toLabel({ subjectFamily, yearBand });
}

function subjectFamilyLabel(family: CurriculumSubjectFamily): string {
	switch (family) {
		case 'design':
			return 'Design Technologies';
		case 'digital':
			return 'Digital Technologies';
		case 'engineering':
			return 'Engineering';
		default:
			return 'Other';
	}
}

function toLabel(key: CurriculumMatchKey): CurriculumMatchLabel {
	const band = key.yearBand || '?';
	const label = `${band} · ${subjectFamilyLabel(key.subjectFamily)}`;
	const sortKey = `${band.padStart(5, '0')}|${key.subjectFamily}|${label}`;
	return { key, label, sortKey };
}

export function curriculumKeysCompatible(a: CurriculumMatchKey, b: CurriculumMatchKey): boolean {
	if (a.subjectFamily === 'other' || b.subjectFamily === 'other') return false;
	if (a.subjectFamily !== b.subjectFamily) return false;
	if (!a.yearBand || !b.yearBand) return false;
	return a.yearBand === b.yearBand;
}

export function unitCompatibleWithFaculty(
	unitSubject: string,
	unitYearLevel: number | '',
	learningAreaSubject: string,
	yearLevelBand: string
): boolean {
	const level = curriculumMatchFromFaculty(learningAreaSubject, yearLevelBand);
	const unit = curriculumMatchFromUnit(unitSubject, unitYearLevel);
	return curriculumKeysCompatible(level.key, unit.key);
}
