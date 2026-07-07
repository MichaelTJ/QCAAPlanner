import type { CapabilityRow, ContentDescriptionRow, LevelPlan, LevelPlanUnit } from '$lib/types';
import {
	checkmark,
	cellWidth,
	extractCells,
	extractNestedTables,
	extractRows,
	extractTopLevelTables,
	extractTopLevelTablesWithSeparators,
	formatAssessmentTitle,
	formatContentDescription,
	formatWeek,
	applyCapabilityUnitColumnWidths,
	clearWrapperTableBorders,
	clampUnitCount,
	ensureFixedTableLayout,
	ensureFullTableBorders,
	resizeCapabilityTableColumns,
	resizeContentDescriptionsColumns,
	resizeUnitBlockTableColumns,
	setWrapperTableLayout,
	joinDocument,
	loadTemplateDocumentXml,
	mapTableSeparators,
	packDocument,
	rebuildTable,
	replaceNestedTables,
	replaceNthTextNode,
	replaceRowCells,
	setCellCheckmark,
	setCellText,
	setRowCells,
	unwrapTable,
	wrapTable
} from './docx-xml';

const KNOWLEDGE_STRAND = 'Knowledge and understanding';
const PROCESSES_STRAND = 'Processes and production skills';
const MAX_UNITS_PER_ROW = 4;

const ASSESSMENT_FIELDS = [
	'Term',
	'Week',
	'Description',
	'Technique',
	'Mode',
	'Conditions',
	'Achievement standard',
	'Moderation'
] as const;

function fieldValue(
	unit: LevelPlanUnit,
	assessmentIndex: number,
	field: (typeof ASSESSMENT_FIELDS)[number]
): string {
	const a = unit.assessments[assessmentIndex];
	if (!a) return '';
	switch (field) {
		case 'Term':
			return a.term.value === '' ? '' : String(a.term.value);
		case 'Week':
			return formatWeek(a.week.value);
		case 'Description':
			return a.description.value;
		case 'Technique':
			return a.technique.value;
		case 'Mode':
			return a.mode.value;
		case 'Conditions':
			return a.conditions.value;
		case 'Achievement standard':
			return a.achievementStandard.value;
		case 'Moderation':
			return a.moderation.value;
	}
}

function buildLevelDescriptionTable(tableInner: string, plan: LevelPlan): string {
	const rows = extractRows(tableInner);
	return rebuildTable(tableInner, [
		setRowCells(rows[0], ['Level description', 'Context and cohort considerations']),
		setRowCells(rows[1], [plan.levelDescription.value, plan.contextAndCohortConsiderations.value])
	]);
}

function blockUnitCount(units: LevelPlanUnit[]): number {
	return Math.min(MAX_UNITS_PER_ROW, units.length);
}

function finalizeUnitBlockTable(tableInner: string, builtRows: string[], unitCount: number): string {
	let tblPr = tableInner.match(/<w:tblPr>[\s\S]*?<\/w:tblPr>/)?.[0] ?? '';
	tblPr = ensureFixedTableLayout(tblPr);
	const tblGrid = tableInner.match(/<w:tblGrid>[\s\S]*?<\/w:tblGrid>/)?.[0] ?? '';
	let inner = `${tblPr}${tblGrid}${builtRows.join('')}`;
	if (unitCount < MAX_UNITS_PER_ROW) {
		inner = resizeUnitBlockTableColumns(inner, unitCount);
	}
	return wrapTable(inner);
}

function buildUnitOverviewTable(tableInner: string, units: LevelPlanUnit[]): string {
	const rows = extractRows(tableInner);
	const unitCount = blockUnitCount(units);
	const slice = units.slice(0, unitCount);

	return finalizeUnitBlockTable(
		tableInner,
		[
			setRowCells(rows[0], ['', ...slice.map((u) => u.unitTitle.value)]),
			setRowCells(rows[1], [
				'Year level',
				...slice.map((u) => (u.yearLevel.value === '' ? '' : String(u.yearLevel.value)))
			]),
			setRowCells(rows[2], ['Duration', ...slice.map((u) => u.duration.value)]),
			setRowCells(rows[3], ['Description', ...slice.map((u) => u.description.value)])
		],
		unitCount
	);
}

