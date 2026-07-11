import type { CurriculumPlanTypeId } from '$lib/curriculum/curriculum-catalogue';

export type WizardSubjectFamily = 'digital' | 'design' | 'engineering';
export type WizardYearBand = '7-8' | '9-10' | '10';

export function resolveWizardPlanType(
	subjectFamily: WizardSubjectFamily,
	yearBand: WizardYearBand
): CurriculumPlanTypeId | null {
	if (subjectFamily === 'engineering' && yearBand === '10') return '10-engineering';
	if (subjectFamily === 'digital' && yearBand === '7-8') return '7-8-digital-technologies';
	if (subjectFamily === 'digital' && yearBand === '9-10') return '9-10-digital-technologies';
	if (subjectFamily === 'design' && (yearBand === '9-10' || yearBand === '10')) {
		return '9-10-design';
	}
	return null;
}

export function subjectLabelForPlanType(planType: CurriculumPlanTypeId): string {
	switch (planType) {
		case '7-8-digital-technologies':
		case '9-10-digital-technologies':
			return 'Digital Technologies';
		case '9-10-design':
			return 'Design and Technologies';
		case '10-engineering':
			return 'Engineering';
	}
}

export function yearLevelForBand(yearBand: WizardYearBand): number {
	if (yearBand === '7-8') return 8;
	if (yearBand === '10') return 10;
	return 10;
}

export function inferWizardSubjectAndBand(text: string): {
	subjectFamily: WizardSubjectFamily | '';
	yearBand: WizardYearBand | '';
} {
	const value = text.toLowerCase().replace(/–/g, '-');
	let subjectFamily: WizardSubjectFamily | '' = '';
	if (value.includes('engineering')) subjectFamily = 'engineering';
	else if (value.includes('digital')) subjectFamily = 'digital';
	else if (value.includes('design')) subjectFamily = 'design';

	let yearBand: WizardYearBand | '' = '';
	if (value.includes('7-8') || /\b7\b/.test(value) || /\b8\b/.test(value)) yearBand = '7-8';
	else if (value.includes('9-10')) yearBand = '9-10';
	else if (/\b10\b/.test(value) && subjectFamily === 'engineering') yearBand = '10';
	else if (/\b9\b/.test(value) || /\b10\b/.test(value)) yearBand = '9-10';

	return { subjectFamily, yearBand };
}
