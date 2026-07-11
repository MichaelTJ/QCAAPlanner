import { json } from '@sveltejs/kit';
import { CURRICULUM_PLAN_TYPES } from '$lib/curriculum/curriculum-catalogue';
import {
	runUnitWizardSuggest,
	type UnitWizardSuggestRequest
} from '$lib/server/unit-wizard';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json()) as UnitWizardSuggestRequest;
		if (!body?.stage || !body.planType) {
			return json({ message: 'stage and planType are required' }, { status: 400 });
		}
		if (!CURRICULUM_PLAN_TYPES[body.planType]) {
			return json({ message: 'Invalid planType' }, { status: 400 });
		}
		if (
			body.stage !== 'draft-unit' &&
			body.stage !== 'suggest-descriptors' &&
			body.stage !== 'suggest-assessments'
		) {
			return json({ message: 'Invalid stage' }, { status: 400 });
		}

		const result = await runUnitWizardSuggest(body);
		return json(result);
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Suggest failed';
		return json({ message }, { status: 500 });
	}
};
