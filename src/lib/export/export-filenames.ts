import type { AssessmentItem, LevelPlan, UnitPlan } from '$lib/types';

function field(value: unknown): string {
	if (value == null) return '';
	return String(value).trim();
}

/** Strip leading band prefix like "9-10 " from subject labels. */
function subjectLabel(subject: string): string {
	return subject.replace(/^\d+(?:\s*-\s*\d+)?\s+/, '').trim() || subject;
}

/** Underscore spaces; drop characters illegal in Windows filenames. */
function part(text: string): string {
	return text
		.trim()
		.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
		.replace(/\s+/g, '_')
		.replace(/_+/g, '_')
		.replace(/^_|_$/g, '');
}

/** Lowercase hyphen slug for folder segments (matches unit-7-1-digital-literacy style). */
function slugPart(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
}

/**
 * Zip folder name, e.g. unit-7-1-digital-literacy / unit-8-4-country-event-experience
 */
export function unitPlanExportFolderName(plan: UnitPlan): string {
	const yearLevel = plan.yearLevel.value === '' ? '' : String(plan.yearLevel.value);
	const unitNumber = plan.unitNumber.value === '' ? '' : String(plan.unitNumber.value);
	const title = slugPart(field(plan.unitTitle.value)).slice(0, 60);

	const parts = ['unit'];
	if (yearLevel) parts.push(yearLevel);
	if (unitNumber) parts.push(unitNumber);
	if (title) parts.push(title);

	if (parts.length === 1) return plan.id;
	return parts.join('-');
}

/**
 * FacultyDocs-style name, e.g.
 * unit_plan_Digital_Technologies_Year_9_Unit_2_—_Cyber_Security_Site_2026.docx
 */
export function unitPlanExportFilename(plan: UnitPlan): string {
	const subject = part(subjectLabel(field(plan.subject.value))) || 'Unit';
	const yearLevel = plan.yearLevel.value === '' ? '' : String(plan.yearLevel.value);
	const unitNumber = plan.unitNumber.value === '' ? '' : String(plan.unitNumber.value);
	const title = part(field(plan.unitTitle.value));
	const year = plan.year.value === '' ? '' : String(plan.year.value);

	let name = `unit_plan_${subject}`;
	if (yearLevel) name += `_Year_${yearLevel}`;
	if (unitNumber) name += `_Unit_${unitNumber}`;
	if (title) name += `_—_${title}`;
	if (year) name += `_${year}`;
	return `${name}.docx`;
}

function unitLessonBaseName(plan: UnitPlan, role: 'teacher' | 'student'): string {
	const subject = part(subjectLabel(field(plan.subject.value))) || 'Unit';
	const yearLevel = plan.yearLevel.value === '' ? '' : String(plan.yearLevel.value);
	const unitNumber = plan.unitNumber.value === '' ? '' : String(plan.unitNumber.value);
	const title = part(field(plan.unitTitle.value));
	const year = plan.year.value === '' ? '' : String(plan.year.value);
	const prefix = role === 'teacher' ? 'lesson_plans_teacher' : 'lesson_plans_student';

	let name = `${prefix}_${subject}`;
	if (yearLevel) name += `_Year_${yearLevel}`;
	if (unitNumber) name += `_Unit_${unitNumber}`;
	if (title) name += `_—_${title}`;
	if (year) name += `_${year}`;
	return `${name}.docx`;
}

export function lessonPlansTeacherExportFilename(plan: UnitPlan): string {
	return unitLessonBaseName(plan, 'teacher');
}

export function lessonPlansStudentExportFilename(plan: UnitPlan): string {
	return unitLessonBaseName(plan, 'student');
}

export function lessonPlansTeacherPptxExportFilename(plan: UnitPlan): string {
	return unitLessonBaseName(plan, 'teacher').replace(/\.docx$/i, '.pptx');
}

/**
 * Assessment instrument filename, e.g.
 * assessment_Website_Prototype.docx
 */
export function assessmentItemExportFilename(item: AssessmentItem): string {
	const number =
		item.assessmentNumber.value === '' ? '' : String(item.assessmentNumber.value);
	const title = part(field(item.title.value)) || part(item.id) || 'Assessment';
	let name = 'assessment';
	if (number) name += `_${number}`;
	name += `_${title}`;
	return `${name}.docx`;
}

/**
 * FacultyDocs-style name, e.g.
 * level_plan_Digital_Technologies_Band_9-10_2026.docx
 */
export function levelPlanExportFilename(plan: LevelPlan): string {
	const raw = field(plan.bandSubjectTitle.value);
	const bandMatch = raw.match(/^(\d+(?:\s*-\s*\d+)?)\s+(.*)$/);
	const band = bandMatch ? bandMatch[1].replace(/\s+/g, '') : '';
	const subject = part(bandMatch ? bandMatch[2] : subjectLabel(raw)) || 'Level';
	const year = plan.year.value === '' ? '' : String(plan.year.value);

	let name = `level_plan_${subject}`;
	if (band) name += `_Band_${band}`;
	if (year) name += `_${year}`;
	return `${name}.docx`;
}

/** Content-Disposition with ASCII fallback + RFC 5987 UTF-8 filename. */
export function attachmentContentDisposition(filename: string): string {
	const ascii = filename.replace(/[^\x20-\x7E]/g, '_');
	return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
