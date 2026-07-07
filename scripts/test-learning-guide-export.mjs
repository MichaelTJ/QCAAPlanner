import fs from 'node:fs/promises';
import path from 'node:path';
import { generateContentWithCascade } from '../src/lib/gemini-client.ts';
import {
	buildLearningGuideVocabularyContext,
	buildLearningGuideSummaryUserPrompt,
	buildLearningGuideVocabularyUserPrompt,
	parseLearningGuideGenerationResponse
} from '../src/lib/learning-guide-vocabulary.ts';
import { buildLearningGuideDocx } from '../src/lib/export/learning-guide-docx.ts';
import { learningGuideFromUnitPlan } from '../src/lib/learning-guide-data.ts';

const ROOT = process.cwd();

async function loadEnv() {
	const text = await fs.readFile(path.join(ROOT, '.env'), 'utf-8');
	for (const line of text.split('\n')) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;
		const eq = trimmed.indexOf('=');
		if (eq === -1) continue;
		process.env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
	}
}

const detailed = process.argv.includes('--detailed');
const unitRelPath =
	process.argv.find((arg) => !arg.startsWith('--')) ??
	'data/unit-plans/design-and-technologies-band-9-10-2026/unit-1e1aa452.json';
const unit = JSON.parse(await fs.readFile(path.join(ROOT, unitRelPath), 'utf-8'));
const settings = JSON.parse(await fs.readFile(path.join(ROOT, 'data/settings.json'), 'utf-8'));

await loadEnv();
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) throw new Error('GEMINI_API_KEY not set in .env');

const data = learningGuideFromUnitPlan(unit);
if (!data.term && unit.id === 'unit-1e1aa452') data.term = 1;

console.log(detailed ? 'Generating vocabulary with Gemini...' : 'Generating summarized learning guide with Gemini...');
const context = buildLearningGuideVocabularyContext(unit, data);
const prompt = detailed
	? buildLearningGuideVocabularyUserPrompt(context)
	: buildLearningGuideSummaryUserPrompt(context);
const systemInstruction = detailed
	? `You are an expert Australian curriculum writer for QCAA-aligned faculty planning documents.
School: ${settings.school}
Tone and style: ${settings.aiTone}
You write concise student-facing vocabulary lists for learning guides.
Return plain text only — vocabulary lines in the requested format, with no extra commentary.`
	: `You are an expert Australian curriculum writer for QCAA-aligned faculty planning documents.
School: ${settings.school}
Tone and style: ${settings.aiTone}
You write concise student-facing learning guides that fit on one printed page.
Return only valid JSON in the requested shape, with no markdown fences or extra commentary.`;

const vocabResult = await generateContentWithCascade(apiKey, {
	contents: prompt,
	config: { systemInstruction }
});

if (detailed) {
	const { normalizeLearningGuideVocabulary } = await import('../src/lib/learning-guide-vocabulary.ts');
	data.vocabulary = normalizeLearningGuideVocabulary(vocabResult.text);
} else {
	const generated = parseLearningGuideGenerationResponse(vocabResult.text);
	data.vocabulary = generated.vocabulary;
	data.weeks = generated.weeks.map((summary) => {
		const existing = data.weeks.find((week) => String(week.week) === String(summary.week));
		return {
			week: summary.week,
			title: summary.title || existing?.title || '',
			bullets: summary.bullets.length ? summary.bullets : (existing?.bullets ?? [])
		};
	});
}
console.log('Model:', vocabResult.modelLabel);
console.log('Vocabulary:\n', data.vocabulary);

const buffer = await buildLearningGuideDocx(data);
const baseName = path.basename(unitRelPath, '.json');
const out = path.join(
	ROOT,
	'data/exports',
	`${baseName}${detailed ? '-learning-guide-detailed' : '-learning-guide'}.docx`
);
await fs.mkdir(path.dirname(out), { recursive: true });
await fs.writeFile(out, buffer);
console.log('\nWrote', out, buffer.length, 'bytes');
console.log('Weeks:', data.weeks.length, '| Title:', `YR ${data.yearLevel} ${data.subject}, TERM ${data.term}`);
