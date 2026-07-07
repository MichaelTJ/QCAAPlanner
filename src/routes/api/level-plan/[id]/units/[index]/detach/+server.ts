import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { detachUnitFromLevelPlan } from '$lib/server/data';

export const POST: RequestHandler = async ({ params }) => {
	const unitIndex = Number(params.index);
	if (!Number.isInteger(unitIndex) || unitIndex < 0) {
		return json({ message: 'Invalid unit index' }, { status: 400 });
	}

	try {
		const result = await detachUnitFromLevelPlan(params.id, unitIndex);
		return json(result);
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Detach failed';
		return json({ message }, { status: 400 });
	}
};
