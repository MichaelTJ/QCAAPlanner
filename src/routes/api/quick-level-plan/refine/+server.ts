import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { refineQuickPlanDescription } from '$lib/server/quick-plan-refine';
import { CascadeExhaustedError } from '$lib/server/gemini';
import type { QuickPlanRefineRequest } from '$lib/types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json()) as QuickPlanRefineRequest;
		if (!body.selectedContentDescriptors?.length) {
			return json(
				{ message: 'Select at least one content descriptor before refining.' },
				{ status: 400 }
			);
		}
		const result = await refineQuickPlanDescription(body);
		return json(result);
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Refinement failed';
		if (e instanceof CascadeExhaustedError) {
			return json({ message, attemptedModels: e.attemptedModels }, { status: 429 });
		}
		return json({ message }, { status: 500 });
	}
};
