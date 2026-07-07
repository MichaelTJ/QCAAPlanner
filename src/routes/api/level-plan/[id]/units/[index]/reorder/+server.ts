import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { reorderUnitsInLevelPlan } from '$lib/server/data';

export const POST: RequestHandler = async ({ params, request }) => {
	const fromIndex = Number(params.index);
	if (!Number.isInteger(fromIndex) || fromIndex < 0) {
		return json({ message: 'Invalid unit index' }, { status: 400 });
	}

	let body: { toIndex?: number };
	try {
		body = await request.json();
	} catch {
		return json({ message: 'Invalid request body' }, { status: 400 });
	}

	const toIndex = Number(body.toIndex);
	if (!Number.isInteger(toIndex) || toIndex < 0) {
		return json({ message: 'Invalid target index' }, { status: 400 });
	}

	try {
		const result = await reorderUnitsInLevelPlan(params.id, fromIndex, toIndex);
		return json(result);
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Reorder failed';
		return json({ message }, { status: 400 });
	}
};
