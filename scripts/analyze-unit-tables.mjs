import fs from 'node:fs';
import {
	extractTopLevelTables,
	unwrapTable,
	extractRows,
	extractCells
} from '../src/lib/export/docx-xml.ts';

const ex = fs.readFileSync(
	'.tmp-docx-debug/example/word/document.xml',
	'utf8'
);
const tables = extractTopLevelTables(ex);

function show(label, idx) {
	const inner = unwrapTable(tables[idx]);
	const grid = [...(inner.match(/<w:gridCol/g) || [])].length;
	const rows = extractRows(inner);
	console.log(`\n=== T${idx} ${label}: ${grid} cols, ${rows.length} rows ===`);
	rows.slice(0, 6).forEach((row, ri) => {
		const cells = extractCells(row);
		const texts = cells.map((c) =>
			[...c.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('').trim().slice(0, 15) || '-'
		);
		console.log(`R${ri} (${cells.length}): ${texts.join(' | ')}`);
	});
}

show('Level desc', 0);
show('Unit overview', 1);
show('Assessment', 2);
show('Overflow', 3);
show('Content', 4);
