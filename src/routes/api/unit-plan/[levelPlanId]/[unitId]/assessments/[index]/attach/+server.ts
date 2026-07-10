import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { attachAssessmentToUnitPlan } from '$lib/server/data';

export const POST: RequestHandler = async ({ params, request }) => {
	const assessmentIndex = Number(params.index);
	if (!Number.isInteger(assessmentIndex) || assessmentIndex < 0) {
		return json({ message: 'Invalid assessment index' }, { status: 400 });
	}

	const body = (await request.json()) as { assessmentItemId?: string; replace?: boolean };
	if (!body.assessmentItemId) {
		return json({ message: 'assessmentItemId is required' }, { status: 400 });
	}

	try {
		const result = await attachAssessmentToUnitPlan(
			params.levelPlanId,
			params.unitId,
			assessmentIndex,
			body.assessmentItemId,
			{ replace: body.replace }
		);
		return json(result);
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Attach failed';
		return json({ message }, { status: 400 });
	}
};
