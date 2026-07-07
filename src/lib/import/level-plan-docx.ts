import type { LevelPlan, LevelPlanAssessment, LevelPlanUnit } from '$lib/types';
import {
	cellHasCheckmark,
	cellText,
	extractCells,
	extractNestedTables,
	extractRows,
	extractTopLevelTables,
	loadDocumentXml,
	parseAssessmentHeading,
	parseContentDescriptionLine,
	parseWeekValue,
	unwrapTable
} from './docx-read';

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

const KNOWLEDGE_STRAND = 'Knowledge and understanding';
const PROCESSES_STRAND = 'Processes and production skills';

export interface ParsedLevelPlanFields {
	levelDescription: string;
	contextAndCohortConsiderations: string;
	units: Array<{
		unitTitle: string;
		yearLevel: number | '';
		duration: string;
		description: string;
		assessments: Array<{
			assessmentNumber: number | '';
			title: string;
			term: number | '';
			week: number | '';
			description: string;
			technique: string;
			mode: string;
			conditions: string;
			achievementStandard: string;
			moderation: string;
		}>;
	}>;
	contentDescriptions: Array<{
		strand: string;
		subStrand: string;
		text: string;
		code: string;
		unitInclusions: boolean[];
	}>;
	generalCapabilities: Array<{ name: string; unitInclusions: boolean[] }>;
	crossCurriculumPriorities: Array<{ name: string; unitInclusions: boolean[] }>;
}

function countUnitColumns(rows: string[][]): number {
	const header = rows[0] ?? [];
	let count = 0;
	for (let i = 1; i < header.length; i++) {
		if ((header[i] ?? '').trim()) count++;
		else break;
	}
	return Math.max(count, 1);
}

function parseOverviewTable(tableXml: string): ParsedLevelPlanFields['units'] {
	const rows = tableRowValues(tableXml);
	if (rows.length < 4) return [];

	const unitCount = countUnitColumns(rows);
	const titles = rows[0]?.slice(1, 1 + unitCount) ?? [];
	const yearLevels = rows[1]?.slice(1, 1 + unitCount) ?? [];
	const durations = rows[2]?.slice(1, 1 + unitCount) ?? [];
	const descriptions = rows[3]?.slice(1, 1 + unitCount) ?? [];

	return titles.map((title, index) => ({
		unitTitle: title.trim(),
		yearLevel: parseYearLevel(yearLevels[index] ?? ''),
		duration: (durations[index] ?? '').trim(),
		description: (descriptions[index] ?? '').trim(),
		assessments: []
	}));
}

function parseYearLevel(text: string): number | '' {
	const trimmed = text.trim();
	if (!trimmed) return '';
	const num = Number(trimmed);
	return Number.isFinite(num) ? num : '';
}

function parseTermValue(text: string): number | '' {
	const trimmed = text.trim();
	if (!trimmed) return '';
	const num = Number(trimmed);
	return Number.isFinite(num) ? num : '';
}

function tableRowValues(tableXml: string): string[][] {
	return extractRows(unwrapTable(tableXml)).map((row) =>
		extractCells(row).map((cell) => cellText(cell))
	);
}

function parseAssessmentBlockTable(
	tableXml: string,
	units: ParsedLevelPlanFields['units']
): ParsedLevelPlanFields['units'] {
	const rows = tableRowValues(tableXml);
	if (rows.length < 2) return units;

	const unitCount = countUnitColumns(rows);
	const slice = units.slice(0, unitCount);
	let rowIndex = 1;

	while (rowIndex < rows.length) {
		const titleCells = rows[rowIndex]?.slice(1, 1 + unitCount) ?? [];
		const hasAssessment = titleCells.some((cell) => cell.trim());
		if (!hasAssessment) break;

		for (let unitIndex = 0; unitIndex < unitCount; unitIndex++) {
			const heading = parseAssessmentHeading(titleCells[unitIndex] ?? '');
			const fields: Record<(typeof ASSESSMENT_FIELDS)[number], string> = {
				Term: '',
				Week: '',
				Description: '',
				Technique: '',
				Mode: '',
				Conditions: '',
				'Achievement standard': '',
				Moderation: ''
			};

			for (let fi = 0; fi < ASSESSMENT_FIELDS.length; fi++) {
				const field = ASSESSMENT_FIELDS[fi];
				fields[field] = rows[rowIndex + 1 + fi]?.[1 + unitIndex]?.trim() ?? '';
			}

			if (!slice[unitIndex]) continue;
			slice[unitIndex].assessments.push({
				assessmentNumber: heading.number,
				title: heading.title,
				term: parseTermValue(fields.Term),
				week: parseWeekValue(fields.Week),
				description: fields.Description,
				technique: fields.Technique,
				mode: fields.Mode,
				conditions: fields.Conditions,
				achievementStandard: fields['Achievement standard'],
				moderation: fields.Moderation
			});
		}

		rowIndex += 1 + ASSESSMENT_FIELDS.length;
	}

	return slice;
}

