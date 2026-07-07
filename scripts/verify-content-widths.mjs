import fs from 'node:fs';
import AdmZip from 'adm-zip';
import { buildLevelPlanDocx } from '../src/lib/export/level-plan-docx.ts';
import { extractTopLevelTables, unwrapTable } from '../src/lib/export/docx-xml.ts';

const base = JSON.parse(
	fs.readFileSync('data/level-plans/design-and-technologies-band-9-10-2026.json', 'utf8')
);

for (const n of [6, 8]) {
	const plan = structuredClone(base);
	while (plan.units.length < n) {
		const last = structuredClone(base.units[base.units.length - 1]);
		last.id = `x${plan.units.length}`;
		last.unitTitle = { ...last.unitTitle, value: `Unit ${plan.units.length + 1}` };
		plan.units.push(last);
	}
	const trim = (rows) => rows.map((r) => ({ ...r, unitInclusions: r.unitInclusions.slice(0, n) }));
	plan.contentDescriptions = trim(plan.contentDescriptions);
	plan.generalCapabilities = trim(plan.generalCapabilities);
	plan.crossCurriculumPriorities = trim(plan.crossCurriculumPriorities);

	const buf = await buildLevelPlanDocx(plan);
	const out = `data/exports/test-${n}units-content.docx`;
	fs.writeFileSync(out, buf);
	const inner = unwrapTable(extractTopLevelTables(new AdmZip(buf).getEntry('word/document.xml').getData().toString('utf8'))[n === 6 ? 5 : 5]);
	const tables = extractTopLevelTables(new AdmZip(buf).getEntry('word/document.xml').getData().toString('utf8'));
	const contentInner = unwrapTable(tables[tables.length - 2]);
	const grid = [...contentInner.matchAll(/<w:gridCol w:w="(\d+)"/g)].map((m) => +m[1]);
	const rightTextIdx = 1 + n;
	console.log(
		`${n}u: cols=${grid.length} sum=${grid.reduce((a, b) => a + b, 0)} text=[${grid[0]}, ${grid[rightTextIdx]}] tick=${grid[1]}`
	);
}
