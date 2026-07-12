import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getUnitPlan } from '$lib/server/data';
import {
	attachmentContentDisposition,
	unitPlanExportFilename
} from '$lib/export/export-filenames';
import { buildUnitPlanDocx } from '$lib/export/unit-plan-docx';

export const GET: RequestHandler = async ({ params }) => {
	const plan = await getUnitPlan(params.levelPlanId, params.unitId);
	if (!plan) error(404, 'Unit plan not found');

	const buffer = await buildUnitPlanDocx(plan);
	const filename = unitPlanExportFilename(plan);

	return new Response(new Uint8Array(buffer), {
		headers: {
			'Content-Type':
				'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
			'Content-Disposition': attachmentContentDisposition(filename)
		}
	});
};
