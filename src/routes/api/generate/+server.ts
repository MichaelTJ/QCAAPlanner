import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateFieldContent } from '$lib/server/generate';
import { CascadeExhaustedError } from '$lib/server/gemini';
import type { GenerateRequest } from '$lib/types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json()) as GenerateRequest;
		const result = await generateFieldContent(body);
		return json(result);
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Generation failed';
		if (e instanceof CascadeExhaustedError) {
			return json({ message, attemptedModels: e.attemptedModels }, { status: 429 });
		}
		return json({ message }, { status: 500 });
	}
};
