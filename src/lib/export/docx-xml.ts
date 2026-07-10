import AdmZip from 'adm-zip';
import fs from 'node:fs/promises';
import path from 'node:path';

export const LEVEL_PLAN_TEMPLATE_PATH = path.join(
	process.cwd(),
	'FacultyDocs/Templates/Example_level_plan_Design_and_Technologies_Band_9-10_2026.docx'
);

export const LEARNING_GUIDE_TEMPLATE_PATH = path.join(
	process.cwd(),
	'FacultyDocs/Templates/LG - Digital Technologies - Term 1 2026.docx'
);

export const ASSESSMENT_TEMPLATE_PATHS = {
	'7-8': {
		assignment: path.join(
			process.cwd(),
			'FacultyDocs/Templates/DigiTech7-8AssignmentTemplate.docx'
		),
		exam: path.join(process.cwd(), 'FacultyDocs/Templates/DigiTech7-8ExamTemplate.docx')
	},
	'9-10': {
		assignment: path.join(
			process.cwd(),
			'FacultyDocs/Templates/DigiTech9-10AssignmentTemplate.docx'
		),
		exam: path.join(process.cwd(), 'FacultyDocs/Templates/DigiTech9-10ExamTemplate.docx')
	}
} as const;

/** Internal marker passed to setRowCells for checkbox cells. */
export const TICK_SENTINEL = '\uE000';

const TICK_RUN =
	'<w:r><w:rPr><w:rFonts w:ascii="Wingdings" w:hAnsi="Wingdings" w:cs="Wingdings"/><w:sz w:val="30"/></w:rPr><w:sym w:font="Wingdings" w:char="00FC"/></w:r>';

const DEFAULT_TABLE_SEPARATOR =
	'<w:p w14:paraId="7F64BFB3" w14:textId="77777777" w:rsidR="00126D17" w:rsidRDefault="00126D17"/>';

const DEFAULT_TICK_PPR =
	'<w:pPr><w:spacing w:line="259" w:lineRule="auto"/><w:ind w:left="128"/><w:jc w:val="both"/></w:pPr>';

export function escapeXml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

export function cellText(cellXml: string): string {
	return [...cellXml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
		.map((m) => m[1])
		.join('');
}

/** Extract top-level tables only, respecting nested <w:tbl> elements. */
export function extractTopLevelTables(xml: string): string[] {
	const tables: string[] = [];
	let depth = 0;
	let start = -1;
	let i = 0;
	while (i < xml.length) {
		const open = xml.indexOf('<w:tbl>', i);
		const close = xml.indexOf('</w:tbl>', i);
		if (open === -1 && close === -1) break;
		if (open !== -1 && (close === -1 || open < close)) {
			if (depth === 0) start = open;
			depth++;
			i = open + 7;
		} else {
			depth--;
			if (depth === 0) tables.push(xml.slice(start, close + 8));
			i = close + 8;
		}
	}
	return tables;
}

/** Extract nested tables from within a table's inner XML. */
export function extractNestedTables(tableInnerXml: string): string[] {
	return extractTopLevelTables(tableInnerXml);
}

export function unwrapTable(tableXml: string): string {
	return tableXml.replace(/^<w:tbl>/, '').replace(/<\/w:tbl>$/, '');
}

export function wrapTable(tableInnerXml: string): string {
	return `<w:tbl>${tableInnerXml}</w:tbl>`;
}

/** @deprecated Use extractTopLevelTables */
export function extractTables(xml: string): string[] {
	return extractTopLevelTables(xml).map(unwrapTable);
}

export function extractRows(tableInnerXml: string): string[] {
	const rows: string[] = [];
	const re = /<w:tr\b[^>]*>[\s\S]*?<\/w:tr>/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(tableInnerXml))) rows.push(m[0]);
	return rows;
}

/** Extract only direct child rows of a table, ignoring rows inside nested tables. */
export function extractTopLevelRows(tableInnerXml: string): string[] {
	const rows: string[] = [];
	let i = 0;
	while (i < tableInnerXml.length) {
		if (tableInnerXml.startsWith('<w:tbl>', i)) {
			const close = findBalancedClose(tableInnerXml, i, '<w:tbl>', '</w:tbl>');
			if (close < 0) break;
			i = close;
			continue;
		}
		const trStart = tableInnerXml.indexOf('<w:tr', i);
		if (trStart < 0) break;
		const trEnd = findRowEnd(tableInnerXml, trStart);
		if (trEnd < 0) break;
		rows.push(tableInnerXml.slice(trStart, trEnd));
		i = trEnd;
	}
	return rows;
}

function findCellEnd(xml: string, start: number): number {
	let i = start + 4;
	let tblDepth = 0;
	while (i < xml.length) {
		if (xml.startsWith('<w:tbl>', i)) {
			tblDepth++;
			i += 7;
			continue;
		}
		if (xml.startsWith('</w:tbl>', i)) {
			tblDepth--;
			i += 8;
			continue;
		}
		if (xml.startsWith('</w:tc>', i) && tblDepth === 0) return i + 7;
		i++;
	}
	return -1;
}

/** Extract only direct child cells of a row, ignoring cells inside nested tables. */
export function extractTopLevelCells(rowXml: string): string[] {
	const cells: string[] = [];
	let i = 0;
	while (i < rowXml.length) {
		if (rowXml.startsWith('<w:tbl>', i)) {
			const close = findBalancedClose(rowXml, i, '<w:tbl>', '</w:tbl>');
			if (close < 0) break;
			i = close;
			continue;
		}
		const tcStart = rowXml.indexOf('<w:tc', i);
		if (tcStart < 0) break;
		const tcEnd = findCellEnd(rowXml, tcStart);
		if (tcEnd < 0) break;
		cells.push(rowXml.slice(tcStart, tcEnd));
		i = tcEnd;
	}
	return cells;
}

