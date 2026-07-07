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

function extractNested(wrapper) {
	const inner = wrapper.slice(7, -8);
	const nested = [];
	let pos = 0;
	while ((pos = inner.indexOf('<w:tbl>', pos)) !== -1) {
		let depth = 0;
		let j = pos;
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
		nested.push(inner.slice(pos, end));
		pos = end;
	}
	return nested;
}

function rightBorderVal(cellXml) {
	return cellXml.match(/<w:right w:val="([^"]*)"/)?.[1] ?? 'missing';
}

const cap = extractNested(extractTopLevelTables(nw)[5])[0];
const inner = cap.slice(7, -8);
const rows = [...inner.matchAll(/<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/g)];

console.log('=== General capabilities - right border per row, last cell ===');
rows.forEach((rm, ri) => {
	const cells = [...rm[1].matchAll(/<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/g)];
	const last = cells[cells.length - 1]?.[0] ?? '';
	console.log(`R${ri} cols=${cells.length} right=${rightBorderVal(last)}`);
});

console.log('\n=== Wrapper table structure ===');
const wrapper = extractTopLevelTables(nw)[5];
const winner = wrapper.slice(7, -8);
const wrapperRows = [...winner.matchAll(/<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/g)];
wrapperRows.forEach((rm, ri) => {
	const cells = [...rm[1].matchAll(/<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/g)];
	cells.forEach((cm, ci) => {
		const hasNested = cm[0].includes('<w:tbl>');
		const rb = rightBorderVal(cm[0]);
		const lb = cm[0].match(/<w:left w:val="([^"]*)"/)?.[1];
		console.log(`WR${ri} C${ci} nested=${hasNested} left=${lb} right=${rb}`);
	});
});

// Compare last col all rows with content table last col
const cd = extractTopLevelTables(nw)[4];
const cdInner = cd.slice(7, -8);
const cdRows = [...cdInner.matchAll(/<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/g)];
console.log('\n=== Content table - last cell right border ===');
cdRows.slice(0, 5).forEach((rm, ri) => {
	const cells = [...rm[1].matchAll(/<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/g)];
	const last = cells[cells.length - 1]?.[0] ?? '';
	console.log(`R${ri} right=${rightBorderVal(last)}`);
});
