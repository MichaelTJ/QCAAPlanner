import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateWeekLessons } from '$lib/server/generate-lessons';
import { CascadeExhaustedError } from '$lib/server/gemini';
import type { LessonGenerateRequest } from '$lib/types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = (await request.json()) as LessonGenerateRequest;
		if (!body.levelPlanId || !body.unitId || !body.weekNumber) {
			return json({ message: 'levelPlanId, unitId, and weekNumber are required' }, { status: 400 });
		}
		if (!body.weekContext) {
			return json({ message: 'weekContext is required' }, { status: 400 });
		}
		const result = await generateWeekLessons(body);
		return json(result);
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Lesson generation failed';
		if (e instanceof CascadeExhaustedError) {
			return json({ message, attemptedModels: e.attemptedModels }, { status: 429 });
		}
		return json({ message }, { status: 500 });
	}
};
