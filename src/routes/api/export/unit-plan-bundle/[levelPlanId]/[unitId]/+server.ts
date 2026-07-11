import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { buildUnitPlanBundleZip } from '$lib/export/faculty-bundle';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const buffer = await buildUnitPlanBundleZip(params.levelPlanId, params.unitId);
		const filename = `${params.unitId}-bundle.zip`;

		return new Response(new Uint8Array(buffer), {
			headers: {
				'Content-Type': 'application/zip',
				'Content-Disposition': `attachment; filename="${filename}"`
			}
		});
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Unit plan bundle failed';
		if (message === 'Unit plan not found') error(404, message);
		error(500, message);
	}
};
