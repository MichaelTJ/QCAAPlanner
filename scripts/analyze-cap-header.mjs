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

const w = extractTopLevelTables(nw)[5].slice(7, -8);
const cap = w.slice(w.indexOf('<w:tbl>'), w.indexOf('</w:tbl>') + 8).slice(7, -8);
const row0 = cap.match(/<w:tr\b[^>]*>[\s\S]*?<\/w:tr>/)?.[0] ?? '';
const cells = [...row0.matchAll(/<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/g)];
cells.forEach((cm, ci) => {
	const span = cm[0].match(/gridSpan w:val="(\d+)"/)?.[1] ?? '1';
	const text = [...cm[1].matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
	const borders = cm[0].match(/<w:tcBorders>[\s\S]*?<\/w:tcBorders>/)?.[0] ?? '';
	const right = borders.match(/<w:right w:val="([^"]*)"/)?.[1];
	console.log(`C${ci} span=${span} text="${text.trim()}" right=${right}`);
});

// Row 1 header
const rows = [...cap.matchAll(/<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/g)];
const row1 = rows[1]?.[1] ?? '';
const cells1 = [...row1.matchAll(/<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/g)];
console.log('\nRow 1:');
cells1.forEach((cm, ci) => {
	const text = [...cm[1].matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
	const right = cm[0].match(/<w:right w:val="([^"]*)"/)?.[1];
	console.log(`C${ci} text="${text.trim()}" right=${right}`);
});
