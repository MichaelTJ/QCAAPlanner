import fs from 'node:fs';

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

function side(cell, name) {
	const b = cell.match(/<w:tcBorders>[\s\S]*?<\/w:tcBorders>/)?.[0] ?? '';
	return b.match(new RegExp(`<w:${name} w:val="([^"]*)"`))?.[1] ?? '-';
}

const w = extractTopLevelTables(ex)[5].slice(7, -8);
const rows = [...w.matchAll(/<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/g)];

for (const ri of [0, 1, 2, 8, 9, 10]) {
	const cells = [...rows[ri][1].matchAll(/<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/g)];
	console.log(`WR${ri}:`);
	cells.forEach((c, ci) => {
		const nested = c[0].includes('<w:tbl>') ? 'TBL' : '';
		console.log(
			`  C${ci} ${nested} L=${side(c[0], 'left')} R=${side(c[0], 'right')} T=${side(c[0], 'top')} B=${side(c[0], 'bottom')}`
		);
	});
}

const tblPr = w.match(/<w:tblPr>[\s\S]*?<\/w:tblPr>/)?.[0] ?? '';
console.log('\ntblBorders in wrapper:', tblPr.includes('tblBorders'));
