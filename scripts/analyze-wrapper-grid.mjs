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
const grid = wInner.match(/<w:tblGrid>[\s\S]*?<\/w:tblGrid>/)?.[0];
const widths = [...(grid?.matchAll(/w:w="(\d+)"/g) ?? [])].map((m) => m[1]);
console.log('Wrapper grid:', widths, 'total', widths.reduce((a, b) => +a + +b, 0));

const rows = [...wInner.matchAll(/<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/g)];
rows.slice(0, 3).forEach((rm, ri) => {
	const cells = [...rm[1].matchAll(/<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/g)];
	console.log(`\nWR${ri} ${cells.length} cells:`);
	cells.forEach((cm, ci) => {
		const span = cm[0].match(/gridSpan w:val="(\d+)"/)?.[1] ?? '1';
		const w = cm[0].match(/tcW w:w="(\d+)"/)?.[1] ?? '?';
		const nested = cm[0].includes('<w:tbl>') ? 'NESTED' : '';
		const text = [...cm[1].matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('').slice(0, 15);
		console.log(`  C${ci} span=${span} w=${w} ${nested} "${text}"`);
	});
});
