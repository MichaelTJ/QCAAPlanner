import type { UnitPlan } from '$lib/types';
import {
	type LearningGuideData,
	type LearningGuideWeek,
	learningGuideFromUnitPlan
} from '$lib/learning-guide-data';
import {
	extractTopLevelCells,
	extractTopLevelRows,
	extractTopLevelTables,
	extractTopLevelTablesWithSeparators,
	extractParagraphs,
	joinDocument,
	LEARNING_GUIDE_TEMPLATE_PATH,
	loadTemplateDocumentXml,
	packDocument,
	rebuildTable,
	replaceNthTextNode,
	replaceRowCells,
	setCellLearningGuideContent,
	setCellText,
	setRowCells,
	unwrapTable
} from './docx-xml';

export type { LearningGuideData, LearningGuideWeek } from '$lib/learning-guide-data';
export { learningGuideFromUnitPlan } from '$lib/learning-guide-data';

/** @deprecated Used only as a dev fallback when AI generation is skipped. */
export const DEFAULT_LEARNING_GUIDE_VOCABULARY = `OneDrive/Teams: Cloud Storage, OneDrive, Permissions, Channel,
Word/Excel/PowerPoint: Format, Template, Spreadsheet, Formula, Function, Data, Chart, Slide, Animation
Artificial Intelligence: Machine Learning, Bias, Ethical use
Cybersecurity: Multi-Factor Authentication (MFA), Social Engineering`;

const TITLE_YEAR_TEXT_INDEX = 1;
const TITLE_SUBJECT_TEXT_INDEX = 3;
const TITLE_TERM_TEXT_INDEX = 5;

function setTitle(before: string, data: LearningGuideData): string {
	let section = before;
	section = replaceNthTextNode(
		section,
		TITLE_YEAR_TEXT_INDEX,
		data.yearLevel === '' ? '' : String(data.yearLevel)
	);
	section = replaceNthTextNode(section, TITLE_SUBJECT_TEXT_INDEX, data.subject);
	section = replaceNthTextNode(
		section,
		TITLE_TERM_TEXT_INDEX,
		data.term === '' ? '' : String(data.term)
	);
	return section;
}

function buildWeekRow(
	rowTemplate: string,
	contentCellTemplate: string,
	week: LearningGuideWeek
): string {
	const cells = extractTopLevelCells(rowTemplate);
	const weekNumber = week.week === '' ? '' : String(week.week);
	const contentCell = setCellLearningGuideContent(contentCellTemplate, week.title, week.bullets);

	return replaceRowCells(rowTemplate, [
		setCellText(cells[0], weekNumber),
		contentCell,
		cells[2] ?? '',
		cells[3] ?? '',
		cells[4] ?? ''
	]);
}

function buildMainTable(tableInner: string, weeks: LearningGuideWeek[]): string {
	const rows = extractTopLevelRows(tableInner);
	const headerRows = rows.slice(0, 2);
	const dataRowTemplates = rows.slice(2);
	const contentTemplate =
		dataRowTemplates.find((row) => extractParagraphs(extractTopLevelCells(row)[1] ?? '').length > 2) ??
		dataRowTemplates[0];
	const contentCellTemplate = extractTopLevelCells(contentTemplate)[1];

	const dataRows = weeks.map((week, index) => {
		const rowTemplate = dataRowTemplates[index] ?? dataRowTemplates[dataRowTemplates.length - 1];
		return buildWeekRow(rowTemplate, contentCellTemplate, week);
	});

	return rebuildTable(tableInner, [...headerRows, ...dataRows]);
}

function buildVocabularyTable(tableInner: string, vocabulary: string): string {
	const rows = extractTopLevelRows(tableInner);
	const vocabCell = extractTopLevelCells(rows[1])[0];
	return rebuildTable(tableInner, [
		setRowCells(rows[0], ['VOCABULARY']),
		replaceRowCells(rows[1], [setCellText(vocabCell, vocabulary)])
	]);
}

export async function buildLearningGuideDocx(
	data: LearningGuideData,
	templatePath = LEARNING_GUIDE_TEMPLATE_PATH
): Promise<Buffer> {
	const { zip, documentXml } = await loadTemplateDocumentXml(templatePath);
	const { before: templateBefore, between, tail } = extractTopLevelTablesWithSeparators(documentXml);
	const tables = extractTopLevelTables(documentXml);

	if (tables.length < 2) {
		throw new Error('Learning guide template must contain main and vocabulary tables');
	}

	const mainTable = buildMainTable(unwrapTable(tables[0]), data.weeks);
	const vocabulary = data.vocabulary?.trim();
	if (!vocabulary) {
		throw new Error('Learning guide vocabulary is required — generate it before building the document');
	}
	const vocabularyTable = buildVocabularyTable(unwrapTable(tables[1]), vocabulary);

	const headerBefore = setTitle(templateBefore, data);
	const newXml = joinDocument(headerBefore, [mainTable, vocabularyTable], between, tail);
	return packDocument(zip, newXml);
}

export async function buildLearningGuideDocxFromUnitPlan(unit: UnitPlan): Promise<Buffer> {
	const data = learningGuideFromUnitPlan(unit);
	if (!data.vocabulary?.trim()) {
		throw new Error(
			'buildLearningGuideDocxFromUnitPlan requires vocabulary — use buildLearningGuideDocxForUnit from $lib/server/learning-guide-export'
		);
	}
	return buildLearningGuideDocx(data);
}
