import { error } from '@sveltejs/kit';
import { syncUnitPlansIntoLevelPlan } from '$lib/plan-sync';
import { getLevelPlan, listUnitPlans } from '$lib/server/data';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const plan = await getLevelPlan(params.id);
	if (!plan) error(404, 'Level plan not found');
	const unitPlans = await listUnitPlans(params.id);
	syncUnitPlansIntoLevelPlan(plan, unitPlans);
	return { plan, unitPlans };
};
