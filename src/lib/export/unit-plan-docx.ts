import { formatCheckedSubElements } from '$lib/general-capabilities';
import {
	aiField,
	type UnitAdjustment,
	type UnitAssessment,
	type UnitAssessmentContentDescription,
	type UnitGeneralCapability,
	type UnitPlan,
	type TeachingWeek
} from '$lib/types';
import {
	extractTopLevelTables,
	extractTopLevelTablesWithSeparators,
	formatContentDescription,
	joinDocument,
	loadTemplateDocumentXml,
	packDocument,
	rebuildTable,
	replaceNthTextNode,
	setRowCells,
	UNIT_PLAN_TEMPLATE_PATH,
	unwrapTable,
	extractRows
} from './docx-xml';

const SCHOOL = "St Brendan's College (Yeppoon)";
const KNOWLEDGE_STRAND = 'Knowledge and understanding';
const PROCESSES_STRAND = 'Processes and production skills';
const PLANNING_LABEL = 'Key teaching and learning experiences';

const DEFAULT_SEP =
	'<w:p w14:paraId="7F64BFB3" w14:textId="77777777" w:rsidR="00126D17" w:rsidRDefault="00126D17"/>';

function field(value: unknown): string {
	if (value == null) return '';
	return String(value);
}

function overviewLeft(plan: UnitPlan): string {
	const parts = [
		`Start week: ${field(plan.startWeek.value)}`,
		`Finish week: ${field(plan.finishWeek.value)}`,
		field(plan.unitDescription.value)
	].filter((p, i) => i < 2 || p.trim());
	return parts.join('\n');
}

function buildOverviewTable(tableXml: string, plan: UnitPlan): string {
	const rows = extractRows(unwrapTable(tableXml));
	return rebuildTable(unwrapTable(tableXml), [
		setRowCells(rows[0], ['Unit overview', 'Cohort and/or class considerations']),
		setRowCells(rows[1], [overviewLeft(plan), field(plan.cohortAndClassConsiderations.value)])
	]);
}

const ADJUSTMENT_LABELS = [
	'Student initials/identifier',
	'Year level/band against which the student is to be assessed',
	'Category of need',
	'Adjustment/s and/or key information',
	'Review of adjustments'
] as const;

function adjustmentValues(adj: UnitAdjustment | undefined): string[] {
	return [
		field(adj?.studentIdentifier.value),
		field(adj?.assessmentBand.value),
		field(adj?.categoryOfNeed.value),
		field(adj?.adjustments.value),
		field(adj?.review.value)
	];
}

function buildAdjustmentsTable(tableXml: string, adjustments: UnitAdjustment[]): string {
	const rows = extractRows(unwrapTable(tableXml));
	const header = setRowCells(rows[0], ['Adjustments', '']);
	const fieldTemplates = rows.slice(1, 6);
	const blocks = adjustments.length ? adjustments : [undefined];
	const built: string[] = [header];
	for (const adj of blocks) {
		const values = adjustmentValues(adj);
		for (let i = 0; i < ADJUSTMENT_LABELS.length; i++) {
			const template = fieldTemplates[i] ?? fieldTemplates[0] ?? rows[1];
			built.push(setRowCells(template, [ADJUSTMENT_LABELS[i], values[i] ?? '']));
		}
	}
	return rebuildTable(unwrapTable(tableXml), built);
}

function splitCdsByStrand(cds: UnitAssessmentContentDescription[]) {
	const knowledge = cds.filter((c) => c.strand.value.trim() === KNOWLEDGE_STRAND);
	const processes = cds.filter((c) => c.strand.value.trim() === PROCESSES_STRAND);
	const other = cds.filter(
		(c) =>
			c.strand.value.trim() !== KNOWLEDGE_STRAND &&
			c.strand.value.trim() !== PROCESSES_STRAND
	);
	return { knowledge, processes, other };
}

function formatCd(cd: UnitAssessmentContentDescription | undefined): string {
	if (!cd) return '';
	return formatContentDescription(cd.subStrand.value, cd.text.value, cd.code.value);
}

