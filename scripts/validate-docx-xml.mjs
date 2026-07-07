import fs from 'node:fs';
import AdmZip from 'adm-zip';
import {
	extractTopLevelTables,
	unwrapTable,
	extractRows,
	extractCells
} from '../src/lib/export/docx-xml.ts';

function gridColCount(inner) {
	return (inner.match(/<w:gridCol/g) || []).length;
}

function rowSpanSum(row) {
	const cells = extractCells(row);
	return cells.reduce((sum, c) => {
		const span = +(c.match(/gridSpan w:val="(\d+)"/)?.[1] ?? 1);
		return sum + span;
	}, 0);
}

function validateTable(inner, label) {
	const cols = gridColCount(inner);
	const rows = extractRows(inner);
	const issues = [];
	rows.forEach((row, ri) => {
		const cells = extractCells(row);
		const spanSum = rowSpanSum(row);
		if (spanSum !== cols) {
			issues.push(`R${ri}: spanSum=${spanSum} cols=${cols} physical=${cells.length}`);
		}
	});
	if (issues.length) {
		console.log(`\n${label}:`);
		issues.forEach((i) => console.log(' ', i));
	}
	return issues.length;
}

function findContent(doc) {
	const tables = extractTopLevelTables(doc);
	for (let i = tables.length - 2; i >= 0; i--) {
		const inner = unwrapTable(tables[i]);
		if (inner.includes('Knowledge and understanding')) return inner;
	}
}

function getNested(wrapperInner, n) {
	let pos = 0;
	let idx = 0;
	while (pos < wrapperInner.length) {
		const o = wrapperInner.indexOf('<w:tbl>', pos);
		if (o < 0) break;
		let d = 0;
		let j = o;
		while (j < wrapperInner.length) {
			if (wrapperInner.startsWith('<w:tbl>', j)) d++;
			if (wrapperInner.startsWith('</w:tbl>', j)) {
				d--;
				if (d === 0) {
					if (idx === n) return unwrapTable(wrapperInner.slice(o + 7, j));
					idx++;
					pos = j + 8;
					break;
				}
			}
			j++;
		}
	}
}

function validateFile(file) {
	console.log(`\n======== ${file} ========`);
	const doc = new AdmZip(file).getEntry('word/document.xml').getData().toString('utf8');
	let total = 0;
	total += validateTable(findContent(doc), 'content');
	const wrapper = unwrapTable(extractTopLevelTables(doc).at(-1));
	total += validateTable(getNested(wrapper, 0), 'cap');
	total += validateTable(getNested(wrapper, 1), 'ccp');
	if (total === 0) console.log('All span checks OK');
	else console.log(`${total} span issues`);
}

for (const f of [
	'data/exports/design-and-technologies-band-9-10-2026-2units.docx',
	'data/exports/design-and-technologies-band-9-10-2026-6units.docx',
	'data/exports/design-and-technologies-band-9-10-2026.docx'
]) {
	if (fs.existsSync(f)) validateFile(f);
}
