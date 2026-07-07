import fs from 'node:fs';

const nw = fs.readFileSync('.tmp-docx-debug/export/word/document.xml', 'utf8');
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

function getTblPr(tableXml) {
	const inner = tableXml.slice(7, -8);
	const m = inner.match(/<w:tblPr>[\s\S]*?<\/w:tblPr>/);
	return m?.[0] ?? 'NO tblPr';
}

const nwTables = extractTopLevelTables(nw);
const exTables = extractTopLevelTables(ex);

console.log('=== Content descriptions (T4) tblPr export ===');
console.log(getTblPr(nwTables[4]));

const w = nwTables[5].slice(7, -8);
const capStart = w.indexOf('<w:tbl>');
const capEnd = w.indexOf('</w:tbl>') + 8;
const cap = w.slice(capStart, capEnd);

console.log('\n=== General capabilities nested tblPr export ===');
console.log(getTblPr(cap));

console.log('\n=== Wrapper T5 tblPr export ===');
console.log(getTblPr(nwTables[5]));

// Compare with example
const exW = exTables[5].slice(7, -8);
const exCap = exW.slice(exW.indexOf('<w:tbl>'), exW.indexOf('</w:tbl>') + 8);
console.log('\n=== General capabilities nested tblPr EXAMPLE ===');
console.log(getTblPr(exCap));
