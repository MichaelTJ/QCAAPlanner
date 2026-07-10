import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { detachAssessmentFromUnitPlan } from '$lib/server/data';

export const POST: RequestHandler = async ({ params }) => {
	const assessmentIndex = Number(params.index);
	if (!Number.isInteger(assessmentIndex) || assessmentIndex < 0) {
		return json({ message: 'Invalid assessment index' }, { status: 400 });
	}

	try {
		const result = await detachAssessmentFromUnitPlan(
			params.levelPlanId,
			params.unitId,
			assessmentIndex
		);
		return json(result);
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Detach failed';
		return json({ message }, { status: 400 });
	}
};
