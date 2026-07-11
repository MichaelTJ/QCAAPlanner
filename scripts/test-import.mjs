import fs from 'node:fs/promises';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { buildLearningGuideDocx } from '../src/lib/export/learning-guide-docx.ts';
import { buildLevelPlanDocx } from '../src/lib/export/level-plan-docx.ts';
import { buildUnitPlanDocx } from '../src/lib/export/unit-plan-docx.ts';
import { extractTopLevelTables } from '../src/lib/export/docx-xml.ts';
import {
	formatCheckedSubElements,
	getCapabilityDefinition,
	ensureUnitCapabilityChecks
} from '../src/lib/general-capabilities.ts';
import { learningGuideFromUnitPlan } from '../src/lib/learning-guide-data.ts';
import {
	applyLearningGuideToUnitPlan,
	mergeLearningGuideImport,
	parseLearningGuideDocx
} from '../src/lib/import/learning-guide-docx.ts';
import {
	mergeParsedLevelPlan,
	parseLevelPlanDocx
} from '../src/lib/import/level-plan-docx.ts';
import { cloneLevelPlanWithNewIds, cloneUnitPlanWithNewIds } from '../src/lib/import/plan-clone.ts';
import {
	getFacultyIndex,
	getLevelPlan,
	getUnitPlan,
	importLevelPlanAsNew,
	importUnitPlanAsNew,
	saveFacultyIndex
} from '../src/lib/server/data.ts';

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

function documentXmlFromDocx(buffer) {
	const zip = new AdmZip(buffer);
	const entry = zip.getEntry('word/document.xml');
	assert(entry, 'docx missing word/document.xml');
	return entry.getData().toString('utf8');
}

async function listJsonFiles(dir) {
	try {
		const entries = await fs.readdir(dir, { withFileTypes: true });
		return entries.filter((entry) => entry.isFile() && entry.name.endsWith('.json')).map((entry) => entry.name);
	} catch {
		return [];
	}
}

async function testUnitPlanTemplateExport() {
	const levelPlanId = 'digital-technologies-band-7-8-2026';
	const unitId = 'unit-7-1-digital-literacy';
	const jsonPath = path.join(ROOT, 'data/unit-plans', levelPlanId, `${unitId}.json`);
	const original = JSON.parse(await fs.readFile(jsonPath, 'utf8'));

	const docx = await buildUnitPlanDocx(original);
	const xml = documentXmlFromDocx(docx);
	const tables = extractTopLevelTables(xml);
	const expectedTables = 5 + Math.max(1, original.assessments.length);

	assert(tables.length === expectedTables, `expected ${expectedTables} tables, got ${tables.length}`);
	assertIncludes(xml, original.unitTitle.value, 'unit title in template export');
	assertIncludes(xml, original.unitDescription.value.slice(0, 40), 'unit description in template export');
	assertIncludes(xml, 'Teaching and learning sequence', 'teaching sequence section');
	assert(
		(xml.match(/Teaching and learning sequence/g) || []).length === 1,
		'no PDF continuation teaching headers'
	);
	assert(original.teachingSequence.length >= 1, 'fixture has teaching weeks');
	assertIncludes(xml, 'Key teaching and learning experiences', 'week planning label');

	console.log('✓ unit plan template export');
}

async function testUnitPlanCapabilityExport() {
	const levelPlanId = 'digital-technologies-band-9-10-2026';
	const unitId = 'unit-9-2-cyber-security-site';
	const original = JSON.parse(
		await fs.readFile(path.join(ROOT, 'data/unit-plans', levelPlanId, `${unitId}.json`), 'utf8')
	);
	const forExport = structuredClone(original);
	const cap = forExport.generalCapabilities[0];
	cap.subElementChecks = ensureUnitCapabilityChecks(cap);
	const def = getCapabilityDefinition(cap.name.value);
	const firstSubId = def?.categories[0]?.subElements[0]?.id;
	assert(firstSubId, 'expected capability definition with sub-elements');

	cap.subElementChecks[firstSubId] = true;
	cap.subElements.value = formatCheckedSubElements(cap.name.value, cap.subElementChecks);

	const docx = await buildUnitPlanDocx(forExport);
	const xml = documentXmlFromDocx(docx);
	assertIncludes(xml, cap.name.value, 'capability name in template export');
	assertIncludes(xml, def.categories[0].subElements[0].label, 'capability sub-element in template export');

	console.log('✓ unit plan capability export');
}

