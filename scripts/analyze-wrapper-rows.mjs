import fs from 'node:fs';

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
			let d = 0;
			let k = i;
			while (k < rowXml.length) {
				if (rowXml.startsWith('<w:tbl>', k)) d++;
				if (rowXml.startsWith('</w:tbl>', k)) {
					d--;
					if (d === 0) {
						i = k + 8;
						break;
					}
				}
				k++;
			}
			continue;
		}
		const tcStart = rowXml.indexOf('<w:tc', i);
		if (tcStart < 0) break;
		const tcEnd = findCellEnd(rowXml, tcStart);
		cells.push(rowXml.slice(tcStart, tcEnd));
		i = tcEnd;
	}
	return cells;
}

const w = extractTopLevelTables(ex)[5].slice(7, -8);
let i = 0;
let ri = 0;
while (i < w.length) {
	if (w.startsWith('<w:tbl>', i)) {
		let d = 0;
		let k = i;
		while (k < w.length) {
			if (w.startsWith('<w:tbl>', k)) d++;
			if (w.startsWith('</w:tbl>', k)) {
				d--;
				if (d === 0) {
					i = k + 8;
					break;
				}
			}
			k++;
		}
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
			const row = w.slice(trStart, j + 7);
			const cells = extractTopLevelCells(row);
			const widths = cells.map((c) => c.match(/tcW w:w="(\d+)"/)?.[1]);
			console.log(`WR${ri}: ${cells.length} cells widths=${widths.join(',')}`);
			ri++;
			i = j + 7;
			break;
		}
		j++;
	}
}
