import fs from 'node:fs';

const ex = fs.readFileSync('.tmp-docx-debug/export/word/document.xml', 'utf8');

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
const rows = [...w.matchAll(/<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/g)];

rows.forEach((rm, ri) => {
	const cells = [...rm[1].matchAll(/<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/g)];
	const hasTbl = rm[0].includes('<w:tbl>');
	if (hasTbl || ri <= 2 || ri >= 8) {
		console.log(`WR${ri} nested=${hasTbl} cells=${cells.length}`);
		cells.forEach((c, ci) => {
			if (c[0].includes('<w:tbl>')) console.log(`  C${ci} NESTED TABLE`);
		});
	}
});
