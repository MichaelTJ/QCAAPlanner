import { generateContentWithCascade } from '$lib/server/gemini';
import { getSettings, getUnitPlan } from '$lib/server/data';
import {
	capabilityTaxonomyForPrompt,
	validSubElementIds
} from '$lib/general-capabilities';
import type { CapabilitiesGenerateRequest } from '$lib/types';
import type { GenerationUsage } from '$lib/gemini-models';

function usageFromResult(result: Awaited<ReturnType<typeof generateContentWithCascade>>): GenerationUsage {
	return {
		model: result.model,
		modelLabel: result.modelLabel,
		attemptedModels: result.attemptedModels,
		usedFallback: result.usedFallback
	};
}

function parseCheckedIds(text: string): string[] {
	const jsonMatch = text.match(/\{[\s\S]*\}/);
	if (!jsonMatch) throw new Error('Could not parse capability response as JSON');
	const parsed = JSON.parse(jsonMatch[0]) as { checkedSubElementIds?: unknown };
	if (!Array.isArray(parsed.checkedSubElementIds)) {
		throw new Error('Response missing checkedSubElementIds array');
	}
	return parsed.checkedSubElementIds.filter((id): id is string => typeof id === 'string');
}

export async function generateCapabilityChecks(request: CapabilitiesGenerateRequest) {
	const settings = await getSettings();
	const unit = await getUnitPlan(request.levelPlanId, request.unitId);
	if (!unit) throw new Error('Unit plan not found');

	const taxonomy = capabilityTaxonomyForPrompt(request.capabilityName);
	const allowedIds = new Set(validSubElementIds(request.capabilityName));
	if (!taxonomy.length) throw new Error('Unknown capability');

	const scopeLabel = request.capabilityName ?? 'all general capabilities';
	const assessments = unit.assessments.map((assessment, index) => ({
		number: assessment.assessmentNumber.value || index + 1,
		title: assessment.title.value,
		description: assessment.description.value,
		technique: assessment.technique.value,
		mode: assessment.mode.value,
		timing: assessment.timing.value
	}));

	const userPrompt = `Analyse this QCAA-aligned unit plan and select which general capability sub-elements are genuinely developed through the unit and its assessments.

Unit title: ${unit.unitTitle.value}
Subject: ${unit.subject.value}
Year level: ${unit.yearLevel.value}

Unit description:
${unit.unitDescription.value || '(Not provided)'}

Assessments:
${
	assessments.length
		? assessments
				.map(
					(assessment) =>
						`- Assessment ${assessment.number}: ${assessment.title || 'Untitled'}
  Description: ${assessment.description || '(Not provided)'}
  Technique: ${assessment.technique || '—'}   Mode: ${assessment.mode || '—'}   Timing: ${assessment.timing || '—'}`
				)
				.join('\n')
		: '(No assessments defined yet)'
}

Scope: ${scopeLabel}

Instructions:
- Select sub-elements that are clearly evidenced in the unit description and/or assessment descriptions.
- Be selective — only check sub-elements with reasonable evidence, not every item.
- Use only sub-element ids from the taxonomy below.
- Return valid JSON only, no markdown fences:
{"checkedSubElementIds": ["id1", "id2"]}

Taxonomy (capability → element → sub-elements with ids):
${JSON.stringify(taxonomy, null, 2)}

${request.aiNotes ? `Additional user notes:\n${request.aiNotes}` : ''}`;

	const result = await generateContentWithCascade({
		contents: userPrompt,
		config: {
			systemInstruction: `You are an expert Australian curriculum writer for QCAA-aligned faculty planning documents.
School: ${settings.school}
Tone and style: ${settings.aiTone}
You map unit and assessment content to Australian Curriculum v9 general capability sub-elements.
Respond with valid JSON only — an object with a single key "checkedSubElementIds" containing an array of sub-element id strings from the provided taxonomy.`
		}
	});

	const checkedSubElementIds = parseCheckedIds(result.text).filter((id) => allowedIds.has(id));

	return {
		checkedSubElementIds,
		lastGenerated: new Date().toISOString(),
		...usageFromResult(result)
	};
}
