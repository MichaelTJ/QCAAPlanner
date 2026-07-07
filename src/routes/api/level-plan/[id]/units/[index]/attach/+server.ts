import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { attachUnitToLevelPlan } from '$lib/server/data';

export const POST: RequestHandler = async ({ params, request }) => {
	const unitIndex = Number(params.index);
	if (!Number.isInteger(unitIndex) || unitIndex < 0) {
		return json({ message: 'Invalid unit index' }, { status: 400 });
	}

	const body = (await request.json()) as { unitPlanId?: string; replace?: boolean };
	if (!body.unitPlanId) {
		return json({ message: 'unitPlanId is required' }, { status: 400 });
	}

	try {
		const result = await attachUnitToLevelPlan(params.id, unitIndex, body.unitPlanId, {
			replace: body.replace === true
		});
		return json(result);
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Attach failed';
		return json({ message }, { status: 400 });
	}
};