function parseContentDescriptionsTable(
	tableXml: string,
	unitCount: number
): ParsedLevelPlanFields['contentDescriptions'] {
	const rows = extractRows(unwrapTable(tableXml));
	const dataRows = rows.slice(2);
	const results: ParsedLevelPlanFields['contentDescriptions'] = [];

	for (const row of dataRows) {
		const cells = extractCells(row);
		if (cells.length < 2 + unitCount * 2) continue;

		const leftText = cellText(cells[0]);
		const leftTicks = cells.slice(1, 1 + unitCount).map((cell) => cellHasCheckmark(cell));
		const rightTextIdx = 1 + unitCount;
		const rightText = cellText(cells[rightTextIdx]);
		const rightTicks = cells
			.slice(rightTextIdx + 1, rightTextIdx + 1 + unitCount)
			.map((cell) => cellHasCheckmark(cell));

		if (leftText.trim()) {
			const parsed = parseContentDescriptionLine(leftText);
			results.push({
				strand: KNOWLEDGE_STRAND,
				subStrand: parsed.subStrand,
				text: parsed.text,
				code: parsed.code,
				unitInclusions: leftTicks
			});
		}

		if (rightText.trim()) {
			const parsed = parseContentDescriptionLine(rightText);
			results.push({
				strand: PROCESSES_STRAND,
				subStrand: parsed.subStrand,
				text: parsed.text,
				code: parsed.code,
				unitInclusions: rightTicks
			});
		}
	}

	return results;
}

function parseCapabilityNestedTable(tableXml: string, unitCount: number): Array<{
	name: string;
	unitInclusions: boolean[];
}> {
	const rows = extractRows(unwrapTable(tableXml));
	const dataRows = rows.slice(2);
	return dataRows
		.map((row) => {
			const cells = extractCells(row);
			const name = cellText(cells[0]).trim();
			const ticks = cells.slice(1, 1 + unitCount).map((cell) => cellHasCheckmark(cell));
			return { name, unitInclusions: ticks };
		})
		.filter((row) => row.name);
}

function parseCapabilitiesWrapper(tableXml: string, unitCount: number): {
	generalCapabilities: ParsedLevelPlanFields['generalCapabilities'];
	crossCurriculumPriorities: ParsedLevelPlanFields['crossCurriculumPriorities'];
} {
	const nested = extractNestedTables(unwrapTable(tableXml));
	return {
		generalCapabilities: nested[0]
			? parseCapabilityNestedTable(nested[0], unitCount)
			: [],
		crossCurriculumPriorities: nested[1]
			? parseCapabilityNestedTable(nested[1], unitCount)
			: []
	};
}

function resolveTableLayout(tableCount: number): {
	hasOverflow: boolean;
	contentIdx: number;
	capabilitiesIdx: number;
} {
	if (tableCount === 5) {
		return { hasOverflow: false, contentIdx: 3, capabilitiesIdx: 4 };
	}
	if (tableCount === 7) {
		return { hasOverflow: true, contentIdx: 5, capabilitiesIdx: 6 };
	}
	throw new Error(
		`Unexpected level plan layout (${tableCount} tables). Re-export from the app and try again.`
	);
}

export function parseLevelPlanDocx(buffer: Buffer): ParsedLevelPlanFields {
	const documentXml = loadDocumentXml(buffer);
	const tables = extractTopLevelTables(documentXml);
	const layout = resolveTableLayout(tables.length);

	const descRows = tableRowValues(tables[0]);
	const primaryUnits = parseOverviewTable(tables[1]);
	const primaryWithAssessments = parseAssessmentBlockTable(tables[2], primaryUnits);

	let units = primaryWithAssessments;
	if (layout.hasOverflow) {
		const overflowUnits = parseOverviewTable(tables[3]);
		const overflowWithAssessments = parseAssessmentBlockTable(tables[4], overflowUnits);
		units = [...primaryWithAssessments, ...overflowWithAssessments];
	}

	const unitCount = units.length;
	const contentDescriptions = parseContentDescriptionsTable(tables[layout.contentIdx], unitCount);
	const capabilities = parseCapabilitiesWrapper(tables[layout.capabilitiesIdx], unitCount);

	return {
		levelDescription: descRows[1]?.[0]?.trim() ?? '',
		contextAndCohortConsiderations: descRows[1]?.[1]?.trim() ?? '',
		units,
		contentDescriptions,
		generalCapabilities: capabilities.generalCapabilities,
		crossCurriculumPriorities: capabilities.crossCurriculumPriorities
	};
}

