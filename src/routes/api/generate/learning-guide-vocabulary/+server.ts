import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getUnitPlan } from '$lib/server/data';
import { learningGuideFromUnitPlan } from '$lib/learning-guide-data';
import { generateLearningGuideVocabulary } from '$lib/server/generate-learning-guide-vocabulary';
import { CascadeExhaustedError } from '$lib/server/gemini';
import type { LearningGuideVocabularyGenerateRequest } from '$lib/types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json()) as LearningGuideVocabularyGenerateRequest;
		const unit = await getUnitPlan(body.levelPlanId, body.unitId);
		if (!unit) return json({ message: 'Unit plan not found' }, { status: 404 });

		const guide = learningGuideFromUnitPlan(unit);
		const result = await generateLearningGuideVocabulary(unit, guide, body.aiNotes ?? '');
		return json(result);
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Vocabulary generation failed';
		if (e instanceof CascadeExhaustedError) {
			return json({ message, attemptedModels: e.attemptedModels }, { status: 429 });
		}
		return json({ message }, { status: 500 });
	}
};
