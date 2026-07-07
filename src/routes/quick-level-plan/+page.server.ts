import { listQuickLevelPlans, getFacultyIndex } from '$lib/server/data';
import { QUICK_PLAN_TYPE_LIST } from '$lib/curriculum/quick-plan-data';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [plans, faculty] = await Promise.all([listQuickLevelPlans(), getFacultyIndex()]);
	return { plans, planTypes: QUICK_PLAN_TYPE_LIST, levelPlans: faculty.rows };
};