function replaceTopLevelCells(rowXml: string, newCells: string[]): string {
	let result = '';
	let i = 0;
	let cellIndex = 0;
	while (i < rowXml.length) {
		if (rowXml.startsWith('<w:tbl>', i)) {
			const close = findBalancedClose(rowXml, i, '<w:tbl>', '</w:tbl>');
			if (close < 0) {
				result += rowXml.slice(i);
				break;
			}
			result += rowXml.slice(i, close);
			i = close;
			continue;
		}
		const tcStart = rowXml.indexOf('<w:tc', i);
		if (tcStart < 0) {
			result += rowXml.slice(i);
			break;
		}
		result += rowXml.slice(i, tcStart);
		const tcEnd = findCellEnd(rowXml, tcStart);
		if (tcEnd < 0) {
			result += rowXml.slice(tcStart);
			break;
		}
		result += newCells[cellIndex++] ?? rowXml.slice(tcStart, tcEnd);
		i = tcEnd;
	}
	return result;
}

function findRowEnd(xml: string, start: number): number {
	let i = start + 4;
	let tblDepth = 0;
	while (i < xml.length) {
		if (xml.startsWith('<w:tbl>', i)) {
			tblDepth++;
			i += 7;
			continue;
		}
		if (xml.startsWith('</w:tbl>', i)) {
			tblDepth--;
			i += 8;
			continue;
		}
		if (xml.startsWith('</w:tr>', i) && tblDepth === 0) return i + 7;
		i++;
	}
	return -1;
}

function findBalancedClose(xml: string, start: number, openTag: string, closeTag: string): number {
	let depth = 0;
	let i = start;
	while (i < xml.length) {
		if (xml.startsWith(openTag, i)) {
			depth++;
			i += openTag.length;
			continue;
		}
		if (xml.startsWith(closeTag, i)) {
			depth--;
			if (depth === 0) return i + closeTag.length;
			i += closeTag.length;
			continue;
		}
		i++;
	}
	return -1;
}

function mapTopLevelRows(
	tableInnerXml: string,
	fn: (rowXml: string, rowIndex: number) => string
): string {
	let result = '';
	let i = 0;
	let rowIndex = 0;
	while (i < tableInnerXml.length) {
		if (tableInnerXml.startsWith('<w:tbl>', i)) {
			const close = findBalancedClose(tableInnerXml, i, '<w:tbl>', '</w:tbl>');
			if (close < 0) {
				result += tableInnerXml.slice(i);
				break;
			}
			result += tableInnerXml.slice(i, close);
			i = close;
			continue;
		}
		const trStart = tableInnerXml.indexOf('<w:tr', i);
		if (trStart < 0) {
			result += tableInnerXml.slice(i);
			break;
		}
		result += tableInnerXml.slice(i, trStart);
		const trEnd = findRowEnd(tableInnerXml, trStart);
		if (trEnd < 0) {
			result += tableInnerXml.slice(trStart);
			break;
		}
		const rowXml = tableInnerXml.slice(trStart, trEnd);
		result += fn(rowXml, rowIndex++);
		i = trEnd;
	}
	return result;
}

export function extractCells(rowXml: string): string[] {
	const cells: string[] = [];
	const re = /<w:tc\b[^>]*>[\s\S]*?<\/w:tc>/g;
	let m: RegExpExecArray | null;
	while ((m = re.exec(rowXml))) cells.push(m[0]);
	return cells;
}

export function cellWidth(cellXml: string): number {
	return +(cellXml.match(/<w:tcW w:w="(\d+)"/)?.[1] ?? 0);
}

export function clearCellText(cellXml: string): string {
	const tcPrMatch = cellXml.match(/<w:tcPr>[\s\S]*?<\/w:tcPr>/);
	const tcPr = tcPrMatch?.[0] ?? '';
	const tcOpen = cellXml.match(/^<w:tc\b[^>]*>/)?.[0] ?? '<w:tc>';
	const pMatch = cellXml.match(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/);
	const pPr = pMatch?.[0].match(/<w:pPr>[\s\S]*?<\/w:pPr>/)?.[0] ?? '';
	const pOpen = pMatch?.[0].match(/^<w:p\b[^>]*>/)?.[0] ?? '<w:p>';
	return `${tcOpen}${tcPr}${pOpen}${pPr}</w:p></w:tc>`;
}

export function setCellCheckmark(cellXml: string, included: boolean): string {
	if (!included) return clearCellText(cellXml);
	const tcPrMatch = cellXml.match(/<w:tcPr>[\s\S]*?<\/w:tcPr>/);
	const tcPr = tcPrMatch?.[0] ?? '';
	const tcOpen = cellXml.match(/^<w:tc\b[^>]*>/)?.[0] ?? '<w:tc>';
	const pMatch = cellXml.match(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/);
	const pPr = pMatch?.[0].match(/<w:pPr>[\s\S]*?<\/w:pPr>/)?.[0] ?? DEFAULT_TICK_PPR;
	const pOpen = pMatch?.[0].match(/^<w:p\b[^>]*>/)?.[0] ?? '<w:p>';
	return `${tcOpen}${tcPr}${pOpen}${pPr}${TICK_RUN}</w:p></w:tc>`;
}

