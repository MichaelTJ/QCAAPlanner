import fs from 'node:fs';

const xml = fs.readFileSync('.tmp-docx-debug/example/word/document.xml', 'utf8');

function extractTablesNested(xml) {
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

function cellText(s) {
	return [...s.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
}

const t5 = extractTablesNested(xml)[5];
const inner = t5.slice(7, -8); // strip outer wrapper

const nestedPositions = [];
let pos = 0;
while ((pos = inner.indexOf('<w:tbl>', pos)) !== -1) {
	nestedPositions.push(pos);
	pos += 7;
}
console.log('Nested tables inside T5:', nestedPositions.length);

nestedPositions.forEach((p, i) => {
	// extract this nested table with depth counter
	let depth = 0;
	let j = p;
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
	const nested = inner.slice(p, end);
	const rows = (nested.match(/<w:tr\b/g) || []).length;
	const cols = (nested.match(/<w:gridCol/g) || []).length;
	const label = cellText(nested).trim().slice(0, 80);
	console.log(`\nNested ${i}: ${rows} rows, ${cols} cols`);
	console.log('  Label:', label);
});

// What's before first nested table?
const before = inner.slice(0, nestedPositions[0] ?? inner.length);
console.log('\nBefore first nested (length):', before.length);
console.log('Text before:', cellText(before).trim().slice(0, 100));
