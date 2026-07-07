import fs from 'node:fs';
import AdmZip from 'adm-zip';
import { buildLevelPlanDocx } from '../src/lib/export/level-plan-docx.ts';
import {
	extractTopLevelTables,
	unwrapTable,
	extractRows,
	extractCells,
	resizeContentDescriptionsColumns,
	resizeCapabilityTableColumns
} from '../src/lib/export/docx-xml.ts';

const base = JSON.parse(
	fs.readFileSync('data/level-plans/design-and-technologies-band-9-10-2026.json', 'utf8')
);

function trim(plan, n) {
	const p = structuredClone(base);
	p.units = base.units.slice(0, n);
	if (p.units.length < n) {
		const last = structuredClone(base.units[base.units.length - 1]);
		last.id = 'unit-extra';
		last.unitTitle.value = `Unit ${n}`;
		p.units.push(last);
	}
	for (const key of ['contentDescriptions', 'generalCapabilities', 'crossCurriculumPriorities']) {
		p[key] = p[key].map((r) => ({ ...r, unitInclusions: r.unitInclusions.slice(0, n) }));
	}
	return p;
}

// Test resize in isolation
const template = new AdmZip(
	'FacultyDocs/Templates/Example_level_plan_Design_and_Technologies_Band_9-10_2026.docx'
)
	.getEntry('word/document.xml')
	.getData()
	.toString('utf8');
const tables = extractTopLevelTables(template);
const contentInner = unwrapTable(tables[4]);
const wrapper = unwrapTable(tables[5]);
const capInner = wrapper.slice(wrapper.indexOf('<w:tbl>') + 7, wrapper.indexOf('</w:tbl>'));

for (const n of [2, 5, 6]) {
	const c = resizeContentDescriptionsColumns(contentInner, n);
	const cap = resizeCapabilityTableColumns(capInner, n);
	const cRows = extractRows(c);
	const capRows = extractRows(cap);
	const cCols = (c.match(/<w:gridCol/g) || []).length;
	const capCols = (cap.match(/<w:gridCol/g) || []).length;
	console.log(`\nunitCount=${n}`);
	console.log(`  content: grid=${cCols} R1 cells=${extractCells(cRows[1]).length} R2=${extractCells(cRows[2]).length}`);
	console.log(`  cap: grid=${capCols} R1=${extractCells(capRows[1]).length} R2=${extractCells(capRows[2]).length}`);
}

// Full export and check if Word can read - save isolated document.xml for 2 unit
const plan2 = trim(base, 2);
const buf = await buildLevelPlanDocx(plan2);
const xml = new AdmZip(buf).getEntry('word/document.xml').getData().toString('utf8');
fs.writeFileSync('data/exports/debug-2unit-document.xml', xml);

// Check for broken rows: tc count vs expected
const content = unwrapTable(extractTopLevelTables(xml)[3]);
extractRows(content).forEach((row, ri) => {
	const n = extractCells(row).length;
	const span = extractCells(row).reduce(
		(s, c) => s + +(c.match(/gridSpan w:val="(\d+)"/)?.[1] ?? 1),
		0
	);
	const cols = (content.match(/<w:gridCol/g) || []).length;
	if (span !== cols) console.log('BAD content row', ri, span, cols);
});

console.log('\nWrote debug-2unit-document.xml');
