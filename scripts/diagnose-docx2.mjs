import fs from 'node:fs';
import AdmZip from 'adm-zip';
import {
	extractTopLevelTables,
	unwrapTable,
	extractRows,
	extractCells,
	extractTopLevelRows,
	extractTopLevelCells
} from '../src/lib/export/docx-xml.ts';

function findContentInner(doc) {
	const tables = extractTopLevelTables(doc);
	for (let i = tables.length - 2; i >= 0; i--) {
		const inner = unwrapTable(tables[i]);
		if (inner.includes('Knowledge and understanding')) return { inner, idx: i };
	}
}

function getNestedCap(wrapperInner) {
	const open = wrapperInner.indexOf('<w:tbl>');
	const close = wrapperInner.indexOf('</w:tbl>', open) + 8;
	return unwrapTable(wrapperInner.slice(open, close));
}

for (const file of [
	'data/exports/design-and-technologies-band-9-10-2026-2units.docx',
	'data/exports/design-and-technologies-band-9-10-2026-6units.docx'
]) {
	const doc = new AdmZip(file).getEntry('word/document.xml').getData().toString('utf8');
	const { inner: content, idx } = findContentInner(doc);
	const grid = (content.match(/<w:tblGrid>[\s\S]*?<\/w:tblGrid>/)?.[0].match(/gridCol/g) || []).length;
	const rows = extractRows(content);

	console.log(`\n=== ${file} content T${idx} grid=${grid} ===`);
	rows.forEach((row, ri) => {
		const cells = extractCells(row);
		const spans = cells.map((c) => c.match(/gridSpan w:val="(\d+)"/)?.[1] ?? '1');
		if (cells.length !== grid) {
			console.log(`R${ri}: ${cells.length} cells spans=[${spans}] (grid ${grid})`);
		}
	});

	const wrapper = unwrapTable(extractTopLevelTables(doc).at(-1));
	const cap = getNestedCap(wrapper);
	const capGrid = (cap.match(/<w:tblGrid>[\s\S]*?<\/w:tblGrid>/)?.[0].match(/gridCol/g) || []).length;
	const capRows = extractRows(cap);
	console.log(`Cap nested grid=${capGrid}`);
	capRows.slice(0, 3).forEach((row, ri) => {
		const cells = extractCells(row);
		const spans = cells.map((c) => c.match(/gridSpan w:val="(\d+)"/)?.[1] ?? '1');
		console.log(`  Cap R${ri}: ${cells.length} cells spans=[${spans}]`);
	});

	const wRows = extractTopLevelRows(wrapper);
	console.log(`Wrapper top-level rows: ${wRows.length}`);
	wRows.forEach((row, ri) => {
		console.log(`  WR${ri}: ${extractTopLevelCells(row).length} cells`);
	});
}
