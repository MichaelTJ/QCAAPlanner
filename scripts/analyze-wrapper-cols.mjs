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

function ownTblGrid(inner) {
	const end = inner.indexOf('<w:tr');
	const head = inner.slice(0, end > 0 ? end : inner.length);
	const m = head.match(/<w:tblGrid>[\s\S]*?<\/w:tblGrid>/)?.[0] ?? '';
	return [...m.matchAll(/w:w="(\d+)"/g)].map((x) => x[1]);
}

function ownTblW(inner) {
	const m = inner.match(/<w:tblPr>[\s\S]*?<\/w:tblPr>/)?.[0] ?? '';
	return m.match(/<w:tblW w:w="(\d+)"/)?.[1];
}

const wrapper = extractTopLevelTables(ex)[5].slice(7, -8);
console.log('Wrapper own grid:', ownTblGrid(wrapper));
console.log('Wrapper tblW:', ownTblW(wrapper));

// Content before first row in wrapper (between tblGrid and first tr)
const gridEnd = wrapper.indexOf('</w:tblGrid>') + 12;
const firstTr = wrapper.indexOf('<w:tr');
const between = wrapper.slice(gridEnd, firstTr);
console.log('\nBetween tblGrid and first tr:', JSON.stringify(between.slice(0, 500)));

// First row top-level cells - paras at start of each cell
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

const row0end = wrapper.indexOf('</w:tr>') + 7;
// wrong - need findRowEnd. Just scan first row simply from first tr
const trStart = wrapper.indexOf('<w:tr');
let j = trStart + 4;
let tblDepth = 0;
while (j < wrapper.length) {
	if (wrapper.startsWith('<w:tbl>', j)) {
		tblDepth++;
		j += 7;
		continue;
	}
	if (wrapper.startsWith('</w:tbl>', j)) {
		tblDepth--;
		j += 8;
		continue;
	}
	if (wrapper.startsWith('</w:tr>', j) && tblDepth === 0) {
		const row = wrapper.slice(trStart, j + 7);
		let i = 0;
		let ci = 0;
		while (i < row.length) {
			if (row.startsWith('<w:tbl>', i)) {
				let d = 0;
				let k = i;
				while (k < row.length) {
					if (row.startsWith('<w:tbl>', k)) d++;
					if (row.startsWith('</w:tbl>', k)) {
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
			const tcStart = row.indexOf('<w:tc', i);
			if (tcStart < 0) break;
			const tcEnd = findCellEnd(row, tcStart);
			const cell = row.slice(tcStart, tcEnd);
			const tcW = cell.match(/tcW w:w="(\d+)"/)?.[1];
			const paras = [...cell.matchAll(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g)];
			const firstPara = paras[0]?.[1] ?? '';
			const text = [...firstPara.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
			const emptyPara = !text.trim() && !firstPara.includes('<w:tbl>');
			console.log(`\nWR0 C${ci} tcW=${tcW} paras=${paras.length} firstEmpty=${emptyPara}`);
			if (emptyPara) console.log('  first para:', firstPara.slice(0, 200));
			ci++;
			i = tcEnd;
		}
		break;
	}
	j++;
}

// Cap nested
const capStart = wrapper.indexOf('<w:tbl>');
const capEnd = wrapper.indexOf('</w:tbl>', capStart) + 8;
const capInner = wrapper.slice(capStart + 7, capEnd - 8);
console.log('\nCap nested grid:', ownTblGrid(capInner));
console.log('Cap col1 dxa:', ownTblGrid(capInner)[0]);
