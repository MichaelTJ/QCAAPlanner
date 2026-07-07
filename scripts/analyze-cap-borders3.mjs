import fs from 'node:fs';

const nw = fs.readFileSync('.tmp-docx-debug/export/word/document.xml', 'utf8');

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

const wrapper = extractTopLevelTables(nw)[5];
const inner = wrapper.slice(7, -8);

// Find nested table positions
let pos = 0;
let n = 0;
while ((pos = inner.indexOf('<w:tbl>', pos)) !== -1) {
	let depth = 0;
	let j = pos;
	let end = -1;
	while (j < inner.length) {
		const o = inner.indexOf('<w:tbl>', j);
		const c = inner.indexOf('</w:tbl>', j);
		if (o !== -1 && (c === -1 || o < c)) {
			depth++;
			j = o + 7;
		} else if (c !== -1) {
			depth--;
			if (depth === 0) {
				end = c + 8;
				break;
			}
			j = c + 8;
		} else break;
	}
	const nested = inner.slice(pos, end);
	const label = [...nested.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).find((t) => t.includes('capabilities') || t.includes('Cross')) ?? `nested${n}`;
	console.log(`\n${label} at ${pos}, len ${nested.length}`);
	// parent cell - text before nested at pos
	const before = inner.slice(Math.max(0, pos - 800), pos);
	const tcStart = before.lastIndexOf('<w:tc');
	const parentCell = before.slice(tcStart) + nested.slice(0, 200);
	const tcBorders = parentCell.match(/<w:tcBorders>[\s\S]*?<\/w:tcBorders>/)?.[0];
	console.log('Parent cell borders:', tcBorders);

	// last column cells in nested table
	const nInner = nested.slice(7, -8);
	const rows = [...nInner.matchAll(/<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/g)];
	const lastRow = rows[rows.length - 1]?.[1] ?? '';
	const cells = [...lastRow.matchAll(/<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/g)];
	const lastCell = cells[cells.length - 1]?.[0] ?? '';
	console.log(
		'Nested last cell right:',
		lastCell.match(/<w:right w:val="([^"]*)"/)?.[1],
		'full:',
		lastCell.match(/<w:tcBorders>[\s\S]*?<\/w:tcBorders>/)?.[0]
	);

	pos = end;
	n++;
}

// What's between the two nested tables?
const firstEnd = inner.indexOf('</w:tbl>') + 8;
const secondStart = inner.indexOf('<w:tbl>', firstEnd);
console.log('\nBetween nested tables:', JSON.stringify(inner.slice(firstEnd, secondStart).slice(0, 200)));
