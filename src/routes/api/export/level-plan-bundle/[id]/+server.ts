import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { buildLevelPlanBundleZip } from '$lib/export/faculty-bundle';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const buffer = await buildLevelPlanBundleZip(params.id);
		const filename = `${params.id}-bundle.zip`;

		return new Response(new Uint8Array(buffer), {
			headers: {
				'Content-Type': 'application/zip',
				'Content-Disposition': `attachment; filename="${filename}"`
			}
		});
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Level plan bundle failed';
		if (message === 'Level plan not found') error(404, message);
		error(500, message);
	}
};
