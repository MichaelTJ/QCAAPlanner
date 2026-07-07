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

rows.forEach((rm, ri) => {
	const cells = [...rm[1].matchAll(/<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/g)];
	console.log(`WR${ri}:`);
	cells.forEach((cm, ci) => {
		const vMerge = cm[0].includes('vMerge') ? (cm[0].includes('vMerge w:val="restart"') ? 'restart' : 'continue') : '-';
		const gridSpan = cm[0].match(/gridSpan w:val="(\d+)"/)?.[1] ?? '1';
		const nested = cm[0].includes('<w:tbl>') ? 'TBL' : '';
		const right = cm[0].match(/<w:right w:val="([^"]*)"/)?.[1] ?? '-';
		console.log(`  C${ci} vMerge=${vMerge} span=${gridSpan} ${nested} right=${right}`);
	});
});
