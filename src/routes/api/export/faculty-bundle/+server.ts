import type { RequestHandler } from './$types';
import { buildFacultyBundleZip } from '$lib/export/faculty-bundle';

export const GET: RequestHandler = async () => {
	const buffer = await buildFacultyBundleZip();
	const filename = `faculty-plans-${new Date().toISOString().slice(0, 10)}.zip`;

	return new Response(new Uint8Array(buffer), {
		headers: {
			'Content-Type': 'application/zip',
			'Content-Disposition': `attachment; filename="${filename}"`
		}
	});
};
