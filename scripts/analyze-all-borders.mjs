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

function borderVal(cell, side) {
	const borders = cell.match(/<w:tcBorders>[\s\S]*?<\/w:tcBorders>/)?.[0] ?? '';
	return borders.match(new RegExp(`<w:${side} w:val="([^"]*)"`))?.[1] ?? 'MISSING';
}

function analyzeTable(tableXml, name) {
	const inner = tableXml.slice(7, -8);
	const rows = [...inner.matchAll(/<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/g)];
	console.log(`\n=== ${name} (${rows.length} rows) ===`);
	rows.forEach((rm, ri) => {
		const cells = [...rm[1].matchAll(/<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/g)];
		const last = cells.length - 1;
		cells.forEach((cm, ci) => {
			if (ci === 0 || ci === last) {
				const text = [...cm[1].matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('').slice(0, 20);
				console.log(`R${ri} C${ci}/${last} L=${borderVal(cm[0],'left')} R=${borderVal(cm[0],'right')} "${text}"`);
			}
		});
	});
}

const tables = extractTopLevelTables(nw);
analyzeTable(tables[4], 'Content descriptions T4');

const wInner = tables[5].slice(7, -8);
const wrapperRows = [...wInner.matchAll(/<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/g)];
console.log('\n=== Wrapper T5 outer cells ===');
wrapperRows.forEach((rm, ri) => {
	const cells = [...rm[1].matchAll(/<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/g)];
	cells.forEach((cm, ci) => {
		const hasNested = cm[0].includes('<w:tbl>');
		if (hasNested || ci === cells.length - 1) {
			console.log(`WR${ri} C${ci} nested=${hasNested} L=${borderVal(cm[0],'left')} R=${borderVal(cm[0],'right')} T=${borderVal(cm[0],'top')} B=${borderVal(cm[0],'bottom')}`);
		}
	});
});

const capStart = wInner.indexOf('<w:tbl>');
const capEnd = wInner.indexOf('</w:tbl>') + 8;
analyzeTable(wInner.slice(capStart, capEnd), 'General capabilities nested');

const ccpStart = wInner.indexOf('<w:tbl>', capEnd - 8);
const ccpEnd = wInner.indexOf('</w:tbl>', ccpStart) + 8;
analyzeTable(wInner.slice(ccpStart, ccpEnd), 'Cross-curriculum nested');
