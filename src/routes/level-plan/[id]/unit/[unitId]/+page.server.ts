import { error } from '@sveltejs/kit';
import { getUnitPlan } from '$lib/server/data';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const plan = await getUnitPlan(params.id, params.unitId);
	if (!plan) error(404, 'Unit plan not found');
	return { plan };
};
