import {
	MODEL_CASCADE,
	MODEL_REQUEST_TIMEOUT_MS,
	type GenerationResult,
	type ModelAttempt
} from '$lib/gemini-models';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export class CascadeExhaustedError extends Error {
	attemptedModels: ModelAttempt[];

	constructor(attemptedModels: ModelAttempt[], lastMessage: string) {
		super(lastMessage);
		this.name = 'CascadeExhaustedError';
		this.attemptedModels = attemptedModels;
	}
}

function errorMessage(error: unknown): string {
	if (error instanceof Error) return error.message;
	if (typeof error === 'object' && error !== null && 'message' in error) {
		return String((error as { message: unknown }).message);
	}
	return String(error);
}

function isRetryable(error: unknown): boolean {
	const message = errorMessage(error);
	return /rate.?limit|quota|resource.?exhausted|429|503|unavailable|high demand|timed?\s*out|timeout|aborted|abort|fetch failed|network|connection/i.test(
		message
	);
}

export type GenerateContentParams = {
	contents: string;
	config?: {
		systemInstruction?: string;
		/** Cap for long JSON chunk responses; omit for short field generation. */
		maxOutputTokens?: number;
		/** Ask the API for JSON (useful for teaching-sequence chunks). */
		responseMimeType?: 'application/json' | 'text/plain';
	};
};

async function generateContentOnce(
	apiKey: string,
	model: string,
	params: GenerateContentParams
): Promise<string> {
	const body: Record<string, unknown> = {
		contents: [{ parts: [{ text: params.contents }] }]
	};

	if (params.config?.systemInstruction) {
		body.systemInstruction = { parts: [{ text: params.config.systemInstruction }] };
	}

	const generationConfig: Record<string, unknown> = {};
	if (params.config?.maxOutputTokens != null) {
		generationConfig.maxOutputTokens = params.config.maxOutputTokens;
	}
	if (params.config?.responseMimeType) {
		generationConfig.responseMimeType = params.config.responseMimeType;
	}
	if (Object.keys(generationConfig).length > 0) {
		body.generationConfig = generationConfig;
	}

	const response = await fetch(
		`${GEMINI_API_BASE}/models/${model}:generateContent?key=${apiKey}`,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(MODEL_REQUEST_TIMEOUT_MS)
		}
	);

	const payload = (await response.json()) as {
		candidates?: Array<{
			content?: { parts?: Array<{ text?: string }> };
			finishReason?: string;
		}>;
		error?: { message?: string; code?: number; status?: string };
	};

	if (!response.ok) {
		const message = payload.error?.message ?? `Gemini API error (${response.status})`;
		const error = new Error(message) as Error & { status?: number };
		error.status = response.status;
		throw error;
	}

	const candidate = payload.candidates?.[0];
	const finishReason = candidate?.finishReason;
	if (finishReason === 'MAX_TOKENS') {
		throw new Error(
			'Model response was truncated (hit max output tokens). Try a smaller week range or fewer weeks per pass.'
		);
	}

	const text = candidate?.content?.parts?.[0]?.text?.trim();
	if (!text) {
		throw new Error('Gemini returned empty content');
	}

	return text;
}

export async function generateContentWithCascade(
	apiKey: string,
	params: GenerateContentParams
): Promise<GenerationResult> {
	if (!apiKey) {
		throw new Error('GEMINI_API_KEY is not set. Add it to your .env file.');
	}

	const attemptedModels: ModelAttempt[] = [];
	let lastError: unknown;

	for (let i = 0; i < MODEL_CASCADE.length; i++) {
		const { id, label } = MODEL_CASCADE[i];
		try {
			const text = await generateContentOnce(apiKey, id, params);

			attemptedModels.push({ model: id, label });
			return {
				text,
				model: id,
				modelLabel: label,
				attemptedModels,
				usedFallback: i > 0
			};
		} catch (error) {
			const msg = errorMessage(error);
			attemptedModels.push({ model: id, label, error: msg });
			lastError = error;

			if (i < MODEL_CASCADE.length - 1 && isRetryable(error)) {
				continue;
			}

			throw error;
		}
	}

	throw new CascadeExhaustedError(
		attemptedModels,
		lastError ? errorMessage(lastError) : 'All models in the cascade failed'
	);
}
