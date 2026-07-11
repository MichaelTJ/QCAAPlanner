import {
	Document,
	HeadingLevel,
	Packer,
	Paragraph,
	TextRun
} from 'docx';
import {
	resolveDigiTechBand,
	resolveTemplateKind,
	type DigiTechBand
} from '$lib/assessment/digitech-instruments';
import type { AssessmentCriteriaRow, AssessmentItem } from '$lib/types';
import {
	ASSESSMENT_TEMPLATE_PATHS,
	cellText,
	escapeXml,
	extractCells,
	extractRows,
	extractTopLevelTables,
	extractTopLevelTablesWithSeparators,
	joinDocument,
	loadTemplateDocumentXml,
	packDocument,
	rebuildTable,
	replaceRowCells,
	setCellText,
	unwrapTable
} from './docx-xml';

function field(value: unknown): string {
	if (value == null) return '';
	return String(value);
}

function setLabeledValueRow(rowXml: string, value: string, valueCellIndex = 1): string {
	const cells = extractCells(rowXml);
	if (cells.length <= valueCellIndex) return rowXml;
	const updated = [...cells];
	updated[valueCellIndex] = setCellText(cells[valueCellIndex], value);
	return replaceRowCells(rowXml, updated);
}

function stripVMerge(tcPr: string): string {
	return tcPr
		.replace(/<w:vMerge\b[^/]*\/>/g, '')
		.replace(/<w:vMerge\b[^>]*>[\s\S]*?<\/w:vMerge>/g, '');
}

function withVMerge(tcPr: string, kind: 'restart' | 'continue'): string {
	const cleaned = stripVMerge(tcPr);
	const tag = kind === 'restart' ? '<w:vMerge w:val="restart"/>' : '<w:vMerge/>';
	if (cleaned.includes('</w:tcPr>')) {
		return cleaned.replace('</w:tcPr>', `${tag}</w:tcPr>`);
	}
	return `<w:tcPr>${tag}</w:tcPr>`;
}

/** Build a clean Arial/black cell, preserving width/borders from a template cell. */
function makePlainCell(
	templateCell: string,
	text: string,
	options?: {
		bold?: boolean;
		vMerge?: 'restart' | 'continue' | null;
		vertical?: boolean;
	}
): string {
	const tcOpen = templateCell.match(/^<w:tc\b[^>]*>/)?.[0] ?? '<w:tc>';
	let tcPr = templateCell.match(/<w:tcPr>[\s\S]*?<\/w:tcPr>/)?.[0] ?? '<w:tcPr></w:tcPr>';
	tcPr = stripVMerge(tcPr);
	if (options?.vMerge) tcPr = withVMerge(tcPr, options.vMerge);
	if (options?.vertical) {
		if (!/textDirection/.test(tcPr)) {
			tcPr = tcPr.replace('</w:tcPr>', '<w:textDirection w:val="btLr"/></w:tcPr>');
		}
		tcPr = tcPr
			.replace(/<w:vAlign\b[^/]*\/>/g, '')
			.replace(/<w:vAlign\b[^>]*>[\s\S]*?<\/w:vAlign>/g, '');
		tcPr = tcPr.replace('</w:tcPr>', '<w:vAlign w:val="center"/></w:tcPr>');
	}

	const bold = options?.bold ? '<w:b/>' : '';
	const preserve =
		text.includes('  ') || text.startsWith(' ') || text.endsWith(' ')
			? ' xml:space="preserve"'
			: '';
	// For btLr labels, paragraph center aligns the text along the cell height (vertical centering).
	const jc = options?.vertical ? '<w:jc w:val="center"/>' : '';
	const paragraph = `<w:p><w:pPr><w:pStyle w:val="Tabletext"/><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/>${jc}<w:suppressAutoHyphens/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/><w:color w:val="000000"/><w:sz w:val="20"/>${bold}</w:rPr><w:t${preserve}>${escapeXml(text)}</w:t></w:r></w:p>`;
	return `${tcOpen}${tcPr}${paragraph}</w:tc>`;
}

function forceBlackInXml(xml: string): string {
	return xml
		.replace(/<w:color\b[^/]*\/>/g, '<w:color w:val="000000"/>')
		.replace(/<w:color\b[^>]*>\s*<\/w:color>/g, '<w:color w:val="000000"/>');
}

