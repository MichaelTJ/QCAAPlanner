import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { exportLearningGuideDocx } from '$lib/server/learning-guide-export';
import { CascadeExhaustedError } from '$lib/server/gemini';

export const GET: RequestHandler = async ({ params, url }) => {
	try {
		const detail = url.searchParams.get('detail') === 'detailed' ? 'detailed' : 'summary';
		const { buffer, data } = await exportLearningGuideDocx(params.levelPlanId, params.unitId, {
			detail
		});
		const suffix = detail === 'detailed' ? '-learning-guide-detailed' : '-learning-guide';
		const filename = `${params.unitId}${suffix}.docx`;

		return new Response(new Uint8Array(buffer), {
			headers: {
				'Content-Type':
					'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
				'Content-Disposition': `attachment; filename="${filename}"`,
				'X-Learning-Guide-Title': `YR ${data.yearLevel} ${data.subject}, TERM ${data.term}`
			}
		});
	} catch (e) {
		if (e instanceof CascadeExhaustedError) {
			error(429, e.message);
		}
		const message = e instanceof Error ? e.message : 'Learning guide export failed';
		if (message === 'Unit plan not found') error(404, message);
		error(500, message);
	}
};
