import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { importQuickLevelPlanFromLevelPlan } from '$lib/server/data';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json()) as { levelPlanId?: string };
		if (!body.levelPlanId) {
			return json({ message: 'levelPlanId is required' }, { status: 400 });
		}
		const plan = await importQuickLevelPlanFromLevelPlan(body.levelPlanId);
		return json(plan);
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Import failed';
		return json({ message }, { status: 400 });
	}
};
