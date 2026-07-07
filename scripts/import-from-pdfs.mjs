import fs from 'node:fs/promises';
import path from 'node:path';
import { GoogleGenAI } from '@google/genai';
import { LEVEL_PLANS } from './manifest.mjs';

const MODEL_CASCADE = [
	{ id: 'gemini-flash-latest', label: 'Gemini Flash (latest)' },
	{ id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
	{ id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite' },
	{ id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash' },
	{ id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' }
];

const ROOT = process.cwd();
const EXTRACTED = path.join(ROOT, 'scripts', 'extracted');
const DATA = path.join(ROOT, 'data');

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

function uid(prefix) {
	return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function field(value) {
	return { value: value ?? '', aiNotes: '' };
}

function parseJsonFromText(text) {
	const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
	const raw = fenced ? fenced[1] : text;
	const start = raw.indexOf('{');
	const end = raw.lastIndexOf('}');
	if (start === -1) throw new Error('No JSON object in response');
	return JSON.parse(raw.slice(start, end + 1));
}

async function callGemini(system, user) {
	const apiKey = process.env.GEMINI_API_KEY;
	if (!apiKey) throw new Error('GEMINI_API_KEY not set');

	const ai = new GoogleGenAI({ apiKey });
	let lastError;

	for (const { id, label } of MODEL_CASCADE) {
		try {
			console.log(`  Trying ${label} (${id})...`);
			const response = await ai.models.generateContent({
				model: id,
				contents: user,
				config: { systemInstruction: system }
			});
			const text = response.text?.trim();
			if (!text) throw new Error('Empty response');
			console.log(`  ✓ ${label}`);
			return { text, model: id };
		} catch (e) {
			lastError = e;
			if (isRetryable(e)) continue;
			throw e;
		}
	}
	throw lastError ?? new Error('All models failed');
}

function isRetryable(error) {
	const msg = error instanceof Error ? error.message : String(error);
	if (/rate.?limit|quota|resource.?exhausted|too many requests|429|503|unavailable|high demand/i.test(msg)) {
		return true;
	}
	if (typeof error === 'object' && error !== null) {
		const status = error.status ?? error.statusCode;
		if (status === 429 || status === 503) return true;
	}
	return false;
}

function normalizeLevelPlan(raw, meta) {
	const unitCount = raw.units?.length ?? 0;
	return {
		id: meta.id,
		bandSubjectTitle: field(raw.bandSubjectTitle),
		school: field(raw.school ?? "St Brendan's College (Yeppoon)"),
		year: field(raw.year ?? 2026),
		status: field(raw.status ?? 'Approved for use'),
		levelDescription: field(raw.levelDescription),
		contextAndCohortConsiderations: field(raw.contextAndCohortConsiderations ?? ''),
		units: (raw.units ?? []).map((u) => ({
			id: uid('unit'),
			unitTitle: field(u.unitTitle),
			yearLevel: field(u.yearLevel ?? ''),
			duration: field(u.duration ?? ''),
			description: field(u.description ?? ''),
			assessments: (u.assessments ?? []).map((a) => ({
				id: uid('assess'),
				assessmentNumber: field(a.assessmentNumber ?? ''),
				title: field(a.title ?? ''),
				term: field(a.term ?? ''),
				week: field(a.week ?? ''),
				description: field(a.description ?? ''),
				technique: field(a.technique ?? ''),
				mode: field(a.mode ?? ''),
				conditions: field(a.conditions ?? ''),
				achievementStandard: field(a.achievementStandard ?? ''),
				moderation: field(a.moderation ?? '')
			}))
		})),
		contentDescriptions: (raw.contentDescriptions ?? []).map((r) => ({
			id: uid('cd'),
			strand: field(r.strand ?? ''),
			subStrand: field(r.subStrand ?? ''),
			text: field(r.text ?? ''),
			code: field(r.code ?? ''),
			unitInclusions: (r.unitInclusions ?? []).slice(0, unitCount)
		})),
		generalCapabilities: (raw.generalCapabilities ?? []).map((r) => ({
			id: uid('cap'),
			name: field(r.name ?? ''),
			unitInclusions: (r.unitInclusions ?? []).slice(0, unitCount)
		})),
		crossCurriculumPriorities: (raw.crossCurriculumPriorities ?? []).map((r) => ({
			id: uid('ccp'),
			name: field(r.name ?? ''),
			unitInclusions: (r.unitInclusions ?? []).slice(0, unitCount)
		}))
	};
}

function normalizeUnitPlan(raw, meta) {
	return {
		id: meta.unitId,
		levelPlanId: meta.levelPlanId,
		yearLevel: field(raw.yearLevel ?? ''),
		subject: field(raw.subject ?? 'Digital Technologies'),
		unitNumber: field(raw.unitNumber ?? meta.unitNumber),
		unitTitle: field(raw.unitTitle ?? ''),
		year: field(raw.year ?? 2026),
		status: field(raw.status ?? 'Draft (Validated)'),
		startWeek: field(raw.startWeek ?? ''),
		finishWeek: field(raw.finishWeek ?? ''),
		unitDescription: field(raw.unitDescription ?? ''),
		cohortAndClassConsiderations: field(raw.cohortAndClassConsiderations ?? ''),
		adjustments: (raw.adjustments ?? []).map((a) => ({
			id: uid('adj'),
			studentIdentifier: field(a.studentIdentifier ?? ''),
			assessmentBand: field(a.assessmentBand ?? ''),
			categoryOfNeed: field(a.categoryOfNeed ?? ''),
			adjustments: field(a.adjustments ?? ''),
			review: field(a.review ?? '')
		})),
		assessments: (raw.assessments ?? []).map((a) => ({
			id: uid('uassess'),
			assessmentNumber: field(a.assessmentNumber ?? ''),
			yearLevel: field(a.yearLevel ?? raw.yearLevel ?? ''),
			title: field(a.title ?? ''),
			description: field(a.description ?? ''),
			technique: field(a.technique ?? ''),
			mode: field(a.mode ?? ''),
			conditions: field(a.conditions ?? ''),
			timing: field(a.timing ?? ''),
			achievementStandard: field(a.achievementStandard ?? ''),
			moderation: field(a.moderation ?? ''),
			contentDescriptions: (a.contentDescriptions ?? []).map((cd) => ({
				id: uid('cd'),
				strand: field(cd.strand ?? ''),
				subStrand: field(cd.subStrand ?? ''),
				text: field(cd.text ?? ''),
				code: field(cd.code ?? '')
			}))
		})),
		generalCapabilities: (raw.generalCapabilities ?? []).map((g) => ({
			id: uid('ucap'),
			name: field(g.name ?? ''),
			subElements: field(g.subElements ?? ''),
			evidenceNotes: field(g.evidenceNotes ?? '')
		})),
		teachingSequence: (raw.teachingSequence ?? []).map((w) => ({
			id: uid('week'),
			week: field(w.week ?? ''),
			keyTeachingExperiences: field(w.keyTeachingExperiences ?? ''),
			adjustments: field(w.adjustments ?? ''),
			resources: field(w.resources ?? ''),
			theory: field(w.theory ?? ''),
			prac: field(w.prac ?? ''),
			assessment: field(w.assessment ?? ''),
			outlineTheme: field(w.outlineTheme ?? '')
		})),
		evaluation: field(raw.evaluation ?? '')
	};
}

const LEVEL_SYSTEM = `You extract QCAA level plan data from PDF text into JSON.
Return ONLY valid JSON matching this shape (plain values, no markdown):
{
  "bandSubjectTitle": string,
  "school": string,
  "year": number,
  "status": "Draft" | "Draft (Validated)" | "Approved for use",
  "levelDescription": string,
  "contextAndCohortConsiderations": string,
  "units": [{
    "unitTitle": string, "yearLevel": number, "duration": string, "description": string,
    "assessments": [{
      "assessmentNumber": number, "title": string, "term": number, "week": number,
      "description": string, "technique": "Other"|"Portfolio"|"Examination"|"Investigation"|"Project",
      "mode": "Multimodal"|"Written", "conditions": string, "achievementStandard": string, "moderation": string
    }]
  }],
  "contentDescriptions": [{ "strand": string, "subStrand": string, "text": string, "code": string, "unitInclusions": [bool,...] }],
  "generalCapabilities": [{ "name": string, "unitInclusions": [bool,...] }],
  "crossCurriculumPriorities": [{ "name": string, "unitInclusions": [bool,...] }]
}
Extract ALL content descriptions with AC codes and checkmarks. Extract ALL assessments per unit. Preserve full text.`;

const UNIT_SYSTEM = `You extract QCAA unit plan data from PDF text into JSON.
Return ONLY valid JSON:
{
  "yearLevel": number, "subject": string, "unitNumber": number, "unitTitle": string, "year": number,
  "status": "Draft" | "Draft (Validated)" | "Approved for use",
  "startWeek": string, "finishWeek": string, "unitDescription": string, "cohortAndClassConsiderations": string,
  "adjustments": [{ "studentIdentifier": string, "assessmentBand": string, "categoryOfNeed": string, "adjustments": string, "review": string }],
  "assessments": [{
    "assessmentNumber": number, "yearLevel": number, "title": string, "description": string,
    "technique": string, "mode": string, "conditions": string, "timing": string,
    "achievementStandard": string, "moderation": string,
    "contentDescriptions": [{ "strand": string, "subStrand": string, "text": string, "code": string }]
  }],
  "generalCapabilities": [{ "name": string, "subElements": string, "evidenceNotes": string }],
  "teachingSequence": [{
    "week": number, "keyTeachingExperiences": string, "adjustments": string, "resources": string,
    "theory": string, "prac": string, "assessment": string
  }],
  "evaluation": string
}
Extract EVERY week in the teaching sequence with full theory/prac/assessment content. Preserve assessment content descriptions with AC codes.`;

async function importLevelPlan(meta) {
	console.log(`\nLevel plan: ${meta.id}`);
	const text = await fs.readFile(path.join(EXTRACTED, meta.textFile), 'utf-8');
	const { text: response } = await callGemini(
		LEVEL_SYSTEM,
		`Extract level plan JSON from this PDF text:\n\n${text}`
	);
	const raw = parseJsonFromText(response);
	const plan = normalizeLevelPlan(raw, meta);
	await fs.mkdir(path.join(DATA, 'level-plans'), { recursive: true });
	await fs.writeFile(path.join(DATA, 'level-plans', `${meta.id}.json`), JSON.stringify(plan, null, 2));
	console.log(`  Saved ${plan.units.length} units, ${plan.contentDescriptions.length} content rows`);
	return plan;
}

async function importUnitPlan(meta, levelPlanId) {
	console.log(`\nUnit plan: ${meta.unitId}`);
	const text = await fs.readFile(path.join(EXTRACTED, meta.textFile), 'utf-8');
	const { text: response } = await callGemini(
		UNIT_SYSTEM,
		`Extract unit plan JSON from this PDF text:\n\n${text}`
	);
	const raw = parseJsonFromText(response);
	const plan = normalizeUnitPlan(raw, { ...meta, levelPlanId });
	const dir = path.join(DATA, 'unit-plans', levelPlanId);
	await fs.mkdir(dir, { recursive: true });
	await fs.writeFile(path.join(dir, `${meta.unitId}.json`), JSON.stringify(plan, null, 2));
	console.log(`  Saved ${plan.teachingSequence.length} weeks, ${plan.assessments.length} assessments`);
	return plan;
}

async function main() {
	await loadEnv();

	const facultyRows = LEVEL_PLANS.map((p) => ({
		id: p.id,
		learningAreaSubject: p.learningAreaSubject,
		yearLevelBand: p.yearLevelBand,
		dateLastModified: new Date().toISOString()
	}));

	for (const lp of LEVEL_PLANS) {
		await importLevelPlan(lp);
		for (const unit of lp.units) {
			await importUnitPlan(unit, lp.id);
		}
	}

	await fs.mkdir(path.join(DATA, 'faculty'), { recursive: true });
	await fs.writeFile(path.join(DATA, 'faculty', 'index.json'), JSON.stringify({ rows: facultyRows }, null, 2));
	console.log('\nFaculty index updated with', facultyRows.length, 'rows');
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
