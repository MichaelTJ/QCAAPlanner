import fs from 'node:fs';
import { extractTopLevelRows, extractTopLevelCells } from '../src/lib/export/docx-xml.ts';

const ex = fs.readFileSync('.tmp-docx-debug/example/word/document.xml', 'utf8');

function extractTopLevelTables(xml) {
	const tables = [];
	let depth = 0;
	let start = -1;
	let i = 0;
	while (i < xml.length) {
		const open = xml.indexOf('<w:tbl>', i);
		const close = xml.indexOf('</w:tbl>', i);
		if (open === -1 && close === -1) break;
		if (open !== -1 && (close === -1 || open < close)) {
			if (depth === 0) start = open;
			depth++;
			i = open + 7;
		} else {
			depth--;
			if (depth === 0) tables.push(xml.slice(start, close + 8));
			i = close + 8;
		}
	}
	return tables;
}

const w = extractTopLevelTables(ex)[5].slice(7, -8);
const rows = extractTopLevelRows(w);
console.log('top-level rows:', rows.length);
rows.forEach((row, ri) => {
	const cells = extractTopLevelCells(row);
	const widths = cells.map((c) => c.match(/tcW w:w="(\d+)"/)?.[1] ?? '?');
	const span = cells.map((c) => c.match(/gridSpan w:val="(\d+)"/)?.[1] ?? '1');
	console.log(`WR${ri}: ${cells.length} cells w=[${widths}] span=[${span}]`);
});
