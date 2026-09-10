/**
 * Writes a Word catalog of all workbook activity types for review.
 * Usage: npx tsx scripts/export-workbook-catalog.ts
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { buildWorkbookActivityCatalogDocx } from '../src/lib/workbook/catalog-docx';

const outDir = path.join(process.cwd(), '.tmp-qcaa');
const candidates = [
	path.join(outDir, 'workbook-activity-catalog.docx'),
	path.join(outDir, 'workbook-activity-catalog-v2.docx'),
	path.join(outDir, 'workbook-activity-catalog-v3.docx')
];

const buffer = await buildWorkbookActivityCatalogDocx();
await fs.mkdir(outDir, { recursive: true });

let wrote = false;
for (const outFile of candidates) {
	try {
		await fs.writeFile(outFile, buffer);
		console.log(`Wrote ${outFile} (${buffer.byteLength} bytes)`);
		wrote = true;
		break;
	} catch (err) {
		const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : '';
		if (code === 'EBUSY' || code === 'EPERM') continue;
		throw err;
	}
}
if (!wrote) {
	throw new Error('All catalog output paths are locked — close Word and retry.');
}