export function mergeParsedLevelPlan(existing: LevelPlan, parsed: ParsedLevelPlanFields): LevelPlan {
	const plan: LevelPlan = structuredClone(existing);

	if (parsed.levelDescription) plan.levelDescription.value = parsed.levelDescription;
	if (parsed.contextAndCohortConsiderations) {
		plan.contextAndCohortConsiderations.value = parsed.contextAndCohortConsiderations;
	}

	plan.units = mergeUnits(plan.units, parsed.units);
	plan.contentDescriptions = mergeContentDescriptions(
		plan.contentDescriptions,
		parsed.contentDescriptions
	);
	plan.generalCapabilities = mergeCapabilityRows(
		plan.generalCapabilities,
		parsed.generalCapabilities
	);
	plan.crossCurriculumPriorities = mergeCapabilityRows(
		plan.crossCurriculumPriorities,
		parsed.crossCurriculumPriorities
	);

	return plan;
}

function mergeUnits(
	existing: LevelPlanUnit[],
	parsed: ParsedLevelPlanFields['units']
): LevelPlanUnit[] {
	const count = Math.min(existing.length, parsed.length);
	const units = existing.slice(0, count);

	return units.map((unit, index) => {
		const row = parsed[index];
		if (!row) return unit;
		return {
			...unit,
			unitTitle: { ...unit.unitTitle, value: row.unitTitle || unit.unitTitle.value },
			yearLevel: { ...unit.yearLevel, value: row.yearLevel },
			duration: { ...unit.duration, value: row.duration || unit.duration.value },
			description: { ...unit.description, value: row.description || unit.description.value },
			assessments: mergeLevelAssessments(unit.assessments, row.assessments)
		};
	});
}

function mergeLevelAssessments(
	existing: LevelPlanAssessment[],
	parsed: ParsedLevelPlanFields['units'][number]['assessments']
): LevelPlanAssessment[] {
	if (parsed.length === 0) return existing;

	return existing.map((base, index) => {
		const row = parsed[index];
		if (!row) return base;
		return {
			...base,
			assessmentNumber: { ...base.assessmentNumber, value: row.assessmentNumber },
			title: { ...base.title, value: row.title },
			term: { ...base.term, value: row.term },
			week: { ...base.week, value: row.week },
			description: { ...base.description, value: row.description },
			technique: {
				...base.technique,
				value: row.technique as LevelPlanAssessment['technique']['value']
			},
			mode: { ...base.mode, value: row.mode as LevelPlanAssessment['mode']['value'] },
			conditions: { ...base.conditions, value: row.conditions },
			achievementStandard: { ...base.achievementStandard, value: row.achievementStandard },
			moderation: { ...base.moderation, value: row.moderation }
		};
	});
}

function mergeContentDescriptions(
	existing: LevelPlan['contentDescriptions'],
	parsed: ParsedLevelPlanFields['contentDescriptions']
): LevelPlan['contentDescriptions'] {
	const byCode = new Map(
		parsed
			.filter((row) => row.code.trim())
			.map((row) => [row.code.trim(), row] as const)
	);

	return existing.map((row) => {
		const code = String(row.code.value).trim();
		const imported = code ? byCode.get(code) : undefined;
		if (!imported) return row;
		return {
			...row,
			strand: { ...row.strand, value: imported.strand || row.strand.value },
			subStrand: { ...row.subStrand, value: imported.subStrand || row.subStrand.value },
			text: { ...row.text, value: imported.text || row.text.value },
			unitInclusions: imported.unitInclusions.map((tick, index) =>
				imported.unitInclusions[index] !== undefined ? tick : row.unitInclusions[index] ?? false
			)
		};
	});
}

function mergeCapabilityRows(
	existing: LevelPlan['generalCapabilities'],
	parsed: ParsedLevelPlanFields['generalCapabilities']
): LevelPlan['generalCapabilities'] {
	const byName = new Map(parsed.map((row) => [row.name, row] as const));
	return existing.map((row) => {
		const imported = byName.get(row.name.value);
		if (!imported) return row;
		const unitInclusions = row.unitInclusions.map((current, index) =>
			imported.unitInclusions[index] !== undefined ? imported.unitInclusions[index] : current
		);
		return { ...row, unitInclusions };
	});
}
