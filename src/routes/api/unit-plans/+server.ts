import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createStandaloneUnitPlan, listAllUnitPlans } from '$lib/server/data';

export const GET: RequestHandler = async () => {
	return json(await listAllUnitPlans());
};

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json().catch(() => ({}))) as { title?: string };
	const plan = await createStandaloneUnitPlan(body.title);
	return json(plan, { status: 201 });
};
