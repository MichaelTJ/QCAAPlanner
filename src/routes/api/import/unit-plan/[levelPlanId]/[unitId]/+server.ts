import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { mergeParsedUnitPlan, parseUnitPlanDocx } from '$lib/import/unit-plan-docx';
import { getUnitPlan, importUnitPlanAsNew } from '$lib/server/data';

export const POST: RequestHandler = async ({ params, request }) => {
	const plan = await getUnitPlan(params.levelPlanId, params.unitId);
	if (!plan) error(404, 'Unit plan not found');

	const form = await request.formData();
	const file = form.get('file');
	if (!(file instanceof File)) {
		return json({ message: 'Upload a Word (.docx) file' }, { status: 400 });
	}

	try {
		const buffer = Buffer.from(await file.arrayBuffer());
		const parsed = parseUnitPlanDocx(buffer);
		const merged = mergeParsedUnitPlan(plan, parsed);
		const created = await importUnitPlanAsNew(params.levelPlanId, params.unitId, merged);
		return json({
			plan: created,
			redirectTo: `/level-plan/${created.levelPlanId}/unit/${created.id}`
		});
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Import failed';
		return json({ message }, { status: 400 });
	}
};
