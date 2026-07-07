import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	deleteQuickLevelPlan,
	getQuickLevelPlan,
	saveQuickLevelPlanWithSourceSync
} from '$lib/server/data';
import { syncQuickPlanColumns } from '$lib/quick-plan';
import type { QuickLevelPlan } from '$lib/types';

export const GET: RequestHandler = async ({ params }) => {
	const plan = await getQuickLevelPlan(params.id);
	if (!plan) return json({ message: 'Not found' }, { status: 404 });
	return json(syncQuickPlanColumns(plan));
};

export const PUT: RequestHandler = async ({ params, request }) => {
	const plan = syncQuickPlanColumns((await request.json()) as QuickLevelPlan);
	if (plan.id !== params.id) {
		return json({ message: 'ID mismatch' }, { status: 400 });
	}
	const saved = await saveQuickLevelPlanWithSourceSync(plan);
	return json(saved);
};

export const DELETE: RequestHandler = async ({ params }) => {
	await deleteQuickLevelPlan(params.id);
	return json({ ok: true });
};
