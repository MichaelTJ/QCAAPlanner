import { GEMINI_API_KEY } from '$env/static/private';
import {
	generateContentWithCascade as generateContentWithCascadeCore,
	CascadeExhaustedError,
	type GenerateContentParams
} from '$lib/gemini-client';

export { CascadeExhaustedError };

export function getGeminiClient() {
	if (!GEMINI_API_KEY) {
		throw new Error('GEMINI_API_KEY is not set. Add it to your .env file.');
	}
	return { apiKey: GEMINI_API_KEY };
}

export async function generateContentWithCascade(params: GenerateContentParams) {
	const { apiKey } = getGeminiClient();
	return generateContentWithCascadeCore(apiKey, params);
}
