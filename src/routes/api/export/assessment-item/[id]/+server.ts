import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { buildAssessmentItemDocx } from '$lib/export/assessment-item-docx';
import { getAssessmentItem } from '$lib/server/data';

export const GET: RequestHandler = async ({ params }) => {
	const item = await getAssessmentItem(params.id);
	if (!item) error(404, 'Assessment item not found');
	const buffer = await buildAssessmentItemDocx(item);
	const filename = `${item.id}.docx`;
	return new Response(new Uint8Array(buffer), {
		headers: {
			'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
			'Content-Disposition': `attachment; filename="${filename}"`
		}
	});
};