async function testLevelPlanRoundTrip() {
	const planId = 'digital-technologies-band-9-10-2026';
	const jsonPath = path.join(ROOT, 'data/level-plans', `${planId}.json`);
	const original = JSON.parse(await fs.readFile(jsonPath, 'utf8'));

	const docx = await buildLevelPlanDocx(original);
	const parsed = parseLevelPlanDocx(docx);

	assertIncludes(parsed.levelDescription, original.levelDescription.value.slice(0, 40), 'level description');
	assertIncludes(parsed.bandSubjectTitle, original.bandSubjectTitle.value.slice(0, 10), 'band title');
	assert(parsed.year === original.year.value, 'year header');
	assert(parsed.status === original.status.value, 'status header');
	assertIncludes(parsed.school, original.school.value.slice(0, 10), 'school header');
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
	const exportPath = path.join(ROOT, 'data/exports/unit-7-1-digital-literacy-template.docx');
	const buf = await fs.readFile(exportPath);
	const xml = documentXmlFromDocx(buf);
	assertIncludes(xml, 'Digital Literacy', 'on-disk template export unit title');
	assertIncludes(xml, 'Teaching and learning sequence', 'on-disk teaching section');
	console.log('✓ on-disk exported unit plan');
}

async function testLearningGuideRoundTrip() {
	const levelPlanId = 'digital-technologies-band-9-10-2026';
	const unitId = 'unit-9-2-cyber-security-site';
	const original = JSON.parse(
		await fs.readFile(path.join(ROOT, 'data/unit-plans', levelPlanId, `${unitId}.json`), 'utf8')
	);
	const data = learningGuideFromUnitPlan(original);
	data.vocabulary = 'Cybersecurity: Phishing, MFA\nTeams: Channel, Permissions';
	if (data.weeks.length) {
		data.weeks[0].title = 'Imported week theme';
		data.weeks[0].bullets = ['Objective alpha', 'Objective beta'];
	}

	const docx = await buildLearningGuideDocx(data);
	const parsed = parseLearningGuideDocx(docx);
	assertIncludes(parsed.vocabulary, 'Phishing', 'vocabulary');
	assert(parsed.weeks.length >= 1, 'learning guide weeks');
	assertIncludes(parsed.weeks[0].title, 'Imported week theme', 'week title');

	const applied = applyLearningGuideToUnitPlan(original, parsed);
	const weekNum = parsed.weeks[0].week;
	const weekRow = applied.teachingSequence.find((week) => Number(week.week.value) === Number(weekNum));
	assertIncludes(weekRow?.outlineTheme?.value, 'Imported week theme', 'applied week theme');
	console.log('✓ learning guide round-trip');
}

async function testPlanCloneIds() {
	const levelPlanId = 'digital-technologies-band-9-10-2026';
	const unitId = 'unit-9-2-cyber-security-site';
	const level = JSON.parse(
		await fs.readFile(path.join(ROOT, 'data/level-plans', `${levelPlanId}.json`), 'utf8')
	);
	const unit = JSON.parse(
		await fs.readFile(path.join(ROOT, 'data/unit-plans', levelPlanId, `${unitId}.json`), 'utf8')
	);

	const clonedLevel = cloneLevelPlanWithNewIds(level, 'test-level-import');
	const clonedUnit = cloneUnitPlanWithNewIds(unit, 'test-unit-import');
	assert(clonedLevel.id === 'test-level-import', 'cloned level id');
	assert(clonedLevel.units.every((u) => u.id !== level.units[0].id), 'cloned unit ids');
	assert(clonedUnit.id === 'test-unit-import', 'cloned unit id');
	assert(clonedUnit.assessments.every((a, i) => a.id !== unit.assessments[i]?.id), 'cloned assessment ids');
	console.log('✓ plan clone ids');
}

async function testAllLevelPlansExportImport() {
	const dir = path.join(ROOT, 'data/level-plans');
	for (const file of await listJsonFiles(dir)) {
		const plan = JSON.parse(await fs.readFile(path.join(dir, file), 'utf8'));
		const docx = await buildLevelPlanDocx(plan);
		const parsed = parseLevelPlanDocx(docx);
		assert(parsed.units.length === plan.units.length, `${file}: unit count`);
		assertIncludes(
			parsed.bandSubjectTitle,
			String(plan.bandSubjectTitle.value).slice(0, 8),
			`${file}: band title`
		);
	}
	console.log('✓ all level plans export/import');
}

async function testAllUnitPlansTemplateExport() {
	const baseDir = path.join(ROOT, 'data/unit-plans');
	const levelDirs = await fs.readdir(baseDir, { withFileTypes: true });
	for (const levelDir of levelDirs) {
		if (!levelDir.isDirectory()) continue;
		const unitDir = path.join(baseDir, levelDir.name);
		for (const file of await listJsonFiles(unitDir)) {
			const plan = JSON.parse(await fs.readFile(path.join(unitDir, file), 'utf8'));
			const docx = await buildUnitPlanDocx(plan);
			const xml = documentXmlFromDocx(docx);
			assertIncludes(xml, String(plan.unitTitle.value).slice(0, 8), `${file}: title`);
			assert(
				(xml.match(/Teaching and learning sequence/g) || []).length === 1,
				`${file}: single teaching header`
			);
		}
	}
	console.log('✓ all unit plans template export');
}