export function replaceRowCells(rowXml: string, newCells: string[]): string {
	const rowOpen = rowXml.match(/^<w:tr\b[^>]*>/)?.[0] ?? '<w:tr>';
	const trPr = rowXml.match(/<w:trPr>[\s\S]*?<\/w:trPr>/)?.[0] ?? '';
	return `${rowOpen}${trPr}${newCells.join('')}</w:tr>`;
}

export function extractParagraphs(blockXml: string): string[] {
	const paragraphs: string[] = [];
	const re = /<w:p\b[^>]*>[\s\S]*?<\/w:p>/g;
	let match: RegExpExecArray | null;
	while ((match = re.exec(blockXml))) paragraphs.push(match[0]);
	return paragraphs;
}

export function setParagraphText(paragraphXml: string, text: string): string {
	const pPrMatch = paragraphXml.match(/<w:pPr>[\s\S]*?<\/w:pPr>/);
	const pPr = pPrMatch?.[0] ?? '';
	const pOpen = paragraphXml.match(/^<w:p\b[^>]*>/)?.[0] ?? '<w:p>';
	const rPrMatch = paragraphXml.match(/<w:rPr>[\s\S]*?<\/w:rPr>/);
	const rPr = rPrMatch?.[0] ?? '';
	const preserve =
		text.includes('  ') || text.startsWith(' ') || text.endsWith(' ') ? ' xml:space="preserve"' : '';
	const run = `<w:r>${rPr}<w:t${preserve}>${escapeXml(text)}</w:t></w:r>`;
	return `${pOpen}${pPr}${run}</w:p>`;
}

/** Rebuild a learning-guide content cell with a bold title paragraph and bullet paragraphs. */
export function setCellLearningGuideContent(
	cellXml: string,
	title: string,
	bullets: string[]
): string {
	const paragraphs = extractParagraphs(cellXml);
	const titleTemplate = paragraphs[0] ?? '<w:p><w:r><w:t></w:t></w:r></w:p>';
	const bulletTemplate =
		paragraphs.find((p) => p.includes('<w:numPr>')) ?? paragraphs[1] ?? titleTemplate;

	const tcPrMatch = cellXml.match(/<w:tcPr>[\s\S]*?<\/w:tcPr>/);
	const tcPr = tcPrMatch?.[0] ?? '';
	const tcOpen = cellXml.match(/^<w:tc\b[^>]*>/)?.[0] ?? '<w:tc>';

	const content = [
		setParagraphText(titleTemplate, title),
		...bullets.map((bullet) => setParagraphText(bulletTemplate, bullet))
	].join('');

	return `${tcOpen}${tcPr}${content}</w:tc>`;
}

export function setCellText(cellXml: string, text: string): string {
	if (!text) return clearCellText(cellXml);

	const lines = text.split(/\r?\n/);
	if (lines.length <= 1) {
		const value = lines[0] ?? '';
		const hasText = [...cellXml.matchAll(/<w:t[^>]*>[^<]*<\/w:t>/g)];
		if (hasText.length === 0) {
			return cellXml.replace(
				/(<w:tc\b[^>]*>(?:<w:tcPr>[\s\S]*?<\/w:tcPr>)?)([\s\S]*)(<\/w:tc>)/,
				`$1<w:p><w:r><w:t${value.includes('  ') ? ' xml:space="preserve"' : ''}>${escapeXml(value)}</w:t></w:r></w:p>$3`
			);
		}
		let first = true;
		return cellXml.replace(/<w:t([^>]*)>[^<]*<\/w:t>/g, (_match, attrs: string) => {
			if (first) {
				first = false;
				const preserve =
					value.includes('  ') || value.startsWith(' ') || value.endsWith(' ')
						? ' xml:space="preserve"'
						: '';
				return `<w:t${preserve}>${escapeXml(value)}</w:t>`;
			}
			return `<w:t${attrs}></w:t>`;
		});
	}

	const tcPrMatch = cellXml.match(/<w:tcPr>[\s\S]*?<\/w:tcPr>/);
	const tcPr = tcPrMatch?.[0] ?? '';
	const tcOpen = cellXml.match(/^<w:tc\b[^>]*>/)?.[0] ?? '<w:tc>';
	const paragraphs = lines
		.map((line) => {
			const preserve =
				line.includes('  ') || line.startsWith(' ') ? ' xml:space="preserve"' : '';
			return `<w:p><w:r><w:t${preserve}>${escapeXml(line)}</w:t></w:r></w:p>`;
		})
		.join('');
	return `${tcOpen}${tcPr}${paragraphs}</w:tc>`;
}

export function setRowCells(rowXml: string, values: string[]): string {
	const cells = extractCells(rowXml);
	const updated = cells.map((cell, i) => {
		const value = values[i] ?? '';
		if (value === TICK_SENTINEL) return setCellCheckmark(cell, true);
		return setCellText(cell, value);
	});
	return replaceRowCells(rowXml, updated);
}

export function ensureFixedTableLayout(tblPr: string): string {
	if (!tblPr || tblPr.includes('w:tblLayout')) return tblPr;
	return tblPr.replace('</w:tblPr>', '<w:tblLayout w:type="fixed"/></w:tblPr>');
}

const BORDER_COLOR = 'A8A8A8';
const TC_PR_CLOSE = '</w:tcPr>';

function borderSideXml(side: string, val: string, sz = '2'): string {
	if (val === 'nil') return `<w:${side} w:val="nil"/>`;
	return `<w:${side} w:val="${val}" w:sz="${sz}" w:space="0" w:color="${BORDER_COLOR}"/>`;
}

