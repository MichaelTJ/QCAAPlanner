import fs from 'node:fs/promises';
import path from 'node:path';
import { buildLevelPlanDocx } from '../src/lib/export/level-plan-docx.ts';

const ROOT = process.cwd();
const plan = JSON.parse(
	await fs.readFile(
		path.join(ROOT, 'data/level-plans/design-and-technologies-band-9-10-2026.json'),
		'utf-8'
	)
);
const buf = await buildLevelPlanDocx(plan);
const out = path.join(ROOT, 'FacultyDocs/Templates/design-and-technologies-band-9-10-2026.docx');
await fs.writeFile(out, buf);
console.log('Wrote', out, buf.length, 'bytes');
