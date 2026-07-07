import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { removeUnitColumnFromLevelPlan } from '$lib/server/data';

export const POST: RequestHandler = async ({ params }) => {
	const unitIndex = Number(params.index);
	if (!Number.isInteger(unitIndex) || unitIndex < 0) {
		return json({ message: 'Invalid unit index' }, { status: 400 });
	}

	try {
		const levelPlan = await removeUnitColumnFromLevelPlan(params.id, unitIndex);
		return json({ levelPlan });
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Remove column failed';
		return json({ message }, { status: 400 });
	}
};