const TABLE_BORDER_SIDES = ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'] as const;
const TABLE_BORDER_SIZES: Record<(typeof TABLE_BORDER_SIDES)[number], string> = {
	top: '4',
	left: '4',
	bottom: '4',
	right: '4',
	insideH: '4',
	insideV: '2'
};

const FULL_TBL_BORDERS = `<w:tblBorders>${TABLE_BORDER_SIDES.map((side) =>
	borderSideXml(side, 'single', TABLE_BORDER_SIZES[side])
).join('')}</w:tblBorders>`;

/** Set or replace one side on a table cell's tcBorders. */
export function setCellBorderSide(cellXml: string, side: string, val: string, sz = '2'): string {
	const sideXml = borderSideXml(side, val, sz);
	if (cellXml.includes('<w:tcBorders>')) {
		const bordersMatch = cellXml.match(/<w:tcBorders>[\s\S]*?<\/w:tcBorders>/)?.[0] ?? '';
		const sideRe = new RegExp(`<w:${side}\\b[^/]*/>`);
		const borders = sideRe.test(bordersMatch)
			? bordersMatch.replace(sideRe, sideXml)
			: bordersMatch.replace('</w:tcBorders>', `${sideXml}</w:tcBorders>`);
		return cellXml.replace(/<w:tcBorders>[\s\S]*?<\/w:tcBorders>/, borders);
	}
	const tcPrEnd = cellXml.indexOf(TC_PR_CLOSE);
	if (tcPrEnd >= 0) {
		const after = tcPrEnd + TC_PR_CLOSE.length;
		return `${cellXml.slice(0, after)}<w:tcBorders>${sideXml}</w:tcBorders>${cellXml.slice(after)}`;
	}
	return cellXml.replace(/^(<w:tc\b[^>]*>)/, `$1<w:tcBorders>${sideXml}</w:tcBorders>`);
}

/** Enforce a complete table outline (all four sides) on every edge cell. */
export function ensureFullTableBorders(tableInnerXml: string): string {
	let tblPr = tableInnerXml.match(/<w:tblPr>[\s\S]*?<\/w:tblPr>/)?.[0] ?? '';
	tblPr = tblPr.replace(/<w:tblBorders>[\s\S]*?<\/w:tblBorders>/, '');
	tblPr = tblPr.replace(/w:lastColumn="0"/, 'w:lastColumn="1"');
	tblPr = tblPr.replace(/w:lastRow="0"/, 'w:lastRow="1"');
	if (!tblPr.includes('<w:tblBorders>')) {
		tblPr = tblPr.replace('</w:tblPr>', `${FULL_TBL_BORDERS}</w:tblPr>`);
	}
	tblPr = ensureFixedTableLayout(tblPr);

	const tblGrid = tableInnerXml.match(/<w:tblGrid>[\s\S]*?<\/w:tblGrid>/)?.[0] ?? '';
	const rows = extractRows(tableInnerXml);
	const lastRow = rows.length - 1;

	const updatedRows = rows.map((row, ri) => {
		const cells = extractCells(row);
		const lastCol = cells.length - 1;
		const updatedCells = cells.map((cell, ci) => {
			let c = cell;
			if (ci === 0) c = setCellBorderSide(c, 'left', 'single');
			if (ci === lastCol || ri === 0) c = setCellBorderSide(c, 'right', 'single');
			if (ri === 0) c = setCellBorderSide(c, 'top', 'single', '4');
			if (ri === lastRow) c = setCellBorderSide(c, 'bottom', 'single');
			return c;
		});
		return replaceRowCells(row, updatedCells);
	});

	return `${tblPr}${tblGrid}${updatedRows.join('')}`;
}

/** Word column widths: twentieths of a point per centimetre (1440 twips/in ÷ 2.54 cm/in). */
export const CM_TO_DXA = 567;

export const WRAPPER_COLUMN_WIDTHS_CM = [17.99, 19.44] as const;
export const GEN_CAP_UNIT_COLUMN_WIDTH_CM = 2.04;
export const TEMPLATE_UNIT_COLUMNS = 5;
export const MIN_PLAN_UNITS = 2;
export const MAX_PLAN_UNITS = 8;

export function clampUnitCount(unitCount: number): number {
	return Math.max(MIN_PLAN_UNITS, Math.min(MAX_PLAN_UNITS, unitCount));
}

function parseTblGrid(tableInnerXml: string): number[] {
	const grid = tableInnerXml.match(/<w:tblGrid>[\s\S]*?<\/w:tblGrid>/)?.[0] ?? '';
	return [...grid.matchAll(/w:w="(\d+)"/g)].map((m) => +m[1]);
}

function rowOpenTag(rowXml: string): string {
	return rowXml.match(/^<w:tr\b[^>]*>/)?.[0] ?? '<w:tr>';
}

function clearCellGridSpan(cellXml: string): string {
	return cellXml.replace(/<w:gridSpan w:val="\d+"\s*\/>/g, '');
}

function setCellGridSpan(cellXml: string, span: number): string {
	let cell = clearCellGridSpan(cellXml);
	if (span <= 1) return cell;
	const spanTag = `<w:gridSpan w:val="${span}"/>`;
	const tcPrEnd = cell.indexOf(TC_PR_CLOSE);
	if (tcPrEnd >= 0) {
		const after = tcPrEnd + TC_PR_CLOSE.length;
		return `${cell.slice(0, after)}${spanTag}${cell.slice(after)}`;
	}
	return cell.replace(/^(<w:tc\b[^>]*>)/, `$1<w:tcPr>${spanTag}</w:tcPr>`);
}

