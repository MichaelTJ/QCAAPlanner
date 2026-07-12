import type { LevelPlan, UnitPlan } from '$lib/types';

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