function buildAssessmentBlockTable(tableInner: string, units: LevelPlanUnit[]): string {
	const rows = extractRows(tableInner);
	const unitCount = blockUnitCount(units);
	const slice = units.slice(0, unitCount);
	const titleTemplate = rows[1];
	const fieldTemplates = rows.slice(2, 10);

	const unitTitleRow = setRowCells(rows[0], ['', ...slice.map((u) => u.unitTitle.value)]);

	const maxAssessments = Math.max(0, ...slice.map((u) => u.assessments.length));
	const blockRows: string[] = [unitTitleRow];

	for (let ai = 0; ai < maxAssessments; ai++) {
		blockRows.push(
			setRowCells(titleTemplate, [
				'',
				...slice.map((u) =>
					u.assessments[ai]
						? formatAssessmentTitle(
								u.assessments[ai].assessmentNumber.value,
								u.assessments[ai].title.value
							)
						: ''
				)
			])
		);

		for (let fi = 0; fi < ASSESSMENT_FIELDS.length; fi++) {
			const field = ASSESSMENT_FIELDS[fi];
			blockRows.push(
				setRowCells(fieldTemplates[fi] ?? fieldTemplates[0], [
					field,
					...slice.map((u) => fieldValue(u, ai, field))
				])
			);
		}
	}

	return finalizeUnitBlockTable(tableInner, blockRows, unitCount);
}

function splitContentByStrand(rows: ContentDescriptionRow[]) {
	const knowledge = rows.filter((r) => r.strand.value.trim() === KNOWLEDGE_STRAND);
	const processes = rows.filter((r) => r.strand.value.trim() === PROCESSES_STRAND);
	return { knowledge, processes };
}

interface ContentSide {
	text: string;
	ticks: boolean[];
}

function contentSide(row: ContentDescriptionRow | undefined, unitCount: number): ContentSide {
	const ticks = Array.from({ length: unitCount }, (_, i) =>
		Boolean(row?.unitInclusions[i])
	);
	if (!row) return { text: '', ticks };
	return {
		text: formatContentDescription(row.subStrand.value, row.text.value, row.code.value),
		ticks
	};
}

function findWideRightTextCell(tableRows: string[], unitCount: number): string {
	const rightTextIdx = 1 + unitCount;
	for (const row of tableRows) {
		const cells = extractCells(row);
		if (cells[rightTextIdx] && cellWidth(cells[rightTextIdx]) > 4000) return cells[rightTextIdx];
	}
	const fallbackRow = tableRows[0] ?? tableRows[tableRows.length - 1];
	const cells = extractCells(fallbackRow);
	return cells[rightTextIdx] ?? cells[6] ?? cells[0];
}

function findRightTickCell(tableRows: string[], unitCount: number): string {
	const rightTickIdx = 2 + unitCount;
	const fallbackRow = tableRows[0] ?? tableRows[tableRows.length - 1];
	const cells = extractCells(fallbackRow);
	return cells[rightTickIdx] ?? cells[7] ?? cells[1];
}

function buildContentDescriptionDataRow(
	rowShell: string,
	leftTextCell: string,
	leftTickCell: string,
	rightTextCell: string,
	rightTickCell: string,
	left: ContentSide,
	right: ContentSide
): string {
	const cells = [
		setCellText(leftTextCell, left.text),
		...left.ticks.map((included) => setCellCheckmark(leftTickCell, included)),
		setCellText(rightTextCell, right.text),
		...right.ticks.map((included) => setCellCheckmark(rightTickCell, included))
	];
	return replaceRowCells(rowShell, cells);
}

function buildContentDescriptionsTable(
	tableInner: string,
	rows: ContentDescriptionRow[],
	unitCount: number
): string {
	const resizedInner = resizeContentDescriptionsColumns(tableInner, unitCount);
	const tableRows = extractRows(resizedInner);
	const { knowledge, processes } = splitContentByStrand(rows);
	const pairCount = Math.max(knowledge.length, processes.length, 1);
	const headerRows = tableRows.slice(0, 2);
	const dataRowShell = tableRows[2] ?? tableRows[tableRows.length - 1];
	const shellCells = extractCells(dataRowShell);

	const leftTextCell = shellCells[0];
	const leftTickCell = shellCells[1];
	const dataTemplates = tableRows.slice(2);
	const rightTextCell = findWideRightTextCell(dataTemplates, unitCount);
	const rightTickCell = findRightTickCell(dataTemplates, unitCount);

	const dataRows: string[] = [];
	for (let i = 0; i < pairCount; i++) {
		dataRows.push(
			buildContentDescriptionDataRow(
				dataRowShell,
				leftTextCell,
				leftTickCell,
				rightTextCell,
				rightTickCell,
				contentSide(knowledge[i], unitCount),
				contentSide(processes[i], unitCount)
			)
		);
	}

	return rebuildTable(resizedInner, [...headerRows, ...dataRows]);
}

