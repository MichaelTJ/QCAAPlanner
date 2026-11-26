export const BEST_FLASH_MODEL = {
	id: 'gemini-3.8-flash',
	label: 'Gemini 3.8 Flash'
} as const;

export type CascadeModel = {
	id: string;
	label: string;
	timeoutMs?: number;
	serviceTier?: 'flex' | 'standard' | 'priority';
};

/** Generate cascade — newest first; skip down on 503/timeout/quota. Re-upgrade later. */
export const MODEL_CASCADE: CascadeModel[] = [
	BEST_FLASH_MODEL,
	{ id: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash' },
	{ id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash' },
	{ id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
	{ id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite' },
	{ id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite' },
	{ id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' }
];

/** Enrich cascade — one Enhance activity at a time (small JSON). */
export const FLASH_LITE_MODEL = {
	id: 'gemini-3.5-flash-lite',
	label: 'Gemini 3.5 Flash-Lite'
} as const;

export const ENRICH_MODEL_CASCADE: CascadeModel[] = [
	FLASH_LITE_MODEL,
	{ id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite' },
	{ id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' }
];

/** Per-model request timeout (field generation and short calls). */
export const MODEL_REQUEST_TIMEOUT_MS = 45_000;

/** Lesson generate — 3 ASPIRE scripts in one JSON blob. */
export const LESSON_REQUEST_TIMEOUT_MS = 120_000;

/** Enrich — one activity workbookSpec. */
export const ENRICH_ACTIVITY_TIMEOUT_MS = 60_000;

/** Flex tier — queue on spare capacity; Google recommends ≥10 min. */
export const FLEX_REQUEST_TIMEOUT_MS = 600_000;

export interface ModelAttempt {
	model: string;
	label: string;
	error?: string;
	/** 1 = GEMINI_API_KEY, 2 = GEMINI_API_KEY2, … */
	apiAccount?: number;
}

export interface GenerationResult {
	text: string;
	model: string;
	modelLabel: string;
	attemptedModels: ModelAttempt[];
	usedFallback: boolean;
	apiAccount?: number;
}

export interface GenerationUsage {
	model: string;
	modelLabel: string;
	attemptedModels: ModelAttempt[];
	usedFallback: boolean;
	apiAccount?: number;
}
