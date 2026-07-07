import fs from 'node:fs/promises';
import path from 'node:path';
import { buildLevelPlanDocx } from '../src/lib/export/level-plan-docx.ts';
import { buildUnitPlanDocx } from '../src/lib/export/unit-plan-docx.ts';
import { LEVEL_PLANS } from './manifest.mjs';

const ROOT = process.cwd();
const DATA = path.join(ROOT, 'data');
const OUT = path.join(ROOT, 'data', 'exports');

async function main() {
	await fs.mkdir(OUT, { recursive: true });

	for (const lp of LEVEL_PLANS) {
		const planPath = path.join(DATA, 'level-plans', `${lp.id}.json`);
		const plan = JSON.parse(await fs.readFile(planPath, 'utf-8'));
		const buffer = await buildLevelPlanDocx(plan);
		const outFile = path.join(OUT, `${lp.id}.docx`);
		await fs.writeFile(outFile, buffer);
		console.log(`Exported level plan: ${outFile}`);

		for (const unit of lp.units) {
			const unitPath = path.join(DATA, 'unit-plans', lp.id, `${unit.unitId}.json`);
			try {
				const unitPlan = JSON.parse(await fs.readFile(unitPath, 'utf-8'));
				const unitBuffer = await buildUnitPlanDocx(unitPlan);
				const unitOut = path.join(OUT, `${lp.id}__${unit.unitId}.docx`);
				await fs.writeFile(unitOut, unitBuffer);
				console.log(`Exported unit plan: ${unitOut}`);
			} catch {
				console.warn(`Skipped unit (not found): ${unit.unitId}`);
			}
		}
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
