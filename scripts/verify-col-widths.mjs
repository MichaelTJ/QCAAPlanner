import fs from 'node:fs';
import AdmZip from 'adm-zip';
import { buildLevelPlanDocx } from '../src/lib/export/level-plan-docx.ts';
import {
	extractTopLevelTables,
	unwrapTable,
	extractTopLevelRows,
	extractTopLevelCells,
	CM_TO_DXA,
	GEN_CAP_UNIT_COLUMN_WIDTH_CM,
	WRAPPER_COLUMN_WIDTHS_CM
} from '../src/lib/export/docx-xml.ts';

const plan = JSON.parse(
	fs.readFileSync('data/level-plans/design-and-technologies-band-9-10-2026.json', 'utf8')
);
const buf = await buildLevelPlanDocx(plan);
const out = 'data/exports/design-and-technologies-band-9-10-2026.docx';
fs.writeFileSync(out, buf);

const doc = new AdmZip(buf).getEntry('word/document.xml').getData().toString('utf8');

function ownGrid(inner) {
	const head = inner.slice(0, inner.indexOf('<w:tr'));
	const grid = head.match(/<w:tblGrid>[\s\S]*?<\/w:tblGrid>/)?.[0] ?? '';
	return [...grid.matchAll(/w:w="(\d+)"/g)].map((m) => m[1]);
}

const wrapper = unwrapTable(extractTopLevelTables(doc)[5]);
console.log('Wrapper grid (dxa):', ownGrid(wrapper));
console.log('Expected:', WRAPPER_COLUMN_WIDTHS_CM.map((cm) => Math.round(cm * CM_TO_DXA)));

const rows = extractTopLevelRows(wrapper);
rows.forEach((r, i) => {
	const cells = extractTopLevelCells(r);
	console.log(`WR${i} tcW:`, cells.map((c) => c.match(/tcW w:w="(\d+)"/)?.[1]));
	cells.forEach((c, ci) => {
		const emptyLead = /^<w:tc[^>]*>(?:<w:tcPr>[\s\S]*?<\/w:tcPr>)?\s*<w:p[^>]*>(?:<w:pPr>[\s\S]*?<\/w:pPr>)?\s*<\/w:p>/.test(
			c
		);
		console.log(`  C${ci} emptyLead=${emptyLead}`);
	});
});

const w = wrapper;
const capStart = w.indexOf('<w:tbl>');
const capEnd = w.indexOf('</w:tbl>', capStart) + 8;
const cap = w.slice(capStart + 7, capEnd - 8);
console.log('Cap grid (dxa):', ownGrid(cap));
console.log('Expected unit col:', Math.round(GEN_CAP_UNIT_COLUMN_WIDTH_CM * CM_TO_DXA));
console.log('Wrote', out);
