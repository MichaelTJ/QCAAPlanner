import { error } from '@sveltejs/kit';
import { getLevelPlan, getUnitPlan, listUnitPlans } from '$lib/server/data';
import { unitPlanForLevelIndex } from '$lib/plan-sync';
import { aiField } from '$lib/types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const plan = await getUnitPlan(params.id, params.unitId);
	if (!plan) error(404, 'Unit plan not found');

	if (!plan.duration) {
		plan.duration = aiField('');
	}

	const levelPlan = await getLevelPlan(params.id);
	if (levelPlan) {
		const unitPlans = await listUnitPlans(params.id);
		for (const [index, levelUnit] of levelPlan.units.entries()) {
			const matched = unitPlanForLevelIndex(levelUnit, index, unitPlans);
			if (matched?.id !== plan.id) continue;
			if (!String(plan.duration.value).trim() && String(levelUnit.duration.value).trim()) {
				plan.duration.value = String(levelUnit.duration.value);
			}
			break;
		}
	}

	return { plan };
};
