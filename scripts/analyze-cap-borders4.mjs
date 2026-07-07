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
const capStart = w.indexOf('<w:tbl>');
const capEnd = w.indexOf('</w:tbl>', capStart) + 8;
const cap = w.slice(capStart, capEnd).slice(7, -8);
const rows = [...cap.matchAll(/<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/g)];

let issues = 0;
rows.forEach((rm, ri) => {
	const cells = [...rm[1].matchAll(/<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/g)];
	cells.forEach((cm, ci) => {
		const r = cm[0].match(/<w:right w:val="([^"]*)"/);
		if (r && r[1] !== 'single') {
			console.log(`R${ri} C${ci} right=${r[1]}`);
			issues++;
		}
		if (ci === cells.length - 1 && (!r || r[1] !== 'single')) {
			console.log(`LAST R${ri} right=${r ? r[1] : 'missing'}`);
			issues++;
		}
	});
});
console.log('issues:', issues);

// Check tblPr tblStyle
const tblPr = cap.match(/<w:tblPr>[\s\S]*?<\/w:tblPr>/)?.[0] ?? '';
console.log('\ntblPr snippet:', tblPr.slice(0, 400));
