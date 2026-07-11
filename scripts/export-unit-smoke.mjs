/**
 * Smoke-test template-based unit plan export.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { buildUnitPlanDocx } from '../src/lib/export/unit-plan-docx.ts';
import {
	extractTopLevelTables,
	unwrapTable,
	extractRows,
	cellText
} from '../src/lib/export/docx-xml.ts';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'data/exports');

function rowLabels(tableXml) {
	return extractRows(unwrapTable(tableXml)).map((row) =>
		[...row.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
			.map((m) => m[1])
			.join(' ')
			.replace(/\s+/g, ' ')
			.trim()
			.slice(0, 80)
	);
}

async function loadUnit(levelPlanId, unitId) {
	const file = path.join(ROOT, 'data/unit-plans', levelPlanId, `${unitId}.json`);
	return JSON.parse(await fs.readFile(file, 'utf8'));
}

async function exportOne(label, levelPlanId, unitId) {
	const plan = await loadUnit(levelPlanId, unitId);
	const buffer = await buildUnitPlanDocx(plan);
	await fs.mkdir(OUT_DIR, { recursive: true });
	const outPath = path.join(OUT_DIR, `${unitId}-template.docx`);
	await fs.writeFile(outPath, buffer);

	const zip = new AdmZip(buffer);
	const xml = zip.getEntry('word/document.xml').getData().toString('utf8');
	const tables = extractTopLevelTables(xml);
	const teachingHeaders = (xml.match(/Teaching and learning sequence/g) || []).length;
	const assessmentBanners = (xml.match(/Assessment \d+/g) || []).length;

	console.log(`\n=== ${label} ===`);
	console.log('Wrote', outPath, `(${buffer.length} bytes)`);
	console.log('Top-level tables:', tables.length);
	tables.forEach((t, i) => {
		const labels = rowLabels(t);
		console.log(`  T${i}: ${labels.length} rows — ${labels[0]}`);
	});
	console.log('Teaching header occurrences:', teachingHeaders, '(expect 1)');
	console.log('Assessment banners:', assessmentBanners);
	console.log('Assessments in plan:', plan.assessments?.length ?? 0);
	console.log('Weeks in plan:', plan.teachingSequence?.length ?? 0);

	if (teachingHeaders !== 1) {
		throw new Error(`${label}: expected 1 teaching header, got ${teachingHeaders}`);
	}
	const expectedMinTables = 5 + Math.max(1, plan.assessments?.length ?? 0);
	// overview + adjustments + N assessments + caps + teaching + eval = 5 + N
	const expected = 5 + Math.max(1, plan.assessments?.length ?? 0);
	if (tables.length !== expected) {
		throw new Error(`${label}: expected ${expected} tables, got ${tables.length}`);
	}
	return outPath;
}

await exportOne(
	'Year 7 Digital Literacy',
	'digital-technologies-band-7-8-2026',
	'unit-7-1-digital-literacy'
);

// Multi-assessment unit if present
const y9Dir = path.join(ROOT, 'data/unit-plans/digital-technologies-band-9-10-2026');
const y9Files = await fs.readdir(y9Dir);
let multi = null;
for (const f of y9Files.filter((x) => x.endsWith('.json'))) {
	const plan = JSON.parse(await fs.readFile(path.join(y9Dir, f), 'utf8'));
	if ((plan.assessments?.length ?? 0) >= 2) {
		multi = plan;
		break;
	}
}
if (multi) {
	await exportOne(
		`Multi-assessment ${multi.id}`,
		multi.levelPlanId,
		multi.id
	);
} else {
	console.log('\nNo multi-assessment Y9 unit found; skipping');
}

console.log('\nSmoke export OK');