function forceArial10InXml(xml: string): string {
	return xml
		.replace(
			/<w:rFonts\b[^/]*\/>/g,
			'<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="Arial" w:cs="Arial"/>'
		)
		.replace(/<w:sz\b[^/]*\/>/g, '<w:sz w:val="20"/>')
		.replace(/<w:szCs\b[^/]*\/>/g, '<w:szCs w:val="20"/>');
}

/** Remove template authoring notes even when the text is split across runs. */
function stripAuthoringNotes(xml: string): string {
	return xml.replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g, (para) => {
		const text = [...para.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
			.map((m) => m[1])
			.join('')
			.replace(/\s+/g, ' ');
		if (/when deleting a criteria/i.test(text)) return '';
		return para;
	});
}

function applyExportDefaults(documentXml: string): string {
	return forceArial10InXml(forceBlackInXml(stripAuthoringNotes(documentXml)));
}

function findRubricTableIndex(tables: string[]): number {
	return tables.findIndex((table) => {
		const rows = extractRows(unwrapTable(table));
		const preview = rows
			.slice(0, 3)
			.map((row) => extractCells(row).map(cellText).join(' '))
			.join(' ');
		return /folio of student work/i.test(preview);
	});
}

function rebuildContentDescriptionsTable(tableXml: string, item: AssessmentItem): string {
	const inner = unwrapTable(tableXml);
	const rows = extractRows(inner);
	if (!rows.length) return tableXml;

	const headerCells = extractCells(rows[0]);
	const dataTemplate = extractCells(rows[1] ?? rows[0])[0] ?? headerCells[0];
	const headerCell = makePlainCell(headerCells[0] ?? dataTemplate, 'Content Descriptions', {
		bold: true
	});
	const headerRow = replaceRowCells(rows[0], [headerCell]);

	const selected = item.contentDescriptions.filter((cd) => cd.selected);
	const dataRows = selected.map((cd) => {
		const text = `${field(cd.text.value)} (${field(cd.code.value)})`;
		const cell = makePlainCell(dataTemplate, text);
		const templateRow = rows[1] ?? rows[0];
		return replaceRowCells(templateRow, [cell]);
	});

	return rebuildTable(inner, [headerRow, ...dataRows]);
}

function rebuildCheckpointsTable(tableXml: string, item: AssessmentItem): string {
	const inner = unwrapTable(tableXml);
	const rows = extractRows(inner);
	if (!rows.length) return tableXml;

	const headerCells = extractCells(rows[0]);
	const dataTemplateRow = rows[1] ?? rows[0];
	const dataTemplateCell = extractCells(dataTemplateRow)[0] ?? headerCells[0];

	const rebuilt = [
		replaceRowCells(rows[0], [
			makePlainCell(headerCells[0] ?? dataTemplateCell, 'Checkpoints', { bold: true })
		])
	];

	for (const cp of item.checkpoints) {
		if (!cp.checked && !field(cp.week.value) && !field(cp.action.value)) continue;
		const mark = cp.checked ? '[x]' : '[ ]';
		const week = field(cp.week.value) || 'n';
		const action = field(cp.action.value) || 'Action';
		const text = `${mark} ${cp.label}  Week: ${week} – ${action}`;
		rebuilt.push(replaceRowCells(dataTemplateRow, [makePlainCell(dataTemplateCell, text)]));
	}

	return rebuildTable(inner, rebuilt);
}

/** Template continue-merge rows often omit trHeight; copy from the nearest prior sized row. */
function withTemplateRowHeight(rowXml: string, templateDataRows: string[], index: number): string {
	if (/<w:trHeight\b/.test(rowXml)) return rowXml;
	for (let i = index - 1; i >= 0; i--) {
		const trPr = templateDataRows[i].match(/<w:trPr>[\s\S]*?<\/w:trPr>/)?.[0];
		const height = trPr?.match(/<w:trHeight\b[^/]*\/>/)?.[0]
			?? trPr?.match(/<w:trHeight\b[^>]*>[\s\S]*?<\/w:trHeight>/)?.[0];
		if (!height) continue;
		const cantSplit = /<w:cantSplit\b/.test(trPr ?? '') ? '<w:cantSplit/>' : '';
		const rowOpen = rowXml.match(/^<w:tr\b[^>]*>/)?.[0] ?? '<w:tr>';
		let body = rowXml.replace(/^<w:tr\b[^>]*>/, '').replace(/<\/w:tr>$/, '');
		body = body.replace(/<w:trPr>[\s\S]*?<\/w:trPr>/, '');
		return `${rowOpen}<w:trPr>${cantSplit}${height}</w:trPr>${body}</w:tr>`;
	}
	return rowXml;
}