async function testImportLevelPlanAsNewIntegration() {
	const sourceId = 'digital-technologies-band-9-10-2026';
	const sourceBefore = JSON.stringify(await getLevelPlan(sourceId));
	const source = await getLevelPlan(sourceId);
	assert(source, 'source level plan exists');

	const docx = await buildLevelPlanDocx(source);
	const parsed = parseLevelPlanDocx(docx);
	parsed.levelDescription = 'INTEGRATION TEST — import as new level plan';
	const merged = mergeParsedLevelPlan(structuredClone(source), parsed);
	const created = await importLevelPlanAsNew(sourceId, merged);

	try {
		assert(created.id !== sourceId, 'new level plan id');
		assertIncludes(created.bandSubjectTitle.value, '(import)', 'import label on title');
		assertIncludes(created.levelDescription.value, 'INTEGRATION TEST', 'merged description saved');
		const sourceAfter = JSON.stringify(await getLevelPlan(sourceId));
		assert(sourceBefore === sourceAfter, 'source level plan unchanged');
		const index = await getFacultyIndex();
		assert(index.rows.some((row) => row.id === created.id), 'faculty index row added');
	} finally {
		const index = await getFacultyIndex();
		index.rows = index.rows.filter((row) => row.id !== created.id);
		await saveFacultyIndex(index);
		await fs.unlink(path.join(ROOT, 'data/level-plans', `${created.id}.json`));
	}

	console.log('✓ import level plan as new (integration)');
}

async function testImportUnitPlanAsNewIntegration() {
	const levelPlanId = 'digital-technologies-band-9-10-2026';
	const unitId = 'unit-9-2-cyber-security-site';
	const sourceBefore = JSON.stringify(await getUnitPlan(levelPlanId, unitId));
	const source = await getUnitPlan(levelPlanId, unitId);
	assert(source, 'source unit plan exists');

	// Template export is not yet round-tripped by parseUnitPlanDocx; exercise import-as-new from JSON.
	const merged = structuredClone(source);
	merged.unitDescription.value = 'INTEGRATION TEST — import as new unit plan';
	const created = await importUnitPlanAsNew(levelPlanId, unitId, merged);

	try {
		assert(created.id !== unitId, 'new unit plan id');
		assertIncludes(created.unitTitle.value, '(import)', 'import label on title');
		assertIncludes(created.unitDescription.value, 'INTEGRATION TEST', 'merged description saved');
		assert(created.unitNumber.value !== source.unitNumber.value, 'new unit number assigned');
		const sourceAfter = JSON.stringify(await getUnitPlan(levelPlanId, unitId));
		assert(sourceBefore === sourceAfter, 'source unit plan unchanged');
	} finally {
		await fs.unlink(path.join(ROOT, 'data/unit-plans', levelPlanId, `${created.id}.json`));
	}

	console.log('✓ import unit plan as new (integration)');
}

async function testImportLearningGuideAsNewIntegration() {
	const levelPlanId = 'digital-technologies-band-9-10-2026';
	const unitId = 'unit-9-2-cyber-security-site';
	const sourceBefore = JSON.stringify(await getUnitPlan(levelPlanId, unitId));
	const source = await getUnitPlan(levelPlanId, unitId);
	assert(source, 'source unit plan exists');

	const data = learningGuideFromUnitPlan(source);
	data.vocabulary = 'Integration: Alpha, Beta';
	if (data.weeks.length) {
		data.weeks[0].title = 'Integration learning guide theme';
		data.weeks[0].bullets = ['Point A', 'Point B'];
	}

	const docx = await buildLearningGuideDocx(data);
	const parsed = parseLearningGuideDocx(docx);
	const merged = mergeLearningGuideImport(structuredClone(source), parsed);
	const created = await importUnitPlanAsNew(levelPlanId, unitId, merged);

	try {
		assert(created.id !== unitId, 'new unit plan id from learning guide');
		const weekNum = parsed.weeks[0]?.week;
		const weekRow = created.teachingSequence.find(
			(week) => Number(week.week.value) === Number(weekNum)
		);
		assertIncludes(
			weekRow?.outlineTheme?.value,
			'Integration learning guide theme',
			'learning guide theme applied'
		);
		const sourceAfter = JSON.stringify(await getUnitPlan(levelPlanId, unitId));
		assert(sourceBefore === sourceAfter, 'source unit plan unchanged');
	} finally {
		await fs.unlink(path.join(ROOT, 'data/unit-plans', levelPlanId, `${created.id}.json`));
	}

	console.log('✓ import learning guide as new (integration)');
}

async function main() {
	await testUnitPlanTemplateExport();
	await testUnitPlanCapabilityExport();
	await testLevelPlanRoundTrip();
	await testExportedFileOnDisk();
	await testLearningGuideRoundTrip();
	await testPlanCloneIds();
	await testAllLevelPlansExportImport();
	await testAllUnitPlansTemplateExport();
	await testImportLevelPlanAsNewIntegration();
	await testImportUnitPlanAsNewIntegration();
	await testImportLearningGuideAsNewIntegration();
	console.log('\nAll import tests passed.');
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
