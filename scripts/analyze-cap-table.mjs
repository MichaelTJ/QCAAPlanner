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
			if (depth === 0) {
				tables.push(xml.slice(start, close + 8));
			}
			i = close + 8;
		}
	}
	return tables;
}

function extractRows(tableXml) {
	const rows = [];
	const re = /<w:tr\b[^>]*>[\s\S]*?<\/w:tr>/g;
	let m;
	while ((m = re.exec(tableXml))) rows.push(m[0]);
	return rows;
}

function cellText(cellXml) {
	return [...cellXml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
}

function extractCells(rowXml) {
	const cells = [];
	const re = /<w:tc\b[^>]*>[\s\S]*?<\/w:tc>/g;
	let m;
	while ((m = re.exec(rowXml))) cells.push(m[0]);
	return cells;
}

const tables = extractTablesNested(xml);
const capTable = tables[5];
console.log('T5 length:', capTable.length);
console.log('Nested tbl count:', (capTable.match(/<w:tbl>/g) || []).length);

// Find nested tables positions
let pos = 0;
let n = 0;
while ((pos = capTable.indexOf('<w:tbl>', pos)) !== -1) {
	const inner = capTable.slice(pos, pos + 200);
	const text = cellText(inner).slice(0, 60);
	console.log(`\nNested ${n} at ${pos}: ${text}`);
	pos += 7;
	n++;
}

// Top-level rows of T5 (not in nested)
const beforeFirstNested = capTable.split('<w:tbl>')[0];
const topRows = extractRows(beforeFirstNested);
console.log('\nTop-level rows before nested:', topRows.length);
topRows.forEach((r, i) => {
	const texts = extractCells(r).map(cellText).filter((t) => t.trim());
	if (texts.length) console.log(`  R${i}:`, texts.join(' | '));
});