function rebuildRubricTable(tableXml: string, criteriaRows: AssessmentCriteriaRow[]): string {
	const inner = unwrapTable(tableXml);
	const rows = extractRows(inner);
	if (rows.length < 3) return tableXml;

	const header0 = rows[0];
	const header1 = rows[1];
	const templateDataRows = rows.slice(2);

	// Pair each criteria row with its matching template row so native trHeight/spacing stay intact.
	const enabled = criteriaRows
		.map((row, index) => ({
			row,
			templateRow: templateDataRows[index],
			index
		}))
		.filter((item) => item.row.enabled && item.templateRow);

	const dataRows = enabled.map((item, enabledIndex) => {
		const prev = enabled[enabledIndex - 1];
		const next = enabled[enabledIndex + 1];
		const categoryMerge =
			prev && prev.row.category === item.row.category
				? 'continue'
				: next && next.row.category === item.row.category
					? 'restart'
					: null;
		const strandMerge =
			prev && prev.row.category === item.row.category && prev.row.strand === item.row.strand
				? 'continue'
				: next && next.row.category === item.row.category && next.row.strand === item.row.strand
					? 'restart'
					: null;

		const cells = extractCells(item.templateRow);
		while (cells.length < 7) {
			cells.push(cells[cells.length - 1] ?? '<w:tc><w:tcPr></w:tcPr><w:p/></w:tc>');
		}

		const newCells = [
			makePlainCell(cells[0], categoryMerge === 'continue' ? '' : item.row.category, {
				bold: true,
				vMerge: categoryMerge,
				vertical: true
			}),
			makePlainCell(cells[1], strandMerge === 'continue' ? '' : item.row.strand, {
				bold: true,
				vMerge: strandMerge,
				vertical: true
			}),
			makePlainCell(cells[2], item.row.descriptors.A),
			makePlainCell(cells[3], item.row.descriptors.B),
			makePlainCell(cells[4], item.row.descriptors.C),
			makePlainCell(cells[5], item.row.descriptors.D),
			makePlainCell(cells[6], item.row.descriptors.E)
		];

		// Keeps this template row's trPr (row height / spacing from AssessmentTemplates).
		let rebuilt = replaceRowCells(item.templateRow, newCells);
		// If this was a template continue-row (no height) but is now a visible restart, borrow height.
		if (categoryMerge !== 'continue') {
			rebuilt = withTemplateRowHeight(rebuilt, templateDataRows, item.index);
		}
		return rebuilt;
	});

	return rebuildTable(inner, [forceBlackInXml(header0), forceBlackInXml(header1), ...dataRows]);
}

