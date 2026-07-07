import fs from 'node:fs';
import {
	extractTopLevelTables,
	unwrapTable
} from '../src/lib/export/docx-xml.ts';

const ex = fs.readFileSync('data/exports/design-and-technologies-band-9-10-2026-2units.docx');
import AdmZip from 'adm-zip';
const zip = new AdmZip(ex);
const xml = zip.getEntry('word/document.xml').getData().toString('utf8');
const tables = extractTopLevelTables(xml);

tables.forEach((t, i) => {
	const inner = unwrapTable(t);
	const grid = [...inner.matchAll(/<w:gridCol w:w="(\d+)"/g)].map((m) => m[1]);
	console.log(`T${i}: ${grid.length} cols widths=${grid.join(',')}`);
});