function buildCapabilityHeaderRow0(templateRow0: string, unitCount: number): string {
	const cells = extractCells(templateRow0);
	const titleCell = cells[0];
	const unitsSrc =
		cells.find((c) => cellText(c).includes('Units')) ?? cells[3] ?? cells[1];
	const unitsCell = setCellGridSpan(unitsSrc, unitCount);
	return `${rowOpenTag(templateRow0)}${titleCell}${unitsCell}</w:tr>`;
}

function buildCapabilityHeaderRow1(templateRow1: string, unitCount: number): string {
	const cells = extractCells(templateRow1);
	const labelCell = cells[0];
	const unitNumTemplate = cells[1];
	const numCells = Array.from({ length: unitCount }, (_, i) =>
		setCellText(clearCellGridSpan(unitNumTemplate), String(i + 1))
	);
	return `${rowOpenTag(templateRow1)}${labelCell}${numCells.join('')}</w:tr>`;
}

function resizeCapabilityDataRow(
	rowXml: string,
	unitCount: number,
	tickCellTemplate: string
): string {
	const cells = extractCells(rowXml);
	const unitCells = Array.from({ length: unitCount }, (_, i) => cells[1 + i] ?? tickCellTemplate);
	return replaceRowCells(rowXml, [cells[0], ...unitCells]);
}

/** Resize a capability / CCP nested table from the template's 5 unit columns. */
export function resizeCapabilityTableColumns(
	tableInnerXml: string,
	unitCount: number
): string {
	if (unitCount === TEMPLATE_UNIT_COLUMNS) return tableInnerXml;

	const rows = extractRows(tableInnerXml);
	if (rows.length < 2) return tableInnerXml;

	const dataTemplateRow = rows[2] ?? rows[rows.length - 1];
	const dataCells = extractCells(dataTemplateRow);
	const tickCellTemplate = dataCells[1] ?? dataCells[0];

	const newRows = [
		buildCapabilityHeaderRow0(rows[0], unitCount),
		buildCapabilityHeaderRow1(rows[1], unitCount),
		...rows.slice(2).map((row) => resizeCapabilityDataRow(row, unitCount, tickCellTemplate))
	];

	const grid = parseTblGrid(tableInnerXml);
	const nameW = grid[0] ?? 2484;
	const unitW = grid[1] ?? Math.round(GEN_CAP_UNIT_COLUMN_WIDTH_CM * CM_TO_DXA);
	const newWidths = [nameW, ...Array(unitCount).fill(unitW)];

	let tblPr = tableInnerXml.match(/<w:tblPr>[\s\S]*?<\/w:tblPr>/)?.[0] ?? '';
	if (tblPr.includes('<w:tblW')) {
		const total = newWidths.reduce((a, b) => a + b, 0);
		tblPr = tblPr.replace(/<w:tblW w:w="\d+"/, `<w:tblW w:w="${total}"`);
	}
	const newGrid = `<w:tblGrid>${newWidths.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>`;

	const widthAppliedRows = newRows.map((row, ri) => {
		const cells = extractCells(row);
		if (ri === 0 && cells.length === 2) {
			const unitSpanWidth = newWidths.slice(1).reduce((a, b) => a + b, 0);
			return replaceRowCells(row, [
				setCellWidthDxa(cells[0], newWidths[0]),
				setCellWidthDxa(cells[1], unitSpanWidth)
			]);
		}
		const updated = cells.map((cell, ci) => {
			const w = newWidths[ci];
			return w !== undefined ? setCellWidthDxa(cell, w) : cell;
		});
		return replaceRowCells(row, updated);
	});

	return `${tblPr}${newGrid}${widthAppliedRows.join('')}`;
}

function resizeContentDescriptionsDataRow(
	rowXml: string,
	unitCount: number,
	leftTickTemplate: string,
	rightTickTemplate: string
): string {
	const cells = extractCells(rowXml);
	const rightTextIdx = 1 + TEMPLATE_UNIT_COLUMNS;
	const leftText = cells[0];
	const rightText = cells[rightTextIdx] ?? cells[6] ?? cells[0];
	const leftTicks = Array.from(
		{ length: unitCount },
		(_, i) => cells[1 + i] ?? leftTickTemplate
	);
	const rightTicks = Array.from(
		{ length: unitCount },
		(_, i) => cells[rightTextIdx + 1 + i] ?? rightTickTemplate
	);
	return replaceRowCells(rowXml, [leftText, ...leftTicks, rightText, ...rightTicks]);
}

function contentDescriptionColumnWidths(grid: number[], unitCount: number): number[] {
	const tickW = grid[1] ?? 702;
	const templateTextLeft = grid[0];
	const templateTextRight = grid[6] ?? grid[0];
	const templateTotalW = grid.reduce((a, b) => a + b, 0);
	const textSum = templateTextLeft + templateTextRight;
	const tickTotal = tickW * unitCount * 2;

	let leftTextW = templateTextLeft;
	let rightTextW = templateTextRight;

	if (tickTotal + textSum > templateTotalW) {
		const textTotal = templateTotalW - tickTotal;
		const leftShare = textSum > 0 ? templateTextLeft / textSum : 0.5;
		leftTextW = Math.max(2400, Math.round(textTotal * leftShare));
		rightTextW = Math.max(2400, textTotal - leftTextW);
	}

	return [
		leftTextW,
		...Array(unitCount).fill(tickW),
		rightTextW,
		...Array(unitCount).fill(tickW)
	];
}

