import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateChunkContent } from '$lib/server/generate';
import { CascadeExhaustedError } from '$lib/server/gemini';
import type { ChunkGenerateRequest } from '$lib/types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json()) as ChunkGenerateRequest;
		const result = await generateChunkContent(body);
		return json(result);
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Chunk generation failed';
		if (e instanceof CascadeExhaustedError) {
			return json({ message, attemptedModels: e.attemptedModels }, { status: 429 });
		}
		return json({ message }, { status: 500 });
	}
};