/** Exam conditions table embeds assessment objectives — keep preamble, rebuild selected CDs in black. */
function rebuildExamObjectivesInConditionsTable(
	tableXml: string,
	item: AssessmentItem
): string {
	const inner = unwrapTable(tableXml);
	const rows = extractRows(inner);
	const selected = item.contentDescriptions.filter((cd) => cd.selected);
	const rebuilt: string[] = [];
	let objectivesHeaderIndex = -1;

	for (let i = 0; i < rows.length; i++) {
		const text = extractCells(rows[i]).map(cellText).join(' ');
		if (/assessment objective/i.test(text)) {
			objectivesHeaderIndex = i;
			rebuilt.push(forceBlackInXml(rows[i]));
			break;
		}
		const cells = extractCells(rows[i]);
		if (i === 1 && cells.length >= 4) {
			rebuilt.push(
				replaceRowCells(rows[i], [
					cells[0],
					setCellText(cells[1], field(item.examTimeMinutes.value) || 'minutes'),
					cells[2],
					setCellText(cells[3], field(item.perusalMinutes.value) || 'minutes')
				])
			);
			continue;
		}
		if (i === 2 && cells.length >= 2) {
			rebuilt.push(
				replaceRowCells(rows[i], [
					cells[0],
					setCellText(cells[1], field(item.conditionsOther.value) || field(item.conditions.value))
				])
			);
			continue;
		}
		if (i === 4 && cells.length >= 1) {
			rebuilt.push(replaceRowCells(rows[i], [setCellText(cells[0], field(item.instructions.value))]));
			continue;
		}
		rebuilt.push(rows[i]);
	}

	if (objectivesHeaderIndex < 0) return rebuildTable(inner, rebuilt);

	const objectiveTemplate =
		extractCells(rows[objectivesHeaderIndex + 1] ?? rows[objectivesHeaderIndex])[0] ??
		extractCells(rows[objectivesHeaderIndex])[0];
	const templateRow = rows[objectivesHeaderIndex + 1] ?? rows[objectivesHeaderIndex];

	for (const cd of selected) {
		const text = `${field(cd.text.value)} (${field(cd.code.value)})`;
		rebuilt.push(replaceRowCells(templateRow, [makePlainCell(objectiveTemplate, text)]));
	}

	return rebuildTable(inner, rebuilt);
}

function fillAssignmentMeta(tableXml: string, item: AssessmentItem): string {
	const inner = unwrapTable(tableXml);
	const rows = extractRows(inner).map((row, index) => {
		if (index === 0) return setLabeledValueRow(row, field(item.subject.value));
		if (index === 1) return setLabeledValueRow(row, field(item.technique.value));
		if (index === 2) {
			const cells = extractCells(row);
			if (cells.length >= 4) {
				return replaceRowCells(row, [
					cells[0],
					setCellText(cells[1], field(item.unitTitle.value)),
					cells[2],
					setCellText(cells[3], field(item.instrumentNumber.value))
				]);
			}
			return setLabeledValueRow(row, field(item.unitTitle.value));
		}
		if (index === 3) return setLabeledValueRow(row, field(item.topics.value) || field(item.title.value));
		return row;
	});
	return rebuildTable(inner, rows);
}

function fillAssignmentConditions(tableXml: string, item: AssessmentItem): string {
	const inner = unwrapTable(tableXml);
	const rows = extractRows(inner).map((row, index) => {
		const cells = extractCells(row);
		if (index === 1 && cells.length >= 2) {
			return replaceRowCells(row, [cells[0], setCellText(cells[1], field(item.duration.value))]);
		}
		if (index === 2 && cells.length >= 4) {
			return replaceRowCells(row, [
				cells[0],
				setCellText(cells[1], field(item.mode.value)),
				cells[2],
				setCellText(cells[3], field(item.length.value))
			]);
		}
		if (index === 3 && cells.length >= 4) {
			return replaceRowCells(row, [
				cells[0],
				setCellText(cells[1], field(item.individualOrGroup.value)),
				cells[2],
				setCellText(cells[3], field(item.conditionsOther.value) || field(item.conditions.value))
			]);
		}
		if (index === 4 && cells.length >= 2) {
			return replaceRowCells(row, [
				cells[0],
				setCellText(cells[1], field(item.resourcesAvailable.value))
			]);
		}
		if (index === 5 && cells.length >= 2) {
			return replaceRowCells(row, [
				cells[0],
				makePlainCell(cells[1], field(item.context.value))
			]);
		}
		if (index === 7 && cells.length >= 1) {
			return replaceRowCells(row, [
				makePlainCell(cells[0], field(item.task.value) || field(item.description.value))
			]);
		}
		return row;
	});
	return rebuildTable(inner, rows);
}

function fillToComplete(tableXml: string, item: AssessmentItem): string {
	const inner = unwrapTable(tableXml);
	const rows = extractRows(inner).map((row, index) => {
		if (index === 1) {
			const cells = extractCells(row);
			if (cells[0]) return replaceRowCells(row, [setCellText(cells[0], field(item.toComplete.value))]);
		}
		return row;
	});
	return rebuildTable(inner, rows);
}

function fillStimulus(tableXml: string, item: AssessmentItem): string {
	const inner = unwrapTable(tableXml);
	const rows = extractRows(inner).map((row, index) => {
		if (index === 1) {
			const cells = extractCells(row);
			if (cells[0]) return replaceRowCells(row, [setCellText(cells[0], field(item.stimulus.value))]);
		}
		return row;
	});
	return rebuildTable(inner, rows);
}

