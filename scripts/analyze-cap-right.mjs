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

function getNestedCap(xml) {
	const w = extractTopLevelTables(xml)[5].slice(7, -8);
	return w.slice(w.indexOf('<w:tbl>'), w.indexOf('</w:tbl>') + 8);
}

const cap = getNestedCap(nw);
const inner = cap.slice(7, -8);
const rows = [...inner.matchAll(/<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/g)];

console.log('Last column all sides per row:');
rows.forEach((rm, ri) => {
	const cells = [...rm[1].matchAll(/<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/g)];
	const last = cells[cells.length - 1][0];
	const borders = last.match(/<w:tcBorders>[\s\S]*?<\/w:tcBorders>/)?.[0] ?? 'NO BORDERS';
	const sides = ['top','left','bottom','right'].map(s => {
		const v = borders.match(new RegExp(`<w:${s} w:val="([^"]*)"`))?.[1] ?? '-';
		return `${s}=${v}`;
	}).join(' ');
	console.log(`R${ri}: ${sides}`);
});

// Check if any cell in entire table has right != single
let issues = 0;
rows.forEach((rm, ri) => {
	const cells = [...rm[1].matchAll(/<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/g)];
	cells.forEach((cm, ci) => {
		const right = cm[0].match(/<w:right w:val="([^"]*)"/)?.[1];
		if (right && right !== 'single') {
			console.log(`R${ri} C${ci} right=${right}`);
			issues++;
		}
		if (!right) {
			console.log(`R${ri} C${ci} right=MISSING`);
			issues++;
		}
	});
});
console.log(`Non-single right borders: ${issues}`);

// tblGrid widths
const grid = inner.match(/<w:tblGrid>[\s\S]*?<\/w:tblGrid>/)?.[0];
const widths = [...(grid?.matchAll(/w:w="(\d+)"/g) ?? [])].map(m => m[1]);
console.log('\nGrid cols:', widths.length, 'widths:', widths);
console.log('Total:', widths.reduce((a,b)=>+a+(+b),0));