function buildAssessmentTable(tableXml: string, assessment: UnitAssessment): string {
	const rows = extractRows(unwrapTable(tableXml));
	const banner = rows[0];
	const yearRow = rows[1];
	const titleRow = rows[2];
	const descriptionRow = rows[3];
	const techniqueRow = rows[4];
	const modeRow = rows[5];
	const conditionsRow = rows[6];
	const timingRow = rows[7];
	const achievementRow = rows[8];
	const moderationRow = rows[9];
	const contentHeader = rows[10];
	const strandHeader = rows[11];
	const cdTemplate = rows[12] ?? rows[11];

	const number = assessment.assessmentNumber.value;
	const year = assessment.yearLevel.value;
	const built: string[] = [
		setRowCells(banner, [`Assessment ${number === '' ? '' : number}`.trim() || 'Assessment']),
		setRowCells(yearRow, [year === '' ? 'Year' : `Year ${year}`]),
		setRowCells(titleRow, ['Title', field(assessment.title.value)]),
		setRowCells(descriptionRow, ['Description', field(assessment.description.value)]),
		setRowCells(techniqueRow, ['Technique', field(assessment.technique.value)]),
		setRowCells(modeRow, ['Mode', field(assessment.mode.value)]),
		setRowCells(conditionsRow, ['Conditions', field(assessment.conditions.value)]),
		setRowCells(timingRow, ['Timing', field(assessment.timing.value)]),
		setRowCells(achievementRow, [
			'Achievement standard',
			field(assessment.achievementStandard.value)
		]),
		setRowCells(moderationRow, ['Moderation', field(assessment.moderation.value)]),
		setRowCells(contentHeader, ['Content descriptions', '']),
		setRowCells(strandHeader, [KNOWLEDGE_STRAND, PROCESSES_STRAND])
	];

	const { knowledge, processes, other } = splitCdsByStrand(assessment.contentDescriptions);
	const pairCount = Math.max(knowledge.length, processes.length, other.length, 1);
	for (let i = 0; i < pairCount; i++) {
		let left = formatCd(knowledge[i]);
		let right = formatCd(processes[i]);
		if (!left && !right && other[i]) right = formatCd(other[i]);
		built.push(setRowCells(cdTemplate, [left, right]));
	}

	return rebuildTable(unwrapTable(tableXml), built);
}

function capabilitySubElements(cap: UnitGeneralCapability): string {
	const fromChecks = formatCheckedSubElements(cap.name.value, cap.subElementChecks ?? {});
	if (fromChecks.trim()) return fromChecks;
	return field(cap.subElements.value);
}

function buildCapabilitiesTable(tableXml: string, capabilities: UnitGeneralCapability[]): string {
	const rows = extractRows(unwrapTable(tableXml));
	const header = setRowCells(rows[0], ['General capabilities']);
	const nameTemplate = rows[1] ?? rows[0];
	const subTemplate = rows[2] ?? rows[1] ?? rows[0];
	const evidenceTemplate = rows[3] ?? rows[2] ?? rows[1] ?? rows[0];

	const active = capabilities.filter(
		(cap) => capabilitySubElements(cap).trim() || field(cap.evidenceNotes.value).trim()
	);

	const built: string[] = [header];
	const list = active.length ? active : [];
	if (!list.length) {
		built.push(setRowCells(nameTemplate, ['']));
		return rebuildTable(unwrapTable(tableXml), built);
	}

	for (const cap of list) {
		built.push(setRowCells(nameTemplate, [field(cap.name.value)]));
		const subs = capabilitySubElements(cap);
		if (subs.trim()) built.push(setRowCells(subTemplate, [subs]));
		const evidence = field(cap.evidenceNotes.value);
		if (evidence.trim()) built.push(setRowCells(evidenceTemplate, [evidence]));
	}
	return rebuildTable(unwrapTable(tableXml), built);
}

function buildWeekTriplet(
	mainTemplate: string,
	adjTemplate: string,
	resTemplate: string,
	week: TeachingWeek
): string[] {
	const weekNum = week.week.value === '' ? '' : String(week.week.value);
	return [
		setRowCells(mainTemplate, [
			weekNum,
			PLANNING_LABEL,
			field(week.theory.value) || field(week.keyTeachingExperiences.value),
			field(week.prac.value),
			field(week.assessment.value)
		]),
		setRowCells(adjTemplate, ['', '', 'Adjustments', field(week.adjustments.value), '']),
		setRowCells(resTemplate, ['', '', 'Resources', field(week.resources.value), ''])
	];
}

function buildTeachingSequenceTable(tableXml: string, weeks: TeachingWeek[]): string {
	const rows = extractRows(unwrapTable(tableXml));
	const title = setRowCells(rows[0], ['Teaching and learning sequence']);
	const columns = setRowCells(rows[1], [
		'Week',
		'Planning details',
		'Theory',
		'Prac',
		'Assessment'
	]);
	const mainTemplate = rows[2] ?? rows[1];
	const adjTemplate = rows[3] ?? rows[2];
	const resTemplate = rows[4] ?? rows[3] ?? rows[2];

	const built: string[] = [title, columns];
	const list = weeks.length ? weeks : [];
	if (!list.length) {
		built.push(
			...buildWeekTriplet(mainTemplate, adjTemplate, resTemplate, {
				id: 'empty',
				week: aiField<number | ''>(''),
				keyTeachingExperiences: aiField(''),
				adjustments: aiField(''),
				resources: aiField(''),
				theory: aiField(''),
				prac: aiField(''),
				assessment: aiField('')
			})
		);
	} else {
		for (const week of list) {
			built.push(...buildWeekTriplet(mainTemplate, adjTemplate, resTemplate, week));
		}
	}
	return rebuildTable(unwrapTable(tableXml), built);
}

function buildEvaluationTable(tableXml: string, evaluation: string): string {
	const rows = extractRows(unwrapTable(tableXml));
	return rebuildTable(unwrapTable(tableXml), [
		setRowCells(rows[0], ['Evaluation']),
		setRowCells(rows[1] ?? rows[0], [evaluation])
	]);
}