function fillAuthentication(tableXml: string, item: AssessmentItem): string {
	const selected = new Set(
		item.authenticationStrategies.filter((s) => s.selected).map((s) => s.label.trim().toLowerCase())
	);
	const inner = unwrapTable(tableXml);
	const rows = extractRows(inner);
	const kept = rows.filter((row, index) => {
		if (index === 0) return true;
		if (selected.size === 0) return true;
		const text = extractCells(row).map(cellText).join(' ').trim().toLowerCase();
		return [...selected].some(
			(label) => text.includes(label.slice(0, 40)) || label.includes(text.slice(0, 40))
		);
	});
	return rebuildTable(inner, kept.map(forceBlackInXml));
}

function fillScaffolding(tableXml: string, item: AssessmentItem): string {
	const inner = unwrapTable(tableXml);
	const rows = extractRows(inner).map((row, index) => {
		if (index === 1) {
			const cells = extractCells(row);
			if (cells[0]) return replaceRowCells(row, [setCellText(cells[0], field(item.scaffolding.value))]);
		}
		return row;
	});
	return rebuildTable(inner, rows);
}

function fillYearLevelInDetails(tableXml: string, item: AssessmentItem): string {
	const inner = unwrapTable(tableXml);
	const rows = extractRows(inner).map((row, index) => {
		if (index !== 1) return row;
		const cells = extractCells(row);
		if (cells.length >= 2) {
			const yearText = `Year Level: ${field(item.yearLevel.value)}`;
			return replaceRowCells(row, [cells[0], setCellText(cells[1], yearText)]);
		}
		return row;
	});
	return rebuildTable(inner, rows);
}

async function buildFromDigiTechTemplate(
	item: AssessmentItem,
	band: DigiTechBand
): Promise<Buffer> {
	const kind = resolveTemplateKind(String(item.technique.value));
	const templatePath = ASSESSMENT_TEMPLATE_PATHS[band][kind];
	const { zip, documentXml } = await loadTemplateDocumentXml(templatePath);
	const { before, between, tail } = extractTopLevelTablesWithSeparators(documentXml);
	const tables = extractTopLevelTables(documentXml);

	const updated = [...tables];

	if (kind === 'assignment') {
		if (updated[0]) updated[0] = fillYearLevelInDetails(updated[0], item);
		if (updated[1]) updated[1] = fillAssignmentMeta(updated[1], item);
		if (updated[2]) updated[2] = fillAssignmentConditions(updated[2], item);
		if (updated[3]) updated[3] = rebuildContentDescriptionsTable(updated[3], item);
		if (updated[4]) updated[4] = fillToComplete(updated[4], item);
		if (updated[5]) updated[5] = fillStimulus(updated[5], item);
		if (updated[6]) updated[6] = rebuildCheckpointsTable(updated[6], item);
		if (updated[7]) updated[7] = fillAuthentication(updated[7], item);
		if (updated[8]) updated[8] = fillScaffolding(updated[8], item);
		const rubricIdx = findRubricTableIndex(updated);
		if (rubricIdx >= 0) {
			updated[rubricIdx] = rebuildRubricTable(updated[rubricIdx], item.criteriaRows);
		}
	} else {
		if (updated[0]) updated[0] = fillYearLevelInDetails(updated[0], item);
		if (updated[1]) {
			const inner = unwrapTable(updated[1]);
			const rows = extractRows(inner).map((row, index) => {
				if (index === 0) return setLabeledValueRow(row, field(item.subject.value));
				if (index === 1) {
					return setLabeledValueRow(
						row,
						field(item.technique.value) || 'Examination — Short Response'
					);
				}
				if (index === 2) {
					const cells = extractCells(row);
					if (cells.length >= 4) {
						return replaceRowCells(row, [
							cells[0],
							setCellText(cells[1], field(item.unitTitle.value)),
							cells[2],
							setCellText(cells[3], field(item.instrumentNumber.value))
						]);
					}
				}
				if (index === 3) {
					return setLabeledValueRow(row, field(item.topics.value) || field(item.title.value));
				}
				return row;
			});
			updated[1] = rebuildTable(inner, rows);
		}
		if (updated[2]) updated[2] = rebuildExamObjectivesInConditionsTable(updated[2], item);

		for (let sectionIndex = 0; sectionIndex < 3; sectionIndex++) {
			const tableIndex = 5 + sectionIndex;
			const section = item.examSections[sectionIndex];
			if (!updated[tableIndex] || !section) continue;
			const inner = unwrapTable(updated[tableIndex]);
			const rows = extractRows(inner).map((row, rowIndex) => {
				if (rowIndex === 0) return row;
				const q = section.questions[rowIndex - 1];
				if (!q) return row;
				const cells = extractCells(row);
				if (!cells.length) return row;
				const prompt =
					field(q.prompt.value) +
					(q.marks.value !== '' ? ` — ${field(q.marks.value)} marks` : '');
				return replaceRowCells(row, [setCellText(cells[0], prompt), ...cells.slice(1)]);
			});
			updated[tableIndex] = rebuildTable(inner, rows);
		}

		const rubricIdx = findRubricTableIndex(updated);
		if (rubricIdx >= 0) {
			updated[rubricIdx] = rebuildRubricTable(updated[rubricIdx], item.criteriaRows);
		}
	}

	const newXml = applyExportDefaults(joinDocument(before, updated, between, tail));
	const stylesEntry = zip.getEntry('word/styles.xml');
	if (stylesEntry) {
		const stylesXml = applyExportDefaults(stylesEntry.getData().toString('utf-8'));
		zip.updateFile('word/styles.xml', Buffer.from(stylesXml, 'utf-8'));
	}
	return packDocument(zip, newXml);
}

