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

function extractNested(xml) {
	const inner = xml.slice(7, -8);
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

const wrapper = extractTopLevelTables(nw)[5];
const nested = extractNested(wrapper);

function analyzeBorders(label, tbl) {
	const inner = tbl.slice(7, -8);
	const tblBorders = inner.match(/<w:tblBorders>[\s\S]*?<\/w:tblBorders>/)?.[0];
	console.log(`\n=== ${label} tblBorders ===`);
	console.log(tblBorders ?? 'none');

	const firstCell = inner.match(/<w:tc\b[^>]*>[\s\S]*?<\/w:tc>/)?.[0] ?? '';
	const tcBorders = firstCell.match(/<w:tcBorders>[\s\S]*?<\/w:tcBorders>/)?.[0];
	console.log('First cell tcBorders:', tcBorders?.slice(0, 300) ?? 'none');

	// Last cell in first data row
	const row = inner.match(/<w:tr\b[^>]*>[\s\S]*?<\/w:tr>/g)?.[2] ?? '';
	const cells = [...row.matchAll(/<w:tc\b[^>]*>[\s\S]*?<\/w:tc>/g)];
	const last = cells[cells.length - 1]?.[0] ?? '';
	const lastBorders = last.match(/<w:tcBorders>[\s\S]*?<\/w:tcBorders>/)?.[0];
	console.log('Last cell in row2 tcBorders:', lastBorders ?? 'none');
}

// Compare with assessment table (T2)
analyzeBorders('Assessment T2', extractTopLevelTables(nw)[2]);
analyzeBorders('General capabilities nested 0', nested[0]);
analyzeBorders('Cross-curriculum nested 1', nested[1]);