/** Resize the content-descriptions table from the template's 5 unit columns per side. */
export function resizeContentDescriptionsColumns(
	tableInnerXml: string,
	unitCount: number
): string {
	if (unitCount === TEMPLATE_UNIT_COLUMNS) return tableInnerXml;

	const rows = extractRows(tableInnerXml);
	if (rows.length < 2) return tableInnerXml;

	const r0cells = extractCells(rows[0]);
	const r1cells = extractCells(rows[1]);
	const dataShell = rows[2] ?? rows[rows.length - 1];
	const dataCells = extractCells(dataShell);
	const leftTick = dataCells[1];
	const rightTick = dataCells[7] ?? dataCells[1];

	const newR0 = `${rowOpenTag(rows[0])}${r0cells[0]}${setCellGridSpan(r0cells[1], unitCount)}${r0cells[2]}${setCellGridSpan(r0cells[3], unitCount)}</w:tr>`;

	const leftNums = Array.from({ length: unitCount }, (_, i) =>
		setCellText(r1cells[1], String(i + 1))
	);
	const rightNums = Array.from({ length: unitCount }, (_, i) =>
		setCellText(r1cells[7], String(i + 1))
	);
	const newR1 = `${rowOpenTag(rows[1])}${r1cells[0]}${leftNums.join('')}${r1cells[6]}${rightNums.join('')}</w:tr>`;

	const newRows = [
		newR0,
		newR1,
		...rows.slice(2).map((row) =>
			resizeContentDescriptionsDataRow(row, unitCount, leftTick, rightTick)
		)
	];

	const grid = parseTblGrid(tableInnerXml);
	const newWidths = contentDescriptionColumnWidths(grid, unitCount);

	let tblPr = tableInnerXml.match(/<w:tblPr>[\s\S]*?<\/w:tblPr>/)?.[0] ?? '';
	if (tblPr.includes('<w:tblW')) {
		const total = newWidths.reduce((a, b) => a + b, 0);
		tblPr = tblPr.replace(/<w:tblW w:w="\d+"/, `<w:tblW w:w="${total}"`);
	}
	const newGrid = `<w:tblGrid>${newWidths.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>`;

	const widthAppliedRows = newRows.map((row, ri) => {
		const cells = extractCells(row);
		if (ri === 0 && cells.length === 4) {
			const leftUnitsW = newWidths.slice(1, 1 + unitCount).reduce((a, b) => a + b, 0);
			const rightUnitsW = newWidths.slice(2 + unitCount).reduce((a, b) => a + b, 0);
			return replaceRowCells(row, [
				setCellWidthDxa(cells[0], newWidths[0]),
				setCellWidthDxa(cells[1], leftUnitsW),
				setCellWidthDxa(cells[2], newWidths[1 + unitCount]),
				setCellWidthDxa(cells[3], rightUnitsW)
			]);
		}
		const updated = cells.map((cell, ci) => {
			const w = newWidths[ci];
			return w !== undefined ? setCellWidthDxa(cell, w) : cell;
		});
		return replaceRowCells(row, updated);
	});

	return `${tblPr}${newGrid}${widthAppliedRows.join('')}`;
}

const TEMPLATE_UNIT_BLOCK_COLUMNS = 4;

/** Trim unit overview / assessment tables from 4 unit columns down to unitCount (2–3). */
export function resizeUnitBlockTableColumns(
	tableInnerXml: string,
	unitCount: number
): string {
	if (unitCount >= TEMPLATE_UNIT_BLOCK_COLUMNS || unitCount <= 0) return tableInnerXml;

	const grid = parseTblGrid(tableInnerXml);
	const labelW = grid[0] ?? 3231;
	const templateUnitWidths = grid.slice(1, 1 + TEMPLATE_UNIT_BLOCK_COLUMNS);
	const totalUnitW = templateUnitWidths.reduce((a, b) => a + b, 0);
	const baseUnitW = Math.floor(totalUnitW / unitCount);
	const unitWidths = Array.from({ length: unitCount }, (_, i) =>
		i === unitCount - 1 ? totalUnitW - baseUnitW * (unitCount - 1) : baseUnitW
	);
	const newWidths = [labelW, ...unitWidths];

	const trimmedRows = extractRows(tableInnerXml).map((row) => {
		const cells = extractCells(row).slice(0, 1 + unitCount);
		return replaceRowCells(row, cells);
	});
	const tblPr = tableInnerXml.match(/<w:tblPr>[\s\S]*?<\/w:tblPr>/)?.[0] ?? '';
	return setTableColumnWidths(`${tblPr}${trimmedRows.join('')}`, newWidths);
}

function setCellWidthDxa(cellXml: string, widthDxa: number): string {
	if (cellXml.includes('<w:tcW')) {
		return cellXml.replace(/<w:tcW w:w="\d+"/, `<w:tcW w:w="${widthDxa}"`);
	}
	const tcPrEnd = cellXml.indexOf(TC_PR_CLOSE);
	const widthTag = `<w:tcW w:w="${widthDxa}" w:type="dxa"/>`;
	if (tcPrEnd >= 0) {
		const after = tcPrEnd + TC_PR_CLOSE.length;
		return `${cellXml.slice(0, after)}${widthTag}${cellXml.slice(after)}`;
	}
	return cellXml.replace(/^(<w:tc\b[^>]*>)/, `$1${widthTag}`);
}

