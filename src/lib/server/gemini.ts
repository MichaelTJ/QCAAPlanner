import { GEMINI_API_KEY } from '$env/static/private';
import {
	generateContentWithCascade as generateContentWithCascadeCore,
	CascadeExhaustedError,
	isQuotaError,
	type GenerateContentParams
} from '$lib/gemini-client';

export { CascadeExhaustedError, isQuotaError };

export function getGeminiClient() {
	const apiKey = process.env.GEMINI_API_KEY || GEMINI_API_KEY;
	if (!apiKey) {
		throw new Error('GEMINI_API_KEY is not set. Add it to your .env file.');
	}
	return { apiKey };
}

export async function generateContentWithCascade(params: GenerateContentParams) {
	const { apiKey } = getGeminiClient();
	return generateContentWithCascadeCore(apiKey, params);
}
