import fs from 'node:fs';

const xml = fs.readFileSync('.tmp-docx-debug/export/word/document.xml', 'utf8');

function extractTopLevelTables(x) {
	const tables = [];
	let depth = 0;
	let start = -1;
	let i = 0;
	while (i < x.length) {
		const open = x.indexOf('<w:tbl>', i);
		const close = x.indexOf('</w:tbl>', i);
		if (open === -1 && close === -1) break;
		if (open !== -1 && (close === -1 || open < close)) {
			if (depth === 0) start = open;
			depth++;
			i = open + 7;
		} else {
			depth--;
			if (depth === 0) tables.push(x.slice(start, close + 8));
			i = close + 8;
		}
	}
	return tables;
}

function findBalancedClose(x, start, openTag, closeTag) {
	let depth = 0;
	let i = start;
	while (i < x.length) {
		if (x.startsWith(openTag, i)) {
			depth++;
			i += openTag.length;
			continue;
		}
		if (x.startsWith(closeTag, i)) {
			depth--;
			if (depth === 0) return i + closeTag.length;
			i += closeTag.length;
			continue;
		}
		i++;
	}
	return -1;
}

function findCellEnd(x, start) {
	let i = start + 4;
	let tblDepth = 0;
	while (i < x.length) {
		if (x.startsWith('<w:tbl>', i)) {
			tblDepth++;
			i += 7;
			continue;
		}
		if (x.startsWith('</w:tbl>', i)) {
			tblDepth--;
			i += 8;
			continue;
		}
		if (x.startsWith('</w:tc>', i) && tblDepth === 0) return i + 7;
		i++;
	}
	return -1;
}

function extractTopLevelCells(rowXml) {
	const cells = [];
	let i = 0;
	while (i < rowXml.length) {
		if (rowXml.startsWith('<w:tbl>', i)) {
			const close = findBalancedClose(rowXml, i, '<w:tbl>', '</w:tbl>');
			if (close < 0) break;
			i = close;
			continue;
		}
		const tcStart = rowXml.indexOf('<w:tc', i);
		if (tcStart < 0) break;
		const tcEnd = findCellEnd(rowXml, tcStart);
		if (tcEnd < 0) break;
		cells.push(rowXml.slice(tcStart, tcEnd));
		i = tcEnd;
	}
	return cells;
}

function side(cell, name) {
	const b = cell.match(/<w:tcBorders>[\s\S]*?<\/w:tcBorders>/)?.[0] ?? '';
	return b.match(new RegExp(`<w:${name} w:val="([^"]*)"`))?.[1] ?? '-';
}

const w = extractTopLevelTables(xml)[5].slice(7, -8);
const rows = [...w.matchAll(/<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/g)];

for (const ri of [0, 1, 2, 9]) {
	const row = rows[ri][0];
	if (row.includes('<w:tbl>')) {
		// use row end finder - for WR0 with nested, the simple regex is wrong
	}
}

// Better: walk top-level rows
let i = 0;
let rowIndex = 0;
while (i < w.length) {
	if (w.startsWith('<w:tbl>', i)) {
		const close = findBalancedClose(w, i, '<w:tbl>', '</w:tbl>');
		i = close;
		continue;
	}
	const trStart = w.indexOf('<w:tr', i);
	if (trStart < 0) break;
	let j = trStart + 4;
	let tblDepth = 0;
	while (j < w.length) {
		if (w.startsWith('<w:tbl>', j)) {
			tblDepth++;
			j += 7;
			continue;
		}
		if (w.startsWith('</w:tbl>', j)) {
			tblDepth--;
			j += 8;
			continue;
		}
		if (w.startsWith('</w:tr>', j) && tblDepth === 0) {
			const rowXml = w.slice(trStart, j + 7);
			if ([0, 1, 2, 9].includes(rowIndex)) {
				const cells = extractTopLevelCells(rowXml);
				console.log(`WR${rowIndex} (${cells.length} top-level cells):`);
				cells.forEach((c, ci) => {
					const nested = c.includes('<w:tbl>') ? 'TBL' : '';
					console.log(
						`  C${ci} ${nested} R=${side(c, 'right')} L=${side(c, 'left')} T=${side(c, 'top')} B=${side(c, 'bottom')}`
					);
				});
			}
			rowIndex++;
			i = j + 7;
			break;
		}
		j++;
	}
}
