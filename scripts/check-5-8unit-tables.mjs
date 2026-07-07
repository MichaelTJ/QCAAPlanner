import fs from 'node:fs';
import AdmZip from 'adm-zip';
import { buildLevelPlanDocx } from '../src/lib/export/level-plan-docx.ts';
import { extractTopLevelTables, unwrapTable } from '../src/lib/export/docx-xml.ts';

const base = JSON.parse(
	fs.readFileSync('data/level-plans/design-and-technologies-band-9-10-2026.json', 'utf8')
);

function makePlan(n) {
	const plan = structuredClone(base);
	let units = base.units.slice(0, n);
	while (units.length < n) {
		const last = structuredClone(base.units[base.units.length - 1]);
		last.id = `u${units.length}`;
		last.unitTitle = { ...last.unitTitle, value: `Unit ${units.length + 1} — Extra` };
		units.push(last);
	}
	plan.units = units;
	const trim = (rows) =>
		rows.map((r) => ({ ...r, unitInclusions: r.unitInclusions.slice(0, n) }));
	plan.contentDescriptions = trim(plan.contentDescriptions);
	plan.generalCapabilities = trim(plan.generalCapabilities);
	plan.crossCurriculumPriorities = trim(plan.crossCurriculumPriorities);
	return plan;
}

for (const n of [5, 8]) {
	const buf = await buildLevelPlanDocx(makePlan(n));
	const xml = new AdmZip(buf).getEntry('word/document.xml').getData().toString('utf8');
	const tables = extractTopLevelTables(xml);
	const cols = tables.slice(1, 5).map((t, i) => {
		const inner = unwrapTable(t);
		return `T${i + 1}:${[...inner.matchAll(/<w:gridCol/g)].length}c`;
	});
	console.log(`${n} units -> ${tables.length} tables | ${cols.join(' ')}`);
}
