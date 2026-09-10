export const BEST_FLASH_MODEL = {
	id: 'gemini-3.8-flash',
	label: 'Gemini 3.8 Flash'
} as const;

/** Model cascade — no Lite (too many workbook mistakes). */
export const MODEL_CASCADE = [
	BEST_FLASH_MODEL,
	{ id: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash' }
] as const;

/** Per-model request timeout (field generation and short calls). */
export const MODEL_REQUEST_TIMEOUT_MS = 45_000;

/** Lesson generate/enrich — 3 ASPIRE scripts in one JSON blob. */
export const LESSON_REQUEST_TIMEOUT_MS = 120_000;

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
