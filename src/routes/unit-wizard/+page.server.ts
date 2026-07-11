import { error } from '@sveltejs/kit';
import {
	CURRICULUM_PLAN_TYPE_LIST,
	inferCurriculumPlanType,
	inferCurriculumPlanTypeFromTitle
} from '$lib/curriculum/curriculum-catalogue';
import { getFacultyIndex, getLevelPlan } from '$lib/server/data';
import {
	inferWizardSubjectAndBand,
	type WizardSubjectFamily,
	type WizardYearBand
} from '$lib/unit-wizard-client';
import { weekCountFromDuration } from '$lib/unit-duration';
import type { PageServerLoad } from './$types';

function planTypeToSubjectBand(planType: string): {
	subjectFamily: WizardSubjectFamily;
	yearBand: WizardYearBand;
} | null {
	switch (planType) {
		case '7-8-digital-technologies':
			return { subjectFamily: 'digital', yearBand: '7-8' };
		case '9-10-digital-technologies':
			return { subjectFamily: 'digital', yearBand: '9-10' };
		case '9-10-design':
			return { subjectFamily: 'design', yearBand: '9-10' };
		case '10-engineering':
			return { subjectFamily: 'engineering', yearBand: '10' };
		default:
			return null;
	}
}

export const load: PageServerLoad = async ({ url }) => {
	const levelPlanId = url.searchParams.get('levelPlanId') || '';
	const unitIndexRaw = url.searchParams.get('unitIndex');
	const unitIndex =
		unitIndexRaw !== null && unitIndexRaw !== '' ? Number(unitIndexRaw) : null;

	let prefill: {
		levelPlanId: string;
		unitIndex: number;
		subjectFamily: WizardSubjectFamily | '';
		yearBand: WizardYearBand | '';
		idea: string;
		slotTitle: string;
		levelPlanTitle: string;
		durationWeeks: number | null;
	} | null = null;

	if (levelPlanId) {
		const levelPlan = await getLevelPlan(levelPlanId);
		if (!levelPlan) error(404, 'Level plan not found');
		if (unitIndex === null || Number.isNaN(unitIndex) || unitIndex < 0) {
			error(400, 'unitIndex is required when levelPlanId is set');
		}
		const slot = levelPlan.units[unitIndex];
		if (!slot) error(404, 'Unit slot not found');

		const faculty = await getFacultyIndex();
		const row = faculty.rows.find((r) => r.id === levelPlanId);
		const fromFaculty =
			row && inferCurriculumPlanType(row.learningAreaSubject, row.yearLevelBand);
		const fromTitle =
			inferCurriculumPlanTypeFromTitle(levelPlan.bandSubjectTitle.value) ||
			inferCurriculumPlanType(
				levelPlan.bandSubjectTitle.value,
				String(slot.yearLevel.value || '')
			);
		const planType = fromFaculty || fromTitle;
		const mapped = planType ? planTypeToSubjectBand(planType) : null;
		const inferred = inferWizardSubjectAndBand(
			`${row?.learningAreaSubject || ''} ${row?.yearLevelBand || ''} ${levelPlan.bandSubjectTitle.value}`
		);

		prefill = {
			levelPlanId,
			unitIndex,
			subjectFamily: mapped?.subjectFamily || inferred.subjectFamily,
			yearBand: mapped?.yearBand || inferred.yearBand,
			idea: String(slot.description.value || '').trim(),
			slotTitle: String(slot.unitTitle.value || '').trim(),
			levelPlanTitle: String(levelPlan.bandSubjectTitle.value || '').trim(),
			durationWeeks: weekCountFromDuration(String(slot.duration?.value ?? '')) ?? null
		};
	}

	return {
		planTypes: CURRICULUM_PLAN_TYPE_LIST.map((p) => ({
			id: p.id,
			label: p.label,
			levelDescription: p.levelDescription,
			contentDescriptors: p.contentDescriptors.map((d) => ({
				id: d.id,
				category: d.category,
				strand: d.strand,
				subStrand: d.subStrand,
				text: d.text,
				code: d.code
			}))
		})),
		prefill
	};
};
