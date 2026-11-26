/**
 * One-shot Gemini connectivity probe. Prints status codes only — never the key.
 */
import fs from 'node:fs';
import path from 'node:path';

function loadDotEnv() {
	const envPath = path.join(process.cwd(), '.env');
	const text = fs.readFileSync(envPath, 'utf8');
	for (const line of text.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;
		const eq = trimmed.indexOf('=');
		if (eq < 0) continue;
		const key = trimmed.slice(0, eq).trim();
		let value = trimmed.slice(eq + 1).trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		if (process.env[key] == null) process.env[key] = value;
	}
}

loadDotEnv();

const apiKey = process.env.GEMINI_API_KEY ?? '';
if (!apiKey) {
	console.error('GEMINI_API_KEY missing');
	process.exit(1);
}

const prefix = apiKey.slice(0, 4);
console.log(`Key present: yes. Prefix: ${prefix}… length: ${apiKey.length}`);

const models = [
	'gemini-3.8-flash',
	'gemini-3.7-flash',
	'gemini-3.6-flash',
	'gemini-3.5-flash',
	'gemini-3.5-flash-lite',
	'gemini-3.1-flash-lite',
	'gemini-2.5-flash'
];

async function post(model: string, body: Record<string, unknown>) {
	const started = Date.now();
	const response = await fetch(
		`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
		{
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-goog-api-key': apiKey
			},
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(45_000)
		}
	);
	const payload = (await response.json()) as {
		error?: { message?: string; status?: string; code?: number };
		candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
	};
	return {
		http: response.status,
		ms: Date.now() - started,
		status: payload.error?.status ?? (response.ok ? 'OK' : 'ERROR'),
		message: (payload.error?.message ?? '').slice(0, 220),
		text: payload.candidates?.[0]?.content?.parts
			?.map((part) => part.text)
			.filter(Boolean)
			.join('')
			.slice(0, 40)
	};
}

const tiny = {
	contents: [{ parts: [{ text: 'Reply with the single word OK.' }] }]
};

console.log('\nList models (flash only):');
{
	const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
		headers: { 'x-goog-api-key': apiKey },
		signal: AbortSignal.timeout(30_000)
	});
	const payload = (await response.json()) as {
		error?: { message?: string; status?: string };
		models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>;
	};
	console.log(`  list http=${response.status} status=${payload.error?.status ?? 'OK'}`);
	if (payload.error?.message) console.log(`  ${payload.error.message.slice(0, 220)}`);
	const flash = (payload.models ?? [])
		.filter((model) => /flash/i.test(model.name ?? ''))
		.map((model) => model.name?.replace(/^models\//, ''))
		.filter(Boolean);
	console.log(`  flash models (${flash.length}): ${flash.join(', ')}`);
}

console.log('\nTiny generateContent:');
for (const model of models) {
	try {
		const result = await post(model, tiny);
		console.log(
			`  ${model}: http=${result.http} ${result.status} ${result.ms}ms ${result.text || result.message}`
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.log(`  ${model}: THROW ${message.slice(0, 220)}`);
	}
}

console.log('\n3.8 with thinkingLevel=low + JSON mime:');
try {
	const result = await post('gemini-3.8-flash', {
		...tiny,
		generationConfig: {
			responseMimeType: 'application/json',
			thinkingConfig: { thinkingLevel: 'low' }
		}
	});
	console.log(
		`  http=${result.http} ${result.status} ${result.ms}ms ${result.text || result.message}`
	);
} catch (error) {
	const message = error instanceof Error ? error.message : String(error);
	console.log(`  THROW ${message.slice(0, 220)}`);
}
