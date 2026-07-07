import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getLevelPlan, saveLevelPlan } from '$lib/server/data';
import type { LevelPlan } from '$lib/types';

export const GET: RequestHandler = async ({ params }) => {
	const plan = await getLevelPlan(params.id);
	if (!plan) return json({ message: 'Not found' }, { status: 404 });
	return json(plan);
};

export const PUT: RequestHandler = async ({ params, request }) => {
	const plan = (await request.json()) as LevelPlan;
	if (plan.id !== params.id) {
		return json({ message: 'ID mismatch' }, { status: 400 });
	}
	await saveLevelPlan(plan);
	return json(plan);
};
