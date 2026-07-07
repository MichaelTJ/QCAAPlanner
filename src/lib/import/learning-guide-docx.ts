import { createId } from '$lib/defaults';
import type { LearningGuideWeek } from '$lib/learning-guide-data';
import { aiField } from '$lib/types';
import type { UnitPlan } from '$lib/types';
import {
	extractNthTextNode,
	extractParagraphs,
	extractTopLevelCells,
	extractTopLevelRows,
	extractTopLevelTables,
	extractTopLevelTablesWithSeparators,
	loadDocumentXml,
	paragraphText,
	unwrapTable
} from './docx-read';

export interface ParsedLearningGuideFields {
	yearLevel: number | '';
	subject: string;
	term: number | '';
	weeks: LearningGuideWeek[];
	vocabulary: string;
}

function parseLearningGuideHeader(beforeXml: string): Pick<
	ParsedLearningGuideFields,
	'yearLevel' | 'subject' | 'term'
> {
	const yearRaw = extractNthTextNode(beforeXml, 1).trim();
	const subject = extractNthTextNode(beforeXml, 3).trim();
	const termRaw = extractNthTextNode(beforeXml, 5).trim();
	const yearLevel = yearRaw ? Number(yearRaw) : '';
	const term = termRaw ? Number(termRaw) : '';
	return {
		yearLevel: Number.isFinite(yearLevel) ? yearLevel : '',
		subject,
		term: Number.isFinite(term) ? term : ''
	};
}

function parseLearningGuideContentCell(cellXml: string): { title: string; bullets: string[] } {
	const paragraphs = extractParagraphs(cellXml);
	const texts = paragraphs.map((paragraph) => paragraphText(paragraph)).filter((text) => text.trim());
	return {
		title: texts[0]?.trim() ?? '',
		bullets: texts.slice(1).map((text) => text.trim()).filter(Boolean)
	};
}

function parseMainLearningGuideTable(tableXml: string): LearningGuideWeek[] {
	const rows = extractTopLevelRows(unwrapTable(tableXml));
	const dataRows = rows.slice(2);
	return dataRows
		.map((row) => {
			const cells = extractTopLevelCells(row);
			const weekRaw = paragraphText(cells[0] ?? '').trim();
			const week = weekRaw ? Number(weekRaw) : '';
			const content = parseLearningGuideContentCell(cells[1] ?? '');
			if (week === '' && !content.title && content.bullets.length === 0) return null;
			return {
				week: Number.isFinite(week) ? week : '',
				title: content.title,
				bullets: content.bullets
			};
		})
		.filter((week): week is LearningGuideWeek => week !== null);
}

function parseVocabularyTable(tableXml: string): string {
	const rows = extractTopLevelRows(unwrapTable(tableXml));
	const vocabCell = extractTopLevelCells(rows[1] ?? '')[0] ?? '';
	return paragraphText(vocabCell).trim();
}

export function parseLearningGuideDocx(buffer: Buffer): ParsedLearningGuideFields {
	const documentXml = loadDocumentXml(buffer);
	const { before } = extractTopLevelTablesWithSeparators(documentXml);
	const tables = extractTopLevelTables(documentXml);
	if (tables.length < 2) {
		throw new Error('Learning guide document must contain main and vocabulary tables');
	}

	return {
		...parseLearningGuideHeader(before),
		weeks: parseMainLearningGuideTable(tables[0]),
		vocabulary: parseVocabularyTable(tables[1])
	};
}

export function applyLearningGuideToUnitPlan(
	unit: UnitPlan,
	parsed: ParsedLearningGuideFields
): UnitPlan {
	const plan: UnitPlan = structuredClone(unit);
	const byWeek = new Map(plan.teachingSequence.map((week) => [Number(week.week.value), week] as const));

	for (const summary of parsed.weeks) {
		if (summary.week === '') continue;
		let week = byWeek.get(Number(summary.week));
		if (!week) {
			week = {
				id: createId('week'),
				week: { value: summary.week, aiNotes: '' },
				keyTeachingExperiences: aiField(),
				adjustments: aiField(),
				resources: aiField(),
				theory: aiField(),
				prac: aiField(),
				assessment: aiField(),
				outlineTheme: aiField()
			};
			plan.teachingSequence.push(week);
			byWeek.set(Number(summary.week), week);
		}

		if (summary.title) {
			week.outlineTheme = { ...week.outlineTheme ?? aiField(), value: summary.title };
		}
		if (summary.bullets.length) {
			week.theory = { ...week.theory, value: summary.bullets.slice(0, 2).join('\n') };
			week.prac = { ...week.prac, value: summary.bullets.slice(2).join('\n') };
		}
	}

	plan.teachingSequence.sort((a, b) => Number(a.week.value) - Number(b.week.value));
	return plan;
}

export function mergeLearningGuideImport(unit: UnitPlan, parsed: ParsedLearningGuideFields): UnitPlan {
	return applyLearningGuideToUnitPlan(unit, parsed);
}