/** Set tblGrid and per-cell widths for a table without nested tables. */
export function setTableColumnWidths(tableInnerXml: string, columnWidthsDxa: number[]): string {
	const total = columnWidthsDxa.reduce((a, b) => a + b, 0);
	const newGrid = `<w:tblGrid>${columnWidthsDxa.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>`;

	let tblPr = tableInnerXml.match(/<w:tblPr>[\s\S]*?<\/w:tblPr>/)?.[0] ?? '';
	if (tblPr.includes('<w:tblW')) {
		tblPr = tblPr.replace(/<w:tblW w:w="\d+"/, `<w:tblW w:w="${total}"`);
	}

	const rows = extractRows(tableInnerXml).map((row) => {
		const cells = extractCells(row);
		const updatedCells = cells.map((cell, ci) => {
			const w = columnWidthsDxa[ci];
			return w !== undefined ? setCellWidthDxa(cell, w) : cell;
		});
		return replaceRowCells(row, updatedCells);
	});

	return `${tblPr}${newGrid}${rows.join('')}`;
}

/** Set tblGrid and top-level cell widths for a wrapper table that contains nested tables. */
export function setTopLevelTableColumnWidths(
	tableInnerXml: string,
	columnWidthsDxa: number[]
): string {
	const total = columnWidthsDxa.reduce((a, b) => a + b, 0);
	const newGrid = `<w:tblGrid>${columnWidthsDxa.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>`;

	let tblPr = tableInnerXml.match(/<w:tblPr>[\s\S]*?<\/w:tblPr>/)?.[0] ?? '';
	if (tblPr.includes('<w:tblW')) {
		tblPr = tblPr.replace(/<w:tblW w:w="\d+"/, `<w:tblW w:w="${total}"`);
	}

	const body = tableInnerXml
		.replace(/<w:tblPr>[\s\S]*?<\/w:tblPr>/, '')
		.replace(/<w:tblGrid>[\s\S]*?<\/w:tblGrid>/, '');

	const updatedBody = mapTopLevelRows(body, (rowXml) => {
		const cells = extractTopLevelCells(rowXml).map((cell, ci) => {
			const w = columnWidthsDxa[ci];
			return w !== undefined ? setCellWidthDxa(cell, w) : cell;
		});
		return replaceTopLevelCells(rowXml, cells);
	});

	return `${tblPr}${newGrid}${updatedBody}`;
}

