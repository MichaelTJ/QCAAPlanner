import {
	FLEX_REQUEST_TIMEOUT_MS,
	MODEL_CASCADE,
	MODEL_REQUEST_TIMEOUT_MS,
	type CascadeModel,
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

function errorStatus(error: unknown): number | undefined {
	if (typeof error === 'object' && error !== null && 'status' in error) {
		const status = (error as { status?: unknown }).status;
		if (typeof status === 'number') return status;
	}
	return undefined;
}

function modelSupportsThinking(model: string): boolean {
	return /gemini-3\./i.test(model);
}

function isCapabilityError(error: unknown): boolean {
	const status = errorStatus(error);
	const message = errorMessage(error);
	return (
		(status === 400 || status === 404) &&
		/not found|not supported|unknown model|does not exist|thinking level/i.test(message)
	);
}

function isRetryable(error: unknown): boolean {
	const message = errorMessage(error);
	if (isCapabilityError(error)) return true;
	return /rate.?limit|quota|resource.?exhausted|429|503|unavailable|high demand|timed?\s*out|timeout|aborted|abort|fetch failed|network|connection/i.test(
		message
	);
}

/** Any 429 / RESOURCE_EXHAUSTED — per-minute or per-day. */
export function isRateLimitError(error: unknown): boolean {
	const message = errorMessage(error);
	if (/timed?\s*out|timeout|aborted/i.test(message)) return false;
	return (
		errorStatus(error) === 429 ||
		/rate.?limit|quota|resource.?exhausted|too many requests|429/i.test(message)
	);
}

/** Daily cap — gone until Pacific midnight. Relies on the quota id appended in generateContentOnce. */
export function isQuotaError(error: unknown): boolean {
	return isRateLimitError(error) && /per\s*day|daily/i.test(errorMessage(error));
}

/** Per-minute limit (or a 429 with no daily marker) — clears in seconds; slowing down helps. */
export function isShortRateLimit(error: unknown): boolean {
	return isRateLimitError(error) && !isQuotaError(error);
}

/** Server-suggested wait from RetryInfo / "Please retry in 37.5s", else 60s. */
export function rateLimitDelayMs(error: unknown): number {
	const match = /retry in\s*([\d.]+)\s*s/i.exec(errorMessage(error));
	const secs = match ? Number(match[1]) : NaN;
	return Number.isFinite(secs) && secs > 0 ? Math.ceil(secs * 1000) : 60_000;
}

function describeRateLimit(message: string, details: unknown): string {
	if (!Array.isArray(details)) return message;
	let suffix = '';
	const quotaIds = details
		.flatMap((detail) =>
			detail && typeof detail === 'object' && Array.isArray((detail as { violations?: unknown }).violations)
				? ((detail as { violations: Array<{ quotaId?: string }> }).violations ?? [])
				: []
		)
		.map((violation) => violation.quotaId)
		.filter((id): id is string => Boolean(id));
	if (quotaIds.length) suffix += ` [quota: ${[...new Set(quotaIds)].join(', ')}]`;
	const retry = details.find(
		(detail) => detail && typeof detail === 'object' && 'retryDelay' in detail
	) as { retryDelay?: string } | undefined;
	if (retry?.retryDelay && !/retry in/i.test(message)) suffix += ` [retry in ${retry.retryDelay}]`;
	return message + suffix;
}

type RatePacing = {
	/** Minimum gap between calls to the same model on the same key. */
	minIntervalMs: number;
	/** When every key hits a per-minute limit, wait up to this long and retry the same model. */
	rateLimitWaitMaxMs: number;
	rateLimitRounds: number;
	onRateLimitWait?: (model: string, waitMs: number, round: number) => void;
};

let pacing: RatePacing = { minIntervalMs: 0, rateLimitWaitMaxMs: 0, rateLimitRounds: 3 };
const lastCallAt = new Map<string, number>();

/** Batch scripts opt in; UI requests keep the default (no pacing, cascade down on 429). */
export function configureRatePacing(next: Partial<RatePacing>) {
	pacing = { ...pacing, ...next };
}

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function paceCall(slot: string) {
	const wait = (lastCallAt.get(slot) ?? 0) + pacing.minIntervalMs - Date.now();
	if (wait > 0) await sleep(wait);
	lastCallAt.set(slot, Date.now());
}

export function isTransientError(error: unknown): boolean {
	if (isRateLimitError(error)) return false;
	if (isCapabilityError(error)) return true;
	const status = errorStatus(error);
	if (status === 500 || status === 502 || status === 503 || status === 504) return true;
	const message = errorMessage(error);
	return /503|unavailable|high demand|timed?\s*out|timeout|aborted|abort|fetch failed|network|connection/i.test(
		message
	);
}

export type GenerateContentParams = {
	contents: string;
	/** Override MODEL_CASCADE (e.g. best-model-only batch runs). */
	models?: readonly CascadeModel[];
	config?: {
		systemInstruction?: string;
		/** Cap for long JSON chunk responses; omit for short field generation. */
		maxOutputTokens?: number;
		/** Ask the API for JSON (useful for teaching-sequence chunks). */
		responseMimeType?: 'application/json' | 'text/plain';
		/** Override the default per-model request timeout. */
		timeoutMs?: number;
		/** Gemini 3 thinking effort. Low avoids 3.8 hanging until abort. */
		thinkingLevel?: 'low' | 'medium' | 'high';
		/** Flex uses spare capacity (batch jobs). UI should omit this (Standard). */
		serviceTier?: 'flex' | 'standard' | 'priority';
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
	if (params.config?.thinkingLevel && modelSupportsThinking(model)) {
		generationConfig.thinkingConfig = { thinkingLevel: params.config.thinkingLevel };
	}
	if (Object.keys(generationConfig).length > 0) {
		body.generationConfig = generationConfig;
	}
	if (params.config?.serviceTier) {
		body.service_tier = params.config.serviceTier;
	}

	const timeoutMs = params.config?.timeoutMs ?? MODEL_REQUEST_TIMEOUT_MS;
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		'x-goog-api-key': apiKey
	};
	if (params.config?.serviceTier === 'flex') {
		headers['X-Server-Timeout'] = String(Math.ceil(timeoutMs / 1000));
	}
	const response = await fetch(`${GEMINI_API_BASE}/models/${model}:generateContent`, {
		method: 'POST',
		headers,
		body: JSON.stringify(body),
		signal: AbortSignal.timeout(timeoutMs)
	});

	const payload = (await response.json()) as {
		candidates?: Array<{
			content?: { parts?: Array<{ text?: string; thought?: boolean }> };
			finishReason?: string;
		}>;
		error?: { message?: string; code?: number; status?: string; details?: unknown };
	};

	if (!response.ok) {
		const base = payload.error?.message ?? `Gemini API error (${response.status})`;
		const message = response.status === 429 ? describeRateLimit(base, payload.error?.details) : base;
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

	const text = candidate?.content?.parts
		?.filter((part) => !part.thought && part.text)
		.map((part) => part.text)
		.join('')
		.trim();
	if (!text) {
		throw new Error('Gemini returned empty content');
	}

	return text;
}

export async function generateContentWithCascade(
	apiKey: string | readonly string[],
	params: GenerateContentParams
): Promise<GenerationResult> {
	const keys = (Array.isArray(apiKey) ? apiKey : [apiKey]).map((item) => item.trim()).filter(Boolean);
	if (!keys.length) {
		throw new Error('GEMINI_API_KEY is not set. Add it to your .env file.');
	}

	const cascade = params.models?.length ? params.models : MODEL_CASCADE;
	const attemptedModels: ModelAttempt[] = [];
	let lastError: unknown;

	for (let i = 0; i < cascade.length; i++) {
		const { id, label, timeoutMs: modelTimeout, serviceTier: modelTier } = cascade[i];
		const serviceTier = modelTier ?? params.config?.serviceTier;
		const flex = serviceTier === 'flex';
		const requestedTimeout =
			modelTimeout ??
			params.config?.timeoutMs ??
			(flex ? FLEX_REQUEST_TIMEOUT_MS : MODEL_REQUEST_TIMEOUT_MS);
		const timeoutMs = requestedTimeout;

		for (let round = 0; ; round++) {
			let allShortLimited = true;
			let shortestWait = Number.POSITIVE_INFINITY;
			for (let k = 0; k < keys.length; k++) {
				const apiAccount = k + 1;
				try {
					await paceCall(`${keys[k]}|${id}`);
					const text = await generateContentOnce(keys[k], id, {
						...params,
						config: { ...params.config, timeoutMs, ...(serviceTier ? { serviceTier } : {}) }
					});

					attemptedModels.push({ model: id, label, apiAccount });
					return {
						text,
						model: id,
						modelLabel: label,
						attemptedModels,
						usedFallback: i > 0,
						apiAccount
					};
				} catch (error) {
					const msg = errorMessage(error);
					attemptedModels.push({ model: id, label, error: msg, apiAccount });
					lastError = error;
					if (isShortRateLimit(error)) {
						shortestWait = Math.min(shortestWait, rateLimitDelayMs(error));
					} else {
						allShortLimited = false;
					}

					if (isCapabilityError(error)) break;
					if (k < keys.length - 1 && isRetryable(error)) continue;
					if (i < cascade.length - 1 && isRetryable(error)) break;
					// Last key + last model (or non-retryable): fall through to CascadeExhaustedError
					// so callers always get attemptedModels instead of a bare throw.
					if (!isRetryable(error) && i === cascade.length - 1 && k === keys.length - 1) {
						throw error;
					}
					break;
				}
			}
			if (
				allShortLimited &&
				round < pacing.rateLimitRounds &&
				shortestWait <= pacing.rateLimitWaitMaxMs
			) {
				pacing.onRateLimitWait?.(id, shortestWait, round + 1);
				await sleep(shortestWait + 1000);
				continue;
			}
			break;
		}
	}

	throw new CascadeExhaustedError(
		attemptedModels,
		lastError ? errorMessage(lastError) : 'All models in the cascade failed'
	);
}
