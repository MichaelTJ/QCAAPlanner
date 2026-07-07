import fs from 'node:fs';
import {
	extractRows,
	extractCells,
	unwrapTable,
	extractTopLevelTables
} from '../src/lib/export/docx-xml.ts';

const ex = fs.readFileSync(
	'.tmp-docx-debug/example/word/document.xml',
	'utf8'
);

function analyzeTable(tableXml, label) {
	const inner = unwrapTable(tableXml);
	const rows = extractRows(inner);
	const grid = inner.match(/<w:tblGrid>[\s\S]*?<\/w:tblGrid>/)?.[0] ?? '';
	const cols = [...grid.matchAll(/w:w="(\d+)"/g)].map((m) => m[1]);
	console.log(`\n=== ${label}: ${cols.length} cols, ${rows.length} rows ===`);
	console.log('grid:', cols.join(', '));
	rows.slice(0, 3).forEach((row, ri) => {
		const cells = extractCells(row);
		const texts = cells.map((c) => {
			const t = [...c.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
			return t.trim().slice(0, 12) || '-';
		});
		const widths = cells.map((c) => c.match(/tcW w:w="(\d+)"/)?.[1] ?? '?');
		console.log(`R${ri} cells=${cells.length} w=[${widths.join(',')}] t=[${texts.join('|')}]`);
	});
}

const tables = extractTopLevelTables(ex);
analyzeTable(tables[4], 'Content descriptions T4');
const w = unwrapTable(tables[5]);
const capStart = w.indexOf('<w:tbl>');
const capEnd = w.indexOf('</w:tbl>', capStart) + 8;
analyzeTable(w.slice(capStart, capEnd), 'Gen cap nested');
const ccpStart = w.indexOf('<w:tbl>', capEnd - 8);
const ccpEnd = w.indexOf('</w:tbl>', ccpStart) + 8;
analyzeTable(w.slice(ccpStart, ccpEnd), 'CCP nested');
