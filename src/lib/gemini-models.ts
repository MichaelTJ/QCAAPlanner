/** Model cascade — verified against the Gemini REST API. */
export const MODEL_CASCADE = [
	{ id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash Preview' },
	{ id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite' },
	{ id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' }
] as const;

/** Per-model request timeout. */
export const MODEL_REQUEST_TIMEOUT_MS = 45_000;

export interface ModelAttempt {
	model: string;
	label: string;
	error?: string;
}

export interface GenerationResult {
	text: string;
	model: string;
	modelLabel: string;
	attemptedModels: ModelAttempt[];
	usedFallback: boolean;
}

export interface GenerationUsage {
	model: string;
	modelLabel: string;
	attemptedModels: ModelAttempt[];
	usedFallback: boolean;
}
