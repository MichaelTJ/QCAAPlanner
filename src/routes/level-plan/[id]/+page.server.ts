import { error } from '@sveltejs/kit';
import { ensureLevelPlanContentDescriptionsFromCatalogue } from '$lib/content-descriptions';
import {
	inferCurriculumPlanTypeFromTitle,
	resolveFacultyCurriculumPlanType
} from '$lib/curriculum/curriculum-catalogue';
import { syncUnitPlansIntoLevelPlan } from '$lib/plan-sync';
import { getFacultyIndex, getLevelPlan, listUnitPlans, saveLevelPlan } from '$lib/server/data';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const plan = await getLevelPlan(params.id);
	if (!plan) error(404, 'Level plan not found');

	const index = await getFacultyIndex();
	const facultyRow = index.rows.find((row) => row.id === plan.id);
	const planType =
		(facultyRow &&
			resolveFacultyCurriculumPlanType(
				facultyRow.learningAreaSubject,
				facultyRow.yearLevelBand,
				facultyRow.curriculumPlanType
			)) ||
		inferCurriculumPlanTypeFromTitle(String(plan.bandSubjectTitle.value || ''));

	if (planType) {
		const changed = ensureLevelPlanContentDescriptionsFromCatalogue(plan, planType);
		if (changed) await saveLevelPlan(plan);
	}

	const unitPlans = await listUnitPlans(params.id);
	syncUnitPlansIntoLevelPlan(plan, unitPlans);
	return { plan, unitPlans };
};
