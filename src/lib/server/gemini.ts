import { GEMINI_API_KEY } from '$env/static/private';
import { env } from '$env/dynamic/private';
import {
	generateContentWithCascade as generateContentWithCascadeCore,
	CascadeExhaustedError,
	configureRatePacing,
	isQuotaError,
	isShortRateLimit,
	isTransientError,
	rateLimitDelayMs,
	type GenerateContentParams
} from '$lib/gemini-client';

export {
	CascadeExhaustedError,
	configureRatePacing,
	isQuotaError,
	isShortRateLimit,
	isTransientError,
	rateLimitDelayMs
};

type KeySlot = { key: string; slot: number };

let lastGoodSlot = 1;

function uniqueKeySlots(): KeySlot[] {
	const raw = [env.GEMINI_API_KEY || GEMINI_API_KEY, env.GEMINI_API_KEY2];
	const slots: KeySlot[] = [];
	for (let i = 0; i < raw.length; i++) {
		const key = (raw[i] ?? '').trim();
		if (!key) continue;
		if (slots.some((slot) => slot.key === key)) continue;
		slots.push({ key, slot: i + 1 });
	}
	return slots;
}

function orderedKeySlots(): KeySlot[] {
	const slots = uniqueKeySlots();
	const preferred = slots.find((slot) => slot.slot === lastGoodSlot);
	if (!preferred) return slots;
	return [preferred, ...slots.filter((slot) => slot.slot !== lastGoodSlot)];
}

export function geminiAccountCount(): number {
	return uniqueKeySlots().length;
}

export function getGeminiClient() {
	const slots = uniqueKeySlots();
	if (!slots.length) {
		throw new Error('GEMINI_API_KEY is not set. Add it to your .env file.');
	}
	return { apiKey: slots[0].key };
}

export async function generateContentWithCascade(params: GenerateContentParams) {
	const slots = orderedKeySlots();
	if (!slots.length) {
		throw new Error('GEMINI_API_KEY is not set. Add it to your .env file.');
	}
	const result = await generateContentWithCascadeCore(
		slots.map((slot) => slot.key),
		params
	);
	const account = slots[(result.apiAccount ?? 1) - 1]?.slot ?? slots[0].slot;
	lastGoodSlot = account;
	return { ...result, apiAccount: account };
}
