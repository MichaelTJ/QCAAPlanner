import fs from 'node:fs';
import AdmZip from 'adm-zip';
import {
	extractTopLevelTables,
	unwrapTable,
	extractRows,
	extractCells
} from '../src/lib/export/docx-xml.ts';

function ownGrid(inner) {
	const head = inner.slice(0, inner.indexOf('<w:tr'));
	const grid = head.match(/<w:tblGrid>[\s\S]*?<\/w:tblGrid>/)?.[0] ?? '';
	return [...grid.matchAll(/w:w="(\d+)"/g)].map((m) => +m[1]);
}

function getNested(wrapperInner, index) {
	let pos = 0;
	let n = 0;
	while (pos < wrapperInner.length) {
		const open = wrapperInner.indexOf('<w:tbl>', pos);
		if (open < 0) break;
		let depth = 0;
		let j = open;
		while (j < wrapperInner.length) {
			if (wrapperInner.startsWith('<w:tbl>', j)) depth++;
			if (wrapperInner.startsWith('</w:tbl>', j)) {
				depth--;
				if (depth === 0) {
					if (n === index) return unwrapTable(wrapperInner.slice(open + 7, j));
					n++;
					pos = j + 8;
					break;
				}
			}
			j++;
		}
	}
	throw new Error(`Nested ${index} not found`);
}

function findContentTable(tables) {
	for (let i = tables.length - 2; i >= 0; i--) {
		const inner = unwrapTable(tables[i]);
		if (inner.includes('Knowledge and understanding')) return inner;
	}
	throw new Error('content table not found');
}

function analyze(file, expectedUnits) {
	const entry = new AdmZip(file).getEntry('word/document.xml');
	const doc = entry.getData().toString('utf8');
	const tables = extractTopLevelTables(doc);
	const content = findContentTable(tables);
	const wrapper = unwrapTable(tables[tables.length - 1]);
	const cap = getNested(wrapper, 0);
	const ccp = getNested(wrapper, 1);

	const contentCols = ownGrid(content).length;
	const capCols = ownGrid(cap).length;
	const ccpCols = ownGrid(ccp).length;
	const capUnits = extractCells(extractRows(cap)[1])
		.slice(1)
		.map((c) => [...c.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join(''))
		.join(',');

	const contentR1 = extractCells(extractRows(content)[1]).length;
	const expectedContentCols = 2 + 2 * expectedUnits;

	console.log(`\n${file} (${expectedUnits} units, ${tables.length} top-level tables)`);
	console.log(`  content: ${contentCols} cols (expect ${expectedContentCols}), R1 cells ${contentR1}`);
	console.log(`  cap: ${capCols} cols (expect ${1 + expectedUnits}), units [${capUnits}]`);
	console.log(`  ccp: ${ccpCols} cols (expect ${1 + expectedUnits})`);

	const ok =
		contentCols === expectedContentCols &&
		contentR1 === expectedContentCols &&
		capCols === 1 + expectedUnits &&
		ccpCols === 1 + expectedUnits &&
		capUnits === Array.from({ length: expectedUnits }, (_, i) => String(i + 1)).join(',');
	console.log(ok ? '  OK' : '  FAIL');
}

analyze('data/exports/design-and-technologies-band-9-10-2026-2units.docx', 2);
analyze('data/exports/design-and-technologies-band-9-10-2026-6units.docx', 6);

// Balanced tags
for (const f of [
	'data/exports/design-and-technologies-band-9-10-2026-2units.docx',
	'data/exports/design-and-technologies-band-9-10-2026-6units.docx'
]) {
	const doc = new AdmZip(f).getEntry('word/document.xml').getData().toString('utf8');
	const open = (doc.match(/<w:tbl>/g) || []).length;
	const close = (doc.match(/<\/w:tbl>/g) || []).length;
	console.log(`${f}: tbl open=${open} close=${close}`);
}
