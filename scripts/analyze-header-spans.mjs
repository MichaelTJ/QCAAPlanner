import fs from 'node:fs';
import { extractRows, extractCells, unwrapTable, extractTopLevelTables } from '../src/lib/export/docx-xml.ts';

const ex = fs.readFileSync('.tmp-docx-debug/example/word/document.xml', 'utf8');
const inner = unwrapTable(extractTopLevelTables(ex)[4]);
const rows = extractRows(inner);

rows.slice(0, 2).forEach((row, ri) => {
	const cells = extractCells(row);
	console.log(`R${ri} ${cells.length} cells:`);
	cells.forEach((c, ci) => {
		const span = c.match(/gridSpan w:val="(\d+)"/)?.[1] ?? '1';
		const w = c.match(/tcW w:w="(\d+)"/)?.[1];
		const t = [...c.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
		console.log(`  C${ci} span=${span} w=${w} "${t.trim()}"`);
	});
});

// Cap header rows
const w = unwrapTable(extractTopLevelTables(ex)[5]);
const cap = w.slice(w.indexOf('<w:tbl>'), w.indexOf('</w:tbl>') + 8);
const capRows = extractRows(unwrapTable(cap));
capRows.slice(0, 2).forEach((row, ri) => {
	const cells = extractCells(row);
	console.log(`\nCap R${ri} ${cells.length} cells:`);
	cells.forEach((c, ci) => {
		const span = c.match(/gridSpan w:val="(\d+)"/)?.[1] ?? '1';
		const t = [...c.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
		console.log(`  C${ci} span=${span} "${t.trim()}"`);
	});
});
