import AdmZip from 'adm-zip';
import { learningGuideFromUnitPlan } from '$lib/learning-guide-data';
import { syncUnitPlansIntoLevelPlan } from '$lib/plan-sync';
import {
	getFacultyIndex,
	getLevelPlan,
	getUnitPlan,
	listAssessmentItems,
	listUnitPlans
} from '$lib/server/data';
import { buildLearningGuideDocxForUnit } from '$lib/server/learning-guide-export';
import type { AssessmentItem, LevelPlan, UnitPlan } from '$lib/types';
import { buildAssessmentItemDocx } from './assessment-item-docx';
import {
	assessmentItemExportFilename,
	levelPlanExportFilename,
	lessonPlansStudentExportFilename,
	lessonPlansTeacherExportFilename,
	unitPlanExportFilename,
	unitPlanExportFolderName
} from './export-filenames';
import { buildLessonPlansStudentDocx, buildLessonPlansTeacherDocx, weeksWithLessons } from './lesson-plans-docx';
import { buildLevelPlanDocx } from './level-plan-docx';
import { buildUnitPlanDocx } from './unit-plan-docx';

export type LevelPlanBundleOptions = {
	/** Include summary + detailed learning guides (AI). Default false. */
	learningGuides?: boolean;
};

function uniqueName(base: string, used: Set<string>): string {
	if (!used.has(base)) {
		used.add(base);
		return base;
	}
	const stem = base.replace(/\.docx$/i, '');
	const ext = base.endsWith('.docx') ? '.docx' : '';
	let n = 2;
	while (used.has(`${stem}-${n}${ext}`)) n += 1;
	const unique = `${stem}-${n}${ext}`;
	used.add(unique);
	return unique;
}

function uniqueUnitFolderName(plan: UnitPlan, used: Set<string>): string {
	return uniqueName(unitPlanExportFolderName(plan), used);
}

/**
 * Zip layout (folder root = level plan id):
 *   {level_plan_…}.docx
 *   units/{unit-grade-n-title}/{unit_plan_…}.docx
 *   units/{unit-grade-n-title}/{assessment_…}.docx
 *   units/{unit-grade-n-title}/{folder}-learning-guide.docx
 *   units/{unit-grade-n-title}/{folder}-learning-guide-detailed.docx
 *   {assessment_…}.docx   ← only orphans not linked to a unit in this level
 */
async function addLearningGuides(zip: AdmZip, unitFolder: string, unit: UnitPlan) {
	const guide = learningGuideFromUnitPlan(unit);
	if (guide.weeks.length === 0) return;

	const folderName = unitFolder.split('/').pop() || unit.id;
	for (const detail of ['summary', 'detailed'] as const) {
		try {
			const { buffer } = await buildLearningGuideDocxForUnit(unit, { detail });
			const suffix = detail === 'detailed' ? '-learning-guide-detailed' : '-learning-guide';
			zip.addFile(`${unitFolder}/${folderName}${suffix}.docx`, buffer);
		} catch (e) {
			console.warn(
				`Skipping ${detail} learning guide for ${unit.levelPlanId}/${unit.id}:`,
				e instanceof Error ? e.message : e
			);
		}
	}
}

/** Every assessment item file linked to this unit (0, 1, 2, …). */
export async function assessmentsForUnitPlan(unit: UnitPlan): Promise<AssessmentItem[]> {
	const items = await listAssessmentItems(undefined, unit.id);
	return items.sort((a, b) => {
		const an = typeof a.assessmentNumber.value === 'number' ? a.assessmentNumber.value : 999;
		const bn = typeof b.assessmentNumber.value === 'number' ? b.assessmentNumber.value : 999;
		return an - bn || String(a.title.value).localeCompare(String(b.title.value));
	});
}

async function addUnitFolder(
	zip: AdmZip,
	unitFolder: string,
	unit: UnitPlan,
	assessments: AssessmentItem[]
) {
	zip.addFile(`${unitFolder}/${unitPlanExportFilename(unit)}`, await buildUnitPlanDocx(unit));

	const usedFiles = new Set<string>([unitPlanExportFilename(unit)]);
	if (weeksWithLessons(unit).length) {
		const teacherName = uniqueName(lessonPlansTeacherExportFilename(unit), usedFiles);
		const studentName = uniqueName(lessonPlansStudentExportFilename(unit), usedFiles);
		zip.addFile(`${unitFolder}/${teacherName}`, await buildLessonPlansTeacherDocx(unit));
		zip.addFile(`${unitFolder}/${studentName}`, await buildLessonPlansStudentDocx(unit));
	}
	for (const item of assessments) {
		const filename = uniqueName(assessmentItemExportFilename(item), usedFiles);
		zip.addFile(`${unitFolder}/${filename}`, await buildAssessmentItemDocx(item));
	}
}

async function addLevelPlanFolder(
	zip: AdmZip,
	plan: LevelPlan,
	options: LevelPlanBundleOptions = {}
) {
	const folder = plan.id;
	const unitPlans = await listUnitPlans(plan.id);
	syncUnitPlansIntoLevelPlan(plan, unitPlans);

	zip.addFile(`${folder}/${levelPlanExportFilename(plan)}`, await buildLevelPlanDocx(plan));

	const includedAssessmentIds = new Set<string>();
	const usedUnitFolders = new Set<string>();

	for (const unit of unitPlans) {
		const assessments = await assessmentsForUnitPlan(unit);
		for (const item of assessments) includedAssessmentIds.add(item.id);

		const unitFolder = `${folder}/units/${uniqueUnitFolderName(unit, usedUnitFolders)}`;
		await addUnitFolder(zip, unitFolder, unit, assessments);

		if (options.learningGuides) {
			await addLearningGuides(zip, unitFolder, unit);
		}
	}

	// Level-linked items not already nested under a unit (orphans / mismatched unitPlanId)
	const usedOrphanFiles = new Set<string>();
	const levelAssessments = await listAssessmentItems(plan.id);
	for (const item of levelAssessments) {
		if (includedAssessmentIds.has(item.id)) continue;
		const filename = uniqueName(assessmentItemExportFilename(item), usedOrphanFiles);
		zip.addFile(`${folder}/${filename}`, await buildAssessmentItemDocx(item));
	}
}

/** One unit plan + assessments + summary/detailed learning guides. */
export async function buildUnitPlanBundleZip(
	levelPlanId: string,
	unitId: string
): Promise<Buffer> {
	const unit = await getUnitPlan(levelPlanId, unitId);
	if (!unit) throw new Error('Unit plan not found');

	const zip = new AdmZip();
	const assessments = await assessmentsForUnitPlan(unit);
	const unitFolder = unitPlanExportFolderName(unit);
	await addUnitFolder(zip, unitFolder, unit, assessments);
	await addLearningGuides(zip, unitFolder, unit);
	return zip.toBuffer();
}

/** One level plan + each unit folder (unit, assessments, learning guides). */
export async function buildLevelPlanBundleZip(levelPlanId: string): Promise<Buffer> {
	const plan = await getLevelPlan(levelPlanId);
	if (!plan) throw new Error('Level plan not found');

	const zip = new AdmZip();
	await addLevelPlanFolder(zip, plan, { learningGuides: true });
	return zip.toBuffer();
}

/** All faculty level plans, including learning guides. */
export async function buildFacultyBundleZip(): Promise<Buffer> {
	const zip = new AdmZip();
	const index = await getFacultyIndex();

	for (const row of index.rows) {
		const plan = await getLevelPlan(row.id);
		if (!plan) continue;
		await addLevelPlanFolder(zip, plan, { learningGuides: true });
	}

	return zip.toBuffer();
}
