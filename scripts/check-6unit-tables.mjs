import fs from 'node:fs';
import AdmZip from 'adm-zip';
import { extractTopLevelTables, unwrapTable, extractRows, extractCells } from '../src/lib/export/docx-xml.ts';

for (const f of ['2units', '6units']) {
	const buf = fs.readFileSync(`data/exports/design-and-technologies-band-9-10-2026-${f}.docx`);
	const xml = new AdmZip(buf).getEntry('word/document.xml').getData().toString('utf8');
	const tables = extractTopLevelTables(xml);
	console.log(`\n=== ${f}: ${tables.length} tables ===`);
	tables.forEach((t, i) => {
		const inner = unwrapTable(t);
		const grid = [...inner.matchAll(/<w:gridCol/g)].length;
		const rows = extractRows(inner);
		const r0 = extractCells(rows[0]).map(c => [...c.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map(m=>m[1]).join('').slice(0,12) || '-');
		console.log(`T${i}: ${grid}cols R0=${r0.join('|')}`);
	});
}
