import { generateContentWithCascade } from '$lib/server/gemini';
import { getSettings } from '$lib/server/data';
import {
	formatGenerationExamples,
	loadGenerationExamples
} from '$lib/server/generation-examples';
import type { QuickPlanRefineRequest } from '$lib/types';
import type { GenerationUsage } from '$lib/gemini-models';

function usageFromResult(result: Awaited<ReturnType<typeof generateContentWithCascade>>): GenerationUsage {
	return {
		model: result.model,
		modelLabel: result.modelLabel,
		attemptedModels: result.attemptedModels,
		usedFallback: result.usedFallback
	};
}

export async function refineQuickPlanDescription(request: QuickPlanRefineRequest) {
	const [settings, examples] = await Promise.all([
		getSettings(),
		loadGenerationExamples('descriptions')
	]);
	const examplesText = formatGenerationExamples(examples);
	const targetLabel = request.target === 'unit' ? 'unit description' : 'assessment description';

	const descriptorList = request.selectedContentDescriptors
		.map((d) => `- ${d.code} (${d.strand}): ${d.text}`)
		.join('\n');

	const userPrompt = `Refine this ${targetLabel} for a QCAA-aligned ${request.planType.replace(/-/g, ' ')} level plan.

Unit title: ${request.unitTitle}
${request.assessmentTitle ? `Assessment title: ${request.assessmentTitle}\n` : ''}
Selected content descriptors (the description must clearly align with these):
${descriptorList}

Level description context:
${request.levelDescription || '(Not provided)'}

Current ${targetLabel}:
${request.currentValue || '(Empty — draft a new description aligned to the selected descriptors.)'}

Refine the description so it clearly reflects the selected content descriptors while preserving the core idea of the unit${request.target === 'assessment' ? ' and assessment' : ''}. Write only the refined description text — no headings or labels.
${examplesText ? `\n${examplesText}` : ''}`;

	const result = await generateContentWithCascade({
		contents: userPrompt,
		config: {
			systemInstruction: `You are an expert Australian curriculum writer for QCAA-aligned faculty planning documents.
School: ${settings.school}
Tone and style: ${settings.aiTone}
Write only the requested description. Use Australian English.
When reference examples are provided, treat them as length and tone guides only — never reuse their topics, technologies, or assessment content.`
		}
	});

	return {
		value: result.text,
		lastGenerated: new Date().toISOString(),
		...usageFromResult(result)
	};
}
