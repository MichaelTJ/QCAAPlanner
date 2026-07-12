import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { syncUnitPlansIntoLevelPlan } from '$lib/plan-sync';
import { getLevelPlan, listUnitPlans } from '$lib/server/data';
import {
	attachmentContentDisposition,
	levelPlanExportFilename
} from '$lib/export/export-filenames';
import { buildLevelPlanDocx } from '$lib/export/level-plan-docx';

export const GET: RequestHandler = async ({ params }) => {
	const plan = await getLevelPlan(params.id);
	if (!plan) error(404, 'Level plan not found');

	const unitPlans = await listUnitPlans(params.id);
	syncUnitPlansIntoLevelPlan(plan, unitPlans);

	const buffer = await buildLevelPlanDocx(plan);
	const filename = levelPlanExportFilename(plan);

	return new Response(new Uint8Array(buffer), {
		headers: {
			'Content-Type':
				'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
			'Content-Disposition': attachmentContentDisposition(filename)
		}
	});
};
