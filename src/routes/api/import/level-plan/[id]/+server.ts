import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { mergeParsedLevelPlan, parseLevelPlanDocx } from '$lib/import/level-plan-docx';
import { getLevelPlan, saveLevelPlan } from '$lib/server/data';

export const POST: RequestHandler = async ({ params, request }) => {
	const plan = await getLevelPlan(params.id);
	if (!plan) error(404, 'Level plan not found');

	const form = await request.formData();
	const file = form.get('file');
	if (!(file instanceof File)) {
		return json({ message: 'Upload a Word (.docx) file' }, { status: 400 });
	}

	try {
		const buffer = Buffer.from(await file.arrayBuffer());
		const parsed = parseLevelPlanDocx(buffer);
		const updated = mergeParsedLevelPlan(plan, parsed);
		await saveLevelPlan(updated);
		return json(updated);
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Import failed';
		return json({ message }, { status: 400 });
	}
};
