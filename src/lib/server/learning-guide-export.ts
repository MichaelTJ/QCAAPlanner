import { buildLearningGuideDocx } from '$lib/export/learning-guide-docx';
import {
	applySavedLearningGuide,
	learningGuideSourceHash,
	storeLearningGuideVariant
} from '$lib/learning-guide-cache';
import { learningGuideFromUnitPlan } from '$lib/learning-guide-data';
import {
	generateLearningGuideSummarized,
	generateLearningGuideVocabulary
} from '$lib/server/generate-learning-guide-vocabulary';
import { getUnitPlan, persistUnitPlanLearningGuides } from '$lib/server/data';
import type { SavedLearningGuideVariant, UnitPlan } from '$lib/types';

export type LearningGuideExportDetail = 'summary' | 'detailed';

export async function buildLearningGuideDocxForUnit(
	unit: UnitPlan,
	options: { aiNotes?: string; detail?: LearningGuideExportDetail } = {}
) {
	const detail = options.detail ?? 'summary';
	const force = Boolean(options.aiNotes?.trim());

	if (!force) {
		const cached = applySavedLearningGuide(unit, detail);
		if (cached) {
			const buffer = await buildLearningGuideDocx(cached);
			return { buffer, data: cached, reused: true as const };
		}
	}

	const data = learningGuideFromUnitPlan(unit);

	if (detail === 'detailed') {
		const vocabularyResult = await generateLearningGuideVocabulary(unit, data, options.aiNotes);
		data.vocabulary = vocabularyResult.vocabulary;
		const buffer = await buildLearningGuideDocx(data);
		await saveGeneratedGuide(unit, detail, {
			vocabulary: vocabularyResult.vocabulary,
			lastGenerated: vocabularyResult.lastGenerated
		});
		return { buffer, data, reused: false as const, generationResult: vocabularyResult };
	}

	const summarizedResult = await generateLearningGuideSummarized(unit, data, options.aiNotes);
	data.vocabulary = summarizedResult.vocabulary;
	data.weeks = summarizedResult.weeks;

	const buffer = await buildLearningGuideDocx(data);
	await saveGeneratedGuide(unit, detail, {
		vocabulary: summarizedResult.vocabulary,
		weeks: summarizedResult.weeks,
		lastGenerated: summarizedResult.lastGenerated
	});
	return { buffer, data, reused: false as const, generationResult: summarizedResult };
}

async function saveGeneratedGuide(
	unit: UnitPlan,
	detail: LearningGuideExportDetail,
	variant: SavedLearningGuideVariant
) {
	const learningGuides = storeLearningGuideVariant(unit, detail, variant);
	if (learningGuides.sourceHash !== learningGuideSourceHash(unit)) return;
	unit.learningGuides = learningGuides;
	await persistUnitPlanLearningGuides(unit.levelPlanId, unit.id, learningGuides);
}

export async function exportLearningGuideDocx(
	levelPlanId: string,
	unitId: string,
	options: { aiNotes?: string; detail?: LearningGuideExportDetail } = {}
) {
	const unit = await getUnitPlan(levelPlanId, unitId);
	if (!unit) throw new Error('Unit plan not found');
	return buildLearningGuideDocxForUnit(unit, options);
}