/** Remove a leading empty paragraph before nested-table cell content. */
export function removeLeadingEmptyParagraph(cellXml: string): string {
	const tcOpen = cellXml.match(/^<w:tc\b[^>]*>/)?.[0] ?? '';
	const tcPr = cellXml.match(/<w:tcPr>[\s\S]*?<\/w:tcPr>/)?.[0] ?? '';
	const bodyStart = tcOpen.length + tcPr.length;
	const bodyEnd = cellXml.lastIndexOf('</w:tc>');
	if (bodyEnd < bodyStart) return cellXml;

	let body = cellXml.slice(bodyStart, bodyEnd);
	const paraMatch = body.match(/^(\s*<w:p\b[^>]*>[\s\S]*?<\/w:p>)/);
	if (!paraMatch) return cellXml;

	const para = paraMatch[1];
	const text = [...para.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
		.map((m) => m[1])
		.join('');
	if (text.trim()) return cellXml;
	if (para.includes('<w:drawing') || para.includes('<w:pict')) return cellXml;

	body = body.slice(paraMatch[0].length);
	return `${tcOpen}${tcPr}${body}</w:tc>`;
}

/** Fix capability unit columns to a fixed width; column 1 keeps template width. */
export function applyCapabilityUnitColumnWidths(
	tableInnerXml: string,
	unitCount?: number
): string {
	const cols = parseTblGrid(tableInnerXml);
	if (cols.length < 2) return tableInnerXml;

	const units = unitCount ?? cols.length - 1;
	const unitCol = Math.round(GEN_CAP_UNIT_COLUMN_WIDTH_CM * CM_TO_DXA);
	const widths = [cols[0], ...Array(units).fill(unitCol)];
	return setTableColumnWidths(tableInnerXml, widths);
}

/** @deprecated Use applyCapabilityUnitColumnWidths */
export function applyGeneralCapabilitiesColumnWidths(tableInnerXml: string): string {
	return applyCapabilityUnitColumnWidths(tableInnerXml);
}

/** Apply wrapper column widths and strip leading blank paragraphs from host cells. */
export function setWrapperTableLayout(wrapperInnerXml: string): string {
	const widths = WRAPPER_COLUMN_WIDTHS_CM.map((cm) => Math.round(cm * CM_TO_DXA));
	let result = setTopLevelTableColumnWidths(wrapperInnerXml, widths);
	result = mapTopLevelRows(result, (rowXml) => {
		const cells = extractTopLevelCells(rowXml).map((cell) => removeLeadingEmptyParagraph(cell));
		return replaceTopLevelCells(rowXml, cells);
	});
	return result;
}

/** Remove visible borders from the outer wrapper table so nested tables render cleanly. */
export function clearWrapperTableBorders(wrapperInnerXml: string): string {
	const sides = ['top', 'left', 'bottom', 'right'] as const;
	return mapTopLevelRows(wrapperInnerXml, (rowXml) => {
		const cells = extractTopLevelCells(rowXml);
		const updatedCells = cells.map((cell) => {
			let c = cell;
			for (const side of sides) c = setCellBorderSide(c, side, 'nil');
			return c;
		});
		return replaceTopLevelCells(rowXml, updatedCells);
	});
}

export function rebuildTable(tableInnerXml: string, rows: string[]): string {
	let tblPr = tableInnerXml.match(/<w:tblPr>[\s\S]*?<\/w:tblPr>/)?.[0] ?? '';
	tblPr = ensureFixedTableLayout(tblPr);
	const tblGrid = tableInnerXml.match(/<w:tblGrid>[\s\S]*?<\/w:tblGrid>/)?.[0] ?? '';
	return wrapTable(`${tblPr}${tblGrid}${rows.join('')}`);
}

/** Replace nested tables inside a table inner XML, in document order. */
export function replaceNestedTables(
	tableInnerXml: string,
	replacements: string[]
): string {
	let result = tableInnerXml;
	let searchFrom = 0;
	for (const replacement of replacements) {
		const open = result.indexOf('<w:tbl>', searchFrom);
		if (open < 0) break;
		let depth = 0;
		let j = open;
		let end = -1;
		while (j < result.length) {
			const o = result.indexOf('<w:tbl>', j);
			const c = result.indexOf('</w:tbl>', j);
			if (o !== -1 && (c === -1 || o < c)) {
				depth++;
				j = o + 7;
			} else if (c !== -1) {
				depth--;
				if (depth === 0) {
					end = c + 8;
					break;
				}
				j = c + 8;
			} else break;
		}
		if (end < 0) break;
		result = result.slice(0, open) + replacement + result.slice(end);
		searchFrom = open + replacement.length;
	}
	return result;
}

export function replaceNthTextNode(sectionXml: string, index: number, text: string): string {
	let n = -1;
	return sectionXml.replace(/<w:t([^>]*)>[^<]*<\/w:t>/g, (match, attrs: string) => {
		n++;
		if (n !== index) return match;
		const preserve =
			text.includes('  ') || text.startsWith(' ') ? ' xml:space="preserve"' : '';
		return `<w:t${preserve}>${escapeXml(text)}</w:t>`;
	});
}

export function formatWeek(week: number | ''): string {
	if (week === '' || week === null || week === undefined) return '';
	return `Week ${week}`;
}

export function formatAssessmentTitle(number: number | '', title: string): string {
	const n = number === '' ? '' : String(number);
	const t = title.trim();
	if (n && t) return `Assessment ${n} — ${t}`;
	if (t) return t;
	if (n) return `Assessment ${n}`;
	return '';
}

export function formatContentDescription(
	subStrand: string,
	text: string,
	code: string
): string {
	const strand = subStrand.trim();
	const body = text.trim();
	const c = code.trim();
	const prefix = strand ? `${strand}${body}` : body;
	return c ? `${prefix} (${c})` : prefix;
}

export function checkmark(included: boolean): string {
	return included ? TICK_SENTINEL : '';
}

export function extractTopLevelTablesWithSeparators(xml: string): {
	before: string;
	tables: string[];
	between: string[];
	tail: string;
} {
	const tables: string[] = [];
	const gaps: string[] = [];
	let depth = 0;
	let start = -1;
	let lastEnd = 0;
	let i = 0;
	while (i < xml.length) {
		const open = xml.indexOf('<w:tbl>', i);
		const close = xml.indexOf('</w:tbl>', i);
		if (open === -1 && close === -1) break;
		if (open !== -1 && (close === -1 || open < close)) {
			if (depth === 0) {
				gaps.push(xml.slice(lastEnd, open));
				start = open;
			}
			depth++;
			i = open + 7;
		} else {
			depth--;
			if (depth === 0) {
				tables.push(xml.slice(start, close + 8));
				lastEnd = close + 8;
			}
			i = close + 8;
		}
	}
	const tail = xml.slice(lastEnd);
	const before = gaps.shift() ?? '';
	const between = gaps;
	return { before, tables, between, tail };
}

/** Map template table gaps to the exported table count (handles optional overflow unit block). */
export function mapTableSeparators(
	templateBetween: string[],
	hasOverflowBlock: boolean
): string[] {
	const fallback = DEFAULT_TABLE_SEPARATOR;
	const b =
		templateBetween.length >= 5
			? templateBetween
			: [...templateBetween, ...Array(5).fill(fallback)];

	if (!hasOverflowBlock) {
		return [b[0] ?? fallback, b[1] ?? fallback, b[3] ?? fallback, b[4] ?? fallback];
	}

	return [
		b[0] ?? fallback,
		b[1] ?? fallback,
		b[2] ?? fallback,
		b[2] ?? fallback,
		b[3] ?? fallback,
		b[4] ?? fallback
	];
}

export async function loadTemplateDocumentXml(
	templatePath = LEVEL_PLAN_TEMPLATE_PATH
): Promise<{ zip: AdmZip; documentXml: string }> {
	const buf = await fs.readFile(templatePath);
	const zip = new AdmZip(buf);
	const entry = zip.getEntry('word/document.xml');
	if (!entry) throw new Error('Template missing word/document.xml');
	return { zip, documentXml: entry.getData().toString('utf-8') };
}

export function packDocument(zip: AdmZip, documentXml: string): Buffer {
	zip.updateFile('word/document.xml', Buffer.from(documentXml, 'utf-8'));
	return zip.toBuffer();
}

export function splitDocument(xml: string): { before: string; tail: string } {
	const { before, tail } = extractTopLevelTablesWithSeparators(xml);
	return { before, tail };
}

export function joinDocument(
	before: string,
	tables: string[],
	between: string[],
	tail: string
): string {
	let out = before;
	for (let i = 0; i < tables.length; i++) {
		out += tables[i];
		if (i < tables.length - 1) out += between[i] ?? DEFAULT_TABLE_SEPARATOR;
	}
	return out + tail;
}
