import {
	applyLearningGuideWeekSummaries,
	buildLearningGuideSummaryUserPrompt,
	buildLearningGuideVocabularyContext,
	buildLearningGuideVocabularyUserPrompt,
	normalizeLearningGuideVocabulary,
	parseLearningGuideGenerationResponse
} from '$lib/learning-guide-vocabulary';
import type { LearningGuideData } from '$lib/learning-guide-data';
import { generateContentWithCascade } from '$lib/server/gemini';
import { getSettings } from '$lib/server/data';
import type { UnitPlan } from '$lib/types';
import type { GenerationUsage } from '$lib/gemini-models';

function usageFromResult(result: Awaited<ReturnType<typeof generateContentWithCascade>>): GenerationUsage {
	return {
		model: result.model,
		modelLabel: result.modelLabel,
		attemptedModels: result.attemptedModels,
		usedFallback: result.usedFallback
	};
}

export async function generateLearningGuideVocabulary(
	unit: UnitPlan,
	guide: LearningGuideData,
	aiNotes = ''
) {
	const settings = await getSettings();
	const context = buildLearningGuideVocabularyContext(unit, guide);

	const result = await generateContentWithCascade({
		contents: buildLearningGuideVocabularyUserPrompt(context, aiNotes),
		config: {
			systemInstruction: `You are an expert Australian curriculum writer for QCAA-aligned faculty planning documents.
School: ${settings.school}
Tone and style: ${settings.aiTone}
You write concise student-facing vocabulary lists for learning guides.
Return plain text only — vocabulary lines in the requested format, with no extra commentary.`
		}
	});

	const vocabulary = normalizeLearningGuideVocabulary(result.text);
	if (!vocabulary) {
		throw new Error('Gemini returned empty vocabulary');
	}

	return {
		vocabulary,
		lastGenerated: new Date().toISOString(),
		...usageFromResult(result)
	};
}

export async function generateLearningGuideSummarized(
	unit: UnitPlan,
	guide: LearningGuideData,
	aiNotes = ''
) {
	const settings = await getSettings();
	const context = buildLearningGuideVocabularyContext(unit, guide);

	const result = await generateContentWithCascade({
		contents: buildLearningGuideSummaryUserPrompt(context, aiNotes),
		config: {
			systemInstruction: `You are an expert Australian curriculum writer for QCAA-aligned faculty planning documents.
School: ${settings.school}
Tone and style: ${settings.aiTone}
You write concise student-facing learning guides that fit on one printed page.
Return only valid JSON in the requested shape, with no markdown fences or extra commentary.`
		}
	});

	const generated = parseLearningGuideGenerationResponse(result.text);
	const summarizedGuide = applyLearningGuideWeekSummaries(guide, generated.weeks);

	return {
		vocabulary: generated.vocabulary,
		weeks: summarizedGuide.weeks,
		lastGenerated: new Date().toISOString(),
		...usageFromResult(result)
	};
}
