import { json } from '@sveltejs/kit';
import { refineDescription } from '$lib/server/refine-description';
import type { DescriptionRefineRequest } from '$lib/types';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json()) as DescriptionRefineRequest;
		if (!body?.target || !body.planType || !Array.isArray(body.selectedContentDescriptors)) {
			return json({ message: 'Invalid refine request' }, { status: 400 });
		}
		if (!body.selectedContentDescriptors.length) {
			return json(
				{ message: 'Select at least one content descriptor before refining.' },
				{ status: 400 }
			);
		}
		const result = await refineDescription(body);
		return json(result);
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Refine failed';
		return json({ message }, { status: 500 });
	}
};
