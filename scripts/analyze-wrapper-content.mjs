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

const wInner = extractTopLevelTables(nw)[5].slice(7, -8);
const rows = [...wInner.matchAll(/<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/g)];

function cellSummary(cellXml) {
	const hasSym = cellXml.includes('<w:sym');
	const text = [...cellXml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
	const hasTbl = cellXml.includes('<w:tbl>');
	return `${hasTbl ? 'TBL' : text.trim().slice(0, 12) || (hasSym ? 'TICK' : 'empty')}`;
}

console.log('Wrapper rows 0-3:');
rows.slice(0, 4).forEach((rm, ri) => {
	const cells = [...rm[1].matchAll(/<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/g)];
	console.log(`WR${ri}: ${cells.map((c) => cellSummary(c[0])).join(' | ')}`);
});

// WR9 for CCP
console.log('\nWR9:', [...rows[9][1].matchAll(/<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/g)].map((c) => cellSummary(c[0])).join(' | '));