function setTitle(before: string, plan: UnitPlan): string {
	const yearLevel = plan.yearLevel.value === '' ? '' : String(plan.yearLevel.value);
	const subject = field(plan.subject.value);
	const unitNumber = plan.unitNumber.value === '' ? '' : String(plan.unitNumber.value);
	const title = field(plan.unitTitle.value);
	const year = plan.year.value === '' ? '' : String(plan.year.value);

	const line0 = `Year ${yearLevel} ${subject}`.trim();
	const line1 = `Unit ${unitNumber} — ${title}`.replace(/^Unit\s+—\s+/, 'Unit — ').trim();
	const line2 = `${SCHOOL}, ${year}`.replace(/,\s*$/, '');

	let section = before;
	// Template may duplicate title nodes (first-page + continuation); fill first 6.
	const lines = [line0, line1, line2, line0, line1, line2];
	for (let i = 0; i < lines.length; i++) {
		section = replaceNthTextNode(section, i, lines[i]);
	}
	return section;
}

function updateFooters(
	zip: Awaited<ReturnType<typeof loadTemplateDocumentXml>>['zip'],
	plan: UnitPlan
): void {
	const yearLevel = plan.yearLevel.value === '' ? '' : String(plan.yearLevel.value);
	const subject = field(plan.subject.value) || 'Digital Technologies';
	const year = plan.year.value === '' ? '' : String(plan.year.value);
	const unitNumber = plan.unitNumber.value === '' ? '' : String(plan.unitNumber.value);
	const status = field(plan.status.value) || 'Draft';
	const printed = new Date().toLocaleDateString('en-AU', {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric'
	});

	const subjectLine = `${subject} Year ${yearLevel} ${year}`.replace(/\s+/g, ' ').trim();
	const unitLine = `Unit plan: Unit ${unitNumber}`.trim();
	const statusLine = `Status: ${status}`;
	const printedLine = `Printed: ${printed}`;

	for (const entry of zip.getEntries()) {
		if (!/^word\/footer\d*\.xml$/i.test(entry.entryName)) continue;
		let xml = entry.getData().toString('utf-8');
		xml = xml
			.replace(/\{subject\} Year \{level\} \{year\}/g, subjectLine)
			.replace(/Digital Technologies Year \d+ \d{4}/g, subjectLine)
			.replace(/Unit plan: Unit \{n\}/g, unitLine)
			.replace(/Unit plan: Unit \d+/g, unitLine)
			.replace(/Status: \{status\}/g, statusLine)
			.replace(/Status: [^<]*/g, statusLine)
			.replace(/Printed: \{printed\}/g, printedLine)
			.replace(/Printed: [^<]*/g, printedLine);
		zip.updateFile(entry.entryName, Buffer.from(xml, 'utf-8'));
	}
}

export async function buildUnitPlanDocx(plan: UnitPlan): Promise<Buffer> {
	const { zip, documentXml } = await loadTemplateDocumentXml(UNIT_PLAN_TEMPLATE_PATH);
	const { before, between, tail } = extractTopLevelTablesWithSeparators(documentXml);
	const templateTables = extractTopLevelTables(documentXml);

	if (templateTables.length < 6) {
		throw new Error(
			`Unit plan template expected 6 tables, found ${templateTables.length}. Re-run scripts/build-unit-plan-template.mjs`
		);
	}

	const overview = buildOverviewTable(templateTables[0], plan);
	const adjustments = buildAdjustmentsTable(templateTables[1], plan.adjustments ?? []);
	const assessmentTemplate = templateTables[2];
	const assessments = (plan.assessments.length ? plan.assessments : []).map((a) =>
		buildAssessmentTable(assessmentTemplate, a)
	);
	if (!assessments.length) {
		assessments.push(
			buildAssessmentTable(assessmentTemplate, {
				id: 'empty',
				assessmentNumber: aiField<number | ''>(''),
				yearLevel: aiField(plan.yearLevel.value),
				title: aiField(''),
				description: aiField(''),
				technique: aiField(''),
				mode: aiField(''),
				conditions: aiField(''),
				timing: aiField(''),
				achievementStandard: aiField(''),
				moderation: aiField(''),
				contentDescriptions: []
			})
		);
	}
	const capabilities = buildCapabilitiesTable(templateTables[3], plan.generalCapabilities ?? []);
	const teaching = buildTeachingSequenceTable(templateTables[4], plan.teachingSequence ?? []);
	const evaluation = buildEvaluationTable(templateTables[5], field(plan.evaluation.value));

	const tables = [overview, adjustments, ...assessments, capabilities, teaching, evaluation];
	const seps: string[] = [];
	const fallback = between[0] ?? DEFAULT_SEP;
	for (let i = 0; i < tables.length - 1; i++) {
		seps.push(between[Math.min(i, between.length - 1)] ?? fallback);
	}

	const headerBefore = setTitle(before, plan);
	const newXml = joinDocument(headerBefore, tables, seps, tail);
	updateFooters(zip, plan);
	return packDocument(zip, newXml);
}
