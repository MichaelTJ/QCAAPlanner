import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateCapabilityChecks } from '$lib/server/generate-capabilities';
import { CascadeExhaustedError } from '$lib/server/gemini';
import type { CapabilitiesGenerateRequest } from '$lib/types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json()) as CapabilitiesGenerateRequest;
		const result = await generateCapabilityChecks(body);
		return json(result);
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Generation failed';
		if (e instanceof CascadeExhaustedError) {
			return json({ message, attemptedModels: e.attemptedModels }, { status: 429 });
		}
		return json({ message }, { status: 500 });
	}
};