function buildCapabilityTable(
	tableInner: string,
	capabilities: CapabilityRow[],
	unitCount: number,
	fixUnitColumnWidths = false
) {
	const resizedInner = resizeCapabilityTableColumns(tableInner, unitCount);
	const tableRows = extractRows(resizedInner);
	const dataTemplate = tableRows[2] ?? tableRows[tableRows.length - 1];

	const dataRows = capabilities.map((cap) => {
		const values = [
			cap.name.value,
			...Array.from({ length: unitCount }, (_, i) => checkmark(Boolean(cap.unitInclusions[i])))
		];
		return setRowCells(dataTemplate, values);
	});

	let rebuiltInner = unwrapTable(
		rebuildTable(resizedInner, [...tableRows.slice(0, 2), ...dataRows])
	);
	if (fixUnitColumnWidths) {
		rebuiltInner = applyCapabilityUnitColumnWidths(rebuiltInner, unitCount);
	}
	return wrapTable(ensureFullTableBorders(rebuiltInner));
}

function buildCapabilitiesWrapper(
	wrapperTable: string,
	generalCapabilities: CapabilityRow[],
	crossCurriculumPriorities: CapabilityRow[],
	unitCount: number
): string {
	const wrapperInner = unwrapTable(wrapperTable);
	const nested = extractNestedTables(wrapperInner);

	if (nested.length < 2) {
		throw new Error('Template capabilities wrapper missing nested tables');
	}

	const updatedNested = [
		buildCapabilityTable(unwrapTable(nested[0]), generalCapabilities, unitCount, true),
		buildCapabilityTable(unwrapTable(nested[1]), crossCurriculumPriorities, unitCount, true)
	];

	const withNested = replaceNestedTables(wrapperInner, updatedNested);
	return wrapTable(setWrapperTableLayout(clearWrapperTableBorders(withNested)));
}

function levelPlanSubtitle(plan: LevelPlan): string {
	const year = plan.year.value === '' ? '' : String(plan.year.value);
	const status = plan.status.value || '';
	if (year || status) {
		return `Curriculum and assessment plan · ${year} · ${status}`;
	}
	return 'Curriculum and assessment plan';
}

function setHeader(before: string, plan: LevelPlan): string {
	let section = before;
	const subtitle = levelPlanSubtitle(plan);
	section = replaceNthTextNode(section, 0, plan.bandSubjectTitle.value || 'Level Plan');
	section = replaceNthTextNode(section, 1, subtitle);
	section = replaceNthTextNode(section, 2, plan.school.value);
	section = replaceNthTextNode(section, 3, plan.bandSubjectTitle.value || 'Level Plan');
	section = replaceNthTextNode(section, 4, subtitle);
	section = replaceNthTextNode(section, 5, plan.school.value);
	return section;
}

export async function buildLevelPlanDocx(plan: LevelPlan): Promise<Buffer> {
	const { zip, documentXml } = await loadTemplateDocumentXml();
	const templateParts = extractTopLevelTablesWithSeparators(documentXml);
	const { before: templateBefore, between: templateBetween, tail } = templateParts;
	const tables = [...extractTopLevelTables(documentXml)];
	const hasOverflow = plan.units.length > MAX_UNITS_PER_ROW;
	const overflowUnits = plan.units.slice(MAX_UNITS_PER_ROW);
	const unitCount = clampUnitCount(plan.units.length);
	const overviewTemplate = unwrapTable(tables[1]);
	const assessmentTemplate = unwrapTable(tables[2]);
	const primaryUnits = plan.units.slice(0, MAX_UNITS_PER_ROW);

	tables[0] = buildLevelDescriptionTable(unwrapTable(tables[0]), plan);
	tables[1] = buildUnitOverviewTable(overviewTemplate, primaryUnits);
	tables[2] = buildAssessmentBlockTable(assessmentTemplate, primaryUnits);

	if (hasOverflow) {
		tables[3] = buildUnitOverviewTable(overviewTemplate, overflowUnits);
		tables.splice(4, 0, buildAssessmentBlockTable(assessmentTemplate, overflowUnits));
	} else {
		tables.splice(3, 1);
	}

	const contentIdx = hasOverflow ? 5 : 3;
	const wrapperIdx = contentIdx + 1;

	tables[contentIdx] = buildContentDescriptionsTable(
		unwrapTable(tables[contentIdx]),
		plan.contentDescriptions,
		unitCount
	);

	tables[wrapperIdx] = buildCapabilitiesWrapper(
		tables[wrapperIdx],
		plan.generalCapabilities,
		plan.crossCurriculumPriorities,
		unitCount
	);

	const between = mapTableSeparators(templateBetween, hasOverflow);
	const headerBefore = setHeader(templateBefore, plan);
	const newXml = joinDocument(headerBefore, tables, between, tail);
	return packDocument(zip, newXml);
}
