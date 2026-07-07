import fs from 'node:fs';
import path from 'node:path';
import { buildLevelPlanDocx } from '../src/lib/export/level-plan-docx.ts';

const ROOT = process.cwd();
const basePath = path.join(ROOT, 'data/level-plans/design-and-technologies-band-9-10-2026.json');
const base = JSON.parse(fs.readFileSync(basePath, 'utf8'));

function trimUnitInclusions(rows, count) {
	return rows.map((row) => ({
		...row,
		unitInclusions: row.unitInclusions.slice(0, count)
	}));
}

function makePlan(unitCount) {
	const plan = structuredClone(base);
	let units = base.units.slice(0, unitCount);

	if (units.length < unitCount) {
		const last = structuredClone(base.units[base.units.length - 1]);
		last.id = `unit-test-${unitCount}`;
		last.unitTitle = { ...last.unitTitle, value: `Unit ${unitCount} — Extension` };
		units = [...units, last];
	}

	plan.units = units;
	plan.contentDescriptions = trimUnitInclusions(plan.contentDescriptions, unitCount);
	plan.generalCapabilities = trimUnitInclusions(plan.generalCapabilities, unitCount);
	plan.crossCurriculumPriorities = trimUnitInclusions(plan.crossCurriculumPriorities, unitCount);
	return plan;
}

const outDir = path.join(ROOT, 'data/exports');
fs.mkdirSync(outDir, { recursive: true });

for (const unitCount of [2, 6]) {
	const plan = makePlan(unitCount);
	const buf = await buildLevelPlanDocx(plan);
	const out = path.join(outDir, `design-and-technologies-band-9-10-2026-${unitCount}units.docx`);
	fs.writeFileSync(out, buf);
	console.log(`Wrote ${out} (${buf.length} bytes, ${plan.units.length} units)`);
}
