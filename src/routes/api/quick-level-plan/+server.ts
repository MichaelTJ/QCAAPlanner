import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	createQuickLevelPlan,
	listQuickLevelPlans
} from '$lib/server/data';
import { QUICK_PLAN_TYPES } from '$lib/curriculum/quick-plan-data';
import type { QuickPlanType } from '$lib/types';

export const GET: RequestHandler = async () => {
	const plans = await listQuickLevelPlans();
	return json({ plans, planTypes: Object.values(QUICK_PLAN_TYPES) });
};

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as { planType?: QuickPlanType };
	const planType = body.planType;
	if (!planType || !QUICK_PLAN_TYPES[planType]) {
		return json({ message: 'Invalid plan type' }, { status: 400 });
	}
	const plan = await createQuickLevelPlan(planType);
	return json(plan, { status: 201 });
};