async function buildProgrammaticDocx(item: AssessmentItem): Promise<Buffer> {
	const children: Paragraph[] = [
		new Paragraph({
			text: field(item.title.value) || 'Assessment item',
			heading: HeadingLevel.TITLE
		}),
		new Paragraph({
			children: [
				new TextRun(
					`Year ${field(item.yearLevel.value)} ${field(item.subject.value)} — ${field(item.unitTitle.value)}`
				)
			]
		}),
		new Paragraph({ text: 'Description', heading: HeadingLevel.HEADING_2 }),
		new Paragraph(field(item.description.value)),
		new Paragraph({ text: 'Task', heading: HeadingLevel.HEADING_2 }),
		new Paragraph(field(item.task.value) || field(item.description.value)),
		new Paragraph({
			children: [
				new TextRun(`Technique: ${field(item.technique.value)}   Mode: ${field(item.mode.value)}`)
			]
		}),
		new Paragraph({ text: `Conditions: ${field(item.conditions.value)}` }),
		new Paragraph({ text: 'Content descriptions', heading: HeadingLevel.HEADING_2 })
	];

	for (const cd of item.contentDescriptions.filter((c) => c.selected)) {
		children.push(new Paragraph(`${field(cd.text.value)} (${field(cd.code.value)})`));
	}

	children.push(new Paragraph({ text: 'Marking criteria', heading: HeadingLevel.HEADING_2 }));
	for (const row of item.criteriaRows.filter((r) => r.enabled)) {
		children.push(
			new Paragraph({
				text: `${row.category} — ${row.strand}`,
				heading: HeadingLevel.HEADING_3
			})
		);
		children.push(
			new Paragraph(
				`A: ${row.descriptors.A} | B: ${row.descriptors.B} | C: ${row.descriptors.C} | D: ${row.descriptors.D} | E: ${row.descriptors.E}`
			)
		);
	}

	if (field(item.notes.value)) {
		children.push(new Paragraph({ text: 'Notes', heading: HeadingLevel.HEADING_2 }));
		children.push(new Paragraph(field(item.notes.value)));
	}

	const doc = new Document({ sections: [{ children }] });
	return Packer.toBuffer(doc);
}

export async function buildAssessmentItemDocx(item: AssessmentItem): Promise<Buffer> {
	const band = resolveDigiTechBand(item.yearLevel.value, String(item.subject.value));
	if (band) {
		try {
			return await buildFromDigiTechTemplate(item, band);
		} catch (err) {
			console.warn('DigiTech template export failed; falling back to programmatic docx', err);
		}
	}
	return buildProgrammaticDocx(item);
}
