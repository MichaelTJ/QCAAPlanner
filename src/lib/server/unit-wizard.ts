import { generateContentWithCascade } from '$lib/server/gemini';
import { getSettings } from '$lib/server/data';
import {
	ASSESSMENT_MODES,
	ASSESSMENT_TECHNIQUES
} from '$lib/defaults';
import {
	getCurriculumForPlanType,
	type CurriculumPlanTypeId
} from '$lib/curriculum/curriculum-catalogue';
import type { AssessmentMode, AssessmentTechnique } from '$lib/types';
import type { GenerationUsage } from '$lib/gemini-models';

export type UnitWizardStage = 'draft-unit' | 'suggest-descriptors' | 'suggest-assessments';

export interface UnitWizardDescriptorInput {
	code: string;
	text: string;
	strand: string;
}

export interface UnitWizardAssessmentSuggestion {
	title: string;
	description: string;
	technique: AssessmentTechnique | '';
	mode: AssessmentMode | '';
	contentCodes: string[];
}

export interface UnitWizardSuggestRequest {
	stage: UnitWizardStage;
	planType: CurriculumPlanTypeId;
	idea: string;
	unitTitle?: string;
	unitDescription?: string;
	durationWeeks?: number;
	assessmentCount?: number;
	selectedDescriptors?: UnitWizardDescriptorInput[];
}

function usageFromResult(
	result: Awaited<ReturnType<typeof generateContentWithCascade>>
): GenerationUsage {
	return {
		model: result.model,
		modelLabel: result.modelLabel,
		attemptedModels: result.attemptedModels,
		usedFallback: result.usedFallback
	};
}

function extractJsonObject(text: string): unknown {
	const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
	const raw = fenced?.[1]?.trim() || text.trim();
	const match = raw.match(/\{[\s\S]*\}/);
	if (!match) throw new Error('Could not parse AI response as JSON');
	return JSON.parse(match[0]);
}

function systemInstruction(school: string, aiTone: string) {
	return `You are an expert Australian curriculum writer for QCAA-aligned faculty planning documents.
School: ${school}
Tone and style: ${aiTone}
Use Australian English.
Return valid JSON only — no markdown fences, no commentary.`;
}

const TECHNIQUE_SET = new Set<string>(ASSESSMENT_TECHNIQUES);
const MODE_SET = new Set<string>(ASSESSMENT_MODES);

function normalizeTechnique(value: unknown): AssessmentTechnique | '' {
	if (typeof value !== 'string') return '';
	const trimmed = value.trim();
	return TECHNIQUE_SET.has(trimmed) ? (trimmed as AssessmentTechnique) : '';
}

function normalizeMode(value: unknown): AssessmentMode | '' {
	if (typeof value !== 'string') return '';
	const trimmed = value.trim();
	return MODE_SET.has(trimmed) ? (trimmed as AssessmentMode) : '';
}

async function draftUnit(request: UnitWizardSuggestRequest) {
	const settings = await getSettings();
	const curriculum = getCurriculumForPlanType(request.planType);
	const planLabel = curriculum.label;

	const durationNote =
		request.durationWeeks && request.durationWeeks > 0
			? `\nPlanned duration: ${request.durationWeeks} week${request.durationWeeks === 1 ? '' : 's'}`
			: '';

	const userPrompt = `Draft a QCAA-aligned unit title and description for ${planLabel}.

Teacher's idea:
${request.idea.trim() || '(No idea provided — invent a suitable unit for this subject and band.)'}
${durationNote}

Level description context:
${curriculum.levelDescription}

Return JSON only:
{"unitTitle":"...","unitDescription":"..."}

Rules:
- unitTitle: short, specific (about 3–8 words)
- unitDescription: 1–2 paragraphs describing what students learn and do; align with the level description${
		request.durationWeeks && request.durationWeeks > 0
			? ` and fit a ${request.durationWeeks}-week unit`
			: ''
	}
- Do not invent content descriptor codes`;

	const result = await generateContentWithCascade({
		contents: userPrompt,
		config: { systemInstruction: systemInstruction(settings.school, settings.aiTone) }
	});

	const parsed = extractJsonObject(result.text) as {
		unitTitle?: unknown;
		unitDescription?: unknown;
	};

	return {
		unitTitle: typeof parsed.unitTitle === 'string' ? parsed.unitTitle.trim() : '',
		unitDescription:
			typeof parsed.unitDescription === 'string' ? parsed.unitDescription.trim() : '',
		...usageFromResult(result)
	};
}

