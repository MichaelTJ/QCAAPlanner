import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { cloneUnitInLevelPlan } from '$lib/server/data';

export const POST: RequestHandler = async ({ params }) => {
	const sourceIndex = Number(params.index);
	if (!Number.isInteger(sourceIndex) || sourceIndex < 0) {
		return json({ message: 'Invalid unit index' }, { status: 400 });
	}

	try {
		const result = await cloneUnitInLevelPlan(params.id, sourceIndex);
		return json(result);
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Clone failed';
		return json({ message }, { status: 400 });
	}
};
