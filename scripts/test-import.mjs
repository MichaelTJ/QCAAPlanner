import fs from 'node:fs/promises';
import path from 'node:path';
import { buildLevelPlanDocx } from '../src/lib/export/level-plan-docx.ts';
import { buildUnitPlanDocx } from '../src/lib/export/unit-plan-docx.ts';
import {
	mergeParsedLevelPlan,
	parseLevelPlanDocx
} from '../src/lib/import/level-plan-docx.ts';
import {
	mergeParsedUnitPlan,
	parseUnitPlanDocx
} from '../src/lib/import/unit-plan-docx.ts';

const ROOT = process.cwd();

function assert(condition, message) {
	if (!condition) throw new Error(message);
}

function assertIncludes(haystack, needle, label) {
	assert(
		String(haystack).includes(needle),
		`${label}: expected text to include ${JSON.stringify(needle)}, got ${JSON.stringify(String(haystack).slice(0, 120))}`
	);
}

async function testUnitPlanRoundTrip() {
	const levelPlanId = 'digital-technologies-band-9-10-2026';
	const unitId = 'unit-9-2-cyber-security-site';
	const jsonPath = path.join(ROOT, 'data/unit-plans', levelPlanId, `${unitId}.json`);
	const original = JSON.parse(await fs.readFile(jsonPath, 'utf8'));

	const docx = await buildUnitPlanDocx(original);
	const parsed = parseUnitPlanDocx(docx);

	assertIncludes(parsed.unitTitle, original.unitTitle.value, 'unit title');
	assertIncludes(parsed.unitDescription, original.unitDescription.value.slice(0, 40), 'unit description');
	assert(parsed.assessments.length >= 1, 'expected assessments');
	assertIncludes(parsed.assessments[0].title, original.assessments[0].title.value, 'assessment title');
	assert(parsed.teachingSequence.length >= 1, 'expected teaching sequence rows');

	const merged = mergeParsedUnitPlan(original, parsed);
	assert(merged.unitTitle.value === parsed.unitTitle, 'merge unit title');
	assert(merged.evaluation.value === parsed.evaluation, 'merge evaluation');

	parsed.unitDescription = 'IMPORT TEST — updated unit description';
	const updated = mergeParsedUnitPlan(original, parsed);
	assert(
		updated.unitDescription.value === 'IMPORT TEST — updated unit description',
		'merge applies edited description'
	);

	console.log('✓ unit plan round-trip');
}

async function testLevelPlanRoundTrip() {
	const planId = 'digital-technologies-band-9-10-2026';
	const jsonPath = path.join(ROOT, 'data/level-plans', `${planId}.json`);
	const original = JSON.parse(await fs.readFile(jsonPath, 'utf8'));

	const docx = await buildLevelPlanDocx(original);
	const parsed = parseLevelPlanDocx(docx);

	assertIncludes(parsed.levelDescription, original.levelDescription.value.slice(0, 40), 'level description');
	assert(parsed.units.length === original.units.length, 'unit count');
	assertIncludes(parsed.units[0].unitTitle, original.units[0].unitTitle.value, 'unit 1 title');
	assert(parsed.units[0].assessments.length >= 1, 'unit 1 assessments');
	assert(parsed.contentDescriptions.length >= 1, 'content descriptions');
	assert(parsed.generalCapabilities.length >= 1, 'general capabilities');

	const merged = mergeParsedLevelPlan(original, parsed);
	assert(merged.units[0].unitTitle.value === parsed.units[0].unitTitle, 'merge unit title');

	parsed.levelDescription = 'IMPORT TEST — updated level description';
	const updated = mergeParsedLevelPlan(original, parsed);
	assert(
		updated.levelDescription.value === 'IMPORT TEST — updated level description',
		'merge applies edited level description'
	);

	console.log('✓ level plan round-trip');
}

async function testExportedFileOnDisk() {
	const exportPath = path.join(
		ROOT,
		'data/exports/digital-technologies-band-9-10-2026__unit-9-2-cyber-security-site.docx'
	);
	const buf = await fs.readFile(exportPath);
	const parsed = parseUnitPlanDocx(buf);
	assertIncludes(parsed.unitTitle, 'Cyber Security Site', 'on-disk export unit title');
	console.log('✓ on-disk exported unit plan');
}

async function main() {
	await testUnitPlanRoundTrip();
	await testLevelPlanRoundTrip();
	await testExportedFileOnDisk();
	console.log('\nAll import tests passed.');
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