async function suggestDescriptors(request: UnitWizardSuggestRequest) {
	const settings = await getSettings();
	const curriculum = getCurriculumForPlanType(request.planType);
	const allowed = new Map(
		curriculum.contentDescriptors.map((d) => [d.code.toUpperCase(), d.code])
	);
	const catalogueList = curriculum.contentDescriptors
		.map((d) => `- ${d.code}: ${d.text}`)
		.join('\n');

	const userPrompt = `Select the most relevant Australian Curriculum content descriptors for this unit.

Subject: ${curriculum.label}
Unit title: ${request.unitTitle || '(Untitled)'}
Unit description:
${request.unitDescription || '(Not provided)'}

Original idea:
${request.idea.trim() || '(None)'}

Available descriptors (use ONLY these codes):
${catalogueList}

Return JSON only:
{"codes":["CODE1","CODE2"]}

Rules:
- Prefer 4–10 descriptors that clearly match the unit
- Be selective — do not select everything
- Codes must appear exactly as listed above`;

	const result = await generateContentWithCascade({
		contents: userPrompt,
		config: { systemInstruction: systemInstruction(settings.school, settings.aiTone) }
	});

	const parsed = extractJsonObject(result.text) as { codes?: unknown };
	const rawCodes = Array.isArray(parsed.codes) ? parsed.codes : [];
	const codes: string[] = [];
	const seen = new Set<string>();
	for (const item of rawCodes) {
		if (typeof item !== 'string') continue;
		const canonical = allowed.get(item.trim().toUpperCase());
		if (!canonical || seen.has(canonical)) continue;
		seen.add(canonical);
		codes.push(canonical);
	}

	return { codes, ...usageFromResult(result) };
}

async function suggestAssessments(request: UnitWizardSuggestRequest) {
	const settings = await getSettings();
	const curriculum = getCurriculumForPlanType(request.planType);
	const selected = request.selectedDescriptors ?? [];
	const allowedCodes = new Set(selected.map((d) => d.code.toUpperCase()));
	const codeCanonical = new Map(selected.map((d) => [d.code.toUpperCase(), d.code]));
	const count = Math.min(4, Math.max(1, Math.round(request.assessmentCount ?? 2)));

	const descriptorList = selected.length
		? selected.map((d) => `- ${d.code} (${d.strand}): ${d.text}`).join('\n')
		: '(None selected)';

	const durationNote =
		request.durationWeeks && request.durationWeeks > 0
			? `\nUnit duration: ${request.durationWeeks} week${request.durationWeeks === 1 ? '' : 's'}`
			: '';

	const userPrompt = `Propose exactly ${count} assessment${count === 1 ? '' : 's'} for this QCAA-aligned unit.

Subject: ${curriculum.label}
Unit title: ${request.unitTitle || '(Untitled)'}
Unit description:
${request.unitDescription || '(Not provided)'}
${durationNote}

Selected content descriptors (assign each assessment a subset of these codes only):
${descriptorList}

Allowed techniques: ${ASSESSMENT_TECHNIQUES.join(', ')}
Allowed modes: ${ASSESSMENT_MODES.join(', ')}

Return JSON only:
{"assessments":[{"title":"...","description":"...","technique":"Project","mode":"Multimodal","contentCodes":["CODE1"]}]}

Rules:
- Return exactly ${count} assessment object${count === 1 ? '' : 's'} in the assessments array
- technique and mode must be from the allowed lists exactly
- contentCodes must be a subset of the selected descriptor codes
- Cover the selected descriptors across assessments without unnecessary duplication
- Descriptions: 2–4 sentences each`;

	const result = await generateContentWithCascade({
		contents: userPrompt,
		config: { systemInstruction: systemInstruction(settings.school, settings.aiTone) }
	});

	const parsed = extractJsonObject(result.text) as { assessments?: unknown };
	const raw = Array.isArray(parsed.assessments) ? parsed.assessments : [];
	const assessments: UnitWizardAssessmentSuggestion[] = [];

	for (const item of raw.slice(0, count)) {
		if (!item || typeof item !== 'object') continue;
		const row = item as Record<string, unknown>;
		const contentCodes: string[] = [];
		const seen = new Set<string>();
		const codesRaw = Array.isArray(row.contentCodes) ? row.contentCodes : [];
		for (const code of codesRaw) {
			if (typeof code !== 'string') continue;
			const key = code.trim().toUpperCase();
			if (!allowedCodes.has(key) || seen.has(key)) continue;
			const canonical = codeCanonical.get(key);
			if (!canonical) continue;
			seen.add(key);
			contentCodes.push(canonical);
		}

		assessments.push({
			title: typeof row.title === 'string' ? row.title.trim() : '',
			description: typeof row.description === 'string' ? row.description.trim() : '',
			technique: normalizeTechnique(row.technique),
			mode: normalizeMode(row.mode),
			contentCodes
		});
	}

	while (assessments.length < count) {
		assessments.push({
			title: `Assessment ${assessments.length + 1}`,
			description: '',
			technique: 'Project',
			mode: 'Multimodal',
			contentCodes: selected.map((d) => d.code)
		});
	}

	return { assessments: assessments.slice(0, count), ...usageFromResult(result) };
}

export async function runUnitWizardSuggest(request: UnitWizardSuggestRequest) {
	if (!request.planType || !getCurriculumForPlanType(request.planType)) {
		throw new Error('Invalid plan type');
	}

	switch (request.stage) {
		case 'draft-unit':
			return draftUnit(request);
		case 'suggest-descriptors':
			return suggestDescriptors(request);
		case 'suggest-assessments':
			return suggestAssessments(request);
		default:
			throw new Error('Unknown wizard stage');
	}
}
