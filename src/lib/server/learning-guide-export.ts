import { buildLearningGuideDocx } from '$lib/export/learning-guide-docx';
import { learningGuideFromUnitPlan } from '$lib/learning-guide-data';
import {
	generateLearningGuideSummarized,
	generateLearningGuideVocabulary
} from '$lib/server/generate-learning-guide-vocabulary';
import { getUnitPlan } from '$lib/server/data';
import type { UnitPlan } from '$lib/types';

export type LearningGuideExportDetail = 'summary' | 'detailed';

export async function buildLearningGuideDocxForUnit(
	unit: UnitPlan,
	options: { aiNotes?: string; detail?: LearningGuideExportDetail } = {}
) {
	const detail = options.detail ?? 'summary';
	const data = learningGuideFromUnitPlan(unit);

	if (detail === 'detailed') {
		const vocabularyResult = await generateLearningGuideVocabulary(unit, data, options.aiNotes);
		data.vocabulary = vocabularyResult.vocabulary;
		const buffer = await buildLearningGuideDocx(data);
		return { buffer, data, generationResult: vocabularyResult };
	}

	const summarizedResult = await generateLearningGuideSummarized(unit, data, options.aiNotes);
	data.vocabulary = summarizedResult.vocabulary;
	data.weeks = summarizedResult.weeks;

	const buffer = await buildLearningGuideDocx(data);
	return { buffer, data, generationResult: summarizedResult };
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
