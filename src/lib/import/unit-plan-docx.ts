import type {
	AssessmentMode,
	AssessmentTechnique,
	PlanStatus,
	UnitAssessment,
	UnitGeneralCapability,
	UnitPlan,
	TeachingWeek
} from '$lib/types';
import { applyCheckedSubElementsFromText } from '$lib/general-capabilities';
import {
	extractBodyBlocks,
	loadDocumentXml,
	parseAssessmentHeading,
	parseContentDescriptionPair,
	parseLabeledLine,
	tableRowTexts
} from './docx-read';

export interface ParsedUnitPlanFields {
	yearLevel: number | '';
	subject: string;
	unitTitle: string;
	unitNumber: number | '';
	startWeek: string;
	finishWeek: string;
	status: PlanStatus | '';
	unitDescription: string;
	cohortAndClassConsiderations: string;
	assessments: Array<{
		assessmentNumber: number | '';
		title: string;
		description: string;
		technique: AssessmentTechnique | '';
		mode: AssessmentMode | '';
		conditions: string;
		timing: string;
		achievementStandard: string;
		moderation: string;
		contentDescriptions: Array<{
			strand: string;
			subStrand: string;
			text: string;
			code: string;
		}>;
	}>;
	generalCapabilities: Array<{
		name: string;
		subElements: string;
		evidenceNotes: string;
	}>;
	teachingSequence: Array<{
		week: number | '';
		keyTeachingExperiences: string;
		theory: string;
		prac: string;
		assessment: string;
		resources: string;
	}>;
	evaluation: string;
}

function emptyParsed(): ParsedUnitPlanFields {
	return {
		yearLevel: '',
		subject: '',
		unitTitle: '',
		unitNumber: '',
		startWeek: '',
		finishWeek: '',
		status: '',
		unitDescription: '',
		cohortAndClassConsiderations: '',
		assessments: [],
		generalCapabilities: [],
		teachingSequence: [],
		evaluation: ''
	};
}

function parseTitle(text: string): Partial<ParsedUnitPlanFields> {
	const trimmed = text.trim();
	const withYear = trimmed.match(/^Year\s+(\d+)\s+(.+?)\s+[—–-]\s+(.+)$/);
	if (withYear) {
		return {
			yearLevel: Number(withYear[1]),
			subject: withYear[2].trim(),
			unitTitle: withYear[3].trim()
		};
	}

	const withoutYear = trimmed.match(/^Year\s+(.+?)\s+[—–-]\s+(.+)$/);
	if (withoutYear) {
		return {
			yearLevel: '',
			subject: withoutYear[1].trim(),
			unitTitle: withoutYear[2].trim()
		};
	}

	return {};
}

function parseUnitLine(text: string): Partial<ParsedUnitPlanFields> {
	const match = text.match(/^Unit\s+(\d+)\s+(.+?)\s+to\s+(.+)$/i);
	if (!match) return {};
	return {
		unitNumber: Number(match[1]),
		startWeek: match[2].trim(),
		finishWeek: match[3].trim()
	};
}

function parseStatus(text: string): PlanStatus | '' {
	const value = parseLabeledLine(text, 'Status');
	if (!value) return '';
	if (value === 'Draft' || value === 'Draft (Validated)' || value === 'Approved for use') {
		return value;
	}
	return '';
}

function parseTechniqueMode(text: string): { technique: AssessmentTechnique | ''; mode: AssessmentMode | '' } {
	const technique = parseLabeledLine(text, 'Technique') ?? '';
	const mode = parseLabeledLine(text, 'Mode') ?? '';
	const techniques: AssessmentTechnique[] = [
		'Other',
		'Portfolio',
		'Examination',
		'Investigation',
		'Project'
	];
	const modes: AssessmentMode[] = ['Multimodal', 'Written'];
	return {
		technique: techniques.includes(technique as AssessmentTechnique)
			? (technique as AssessmentTechnique)
			: '',
		mode: modes.includes(mode as AssessmentMode) ? (mode as AssessmentMode) : ''
	};
}

function parseTeachingTable(tableXml: string): ParsedUnitPlanFields['teachingSequence'] {
	const rows = tableRowTexts(tableXml);
	if (rows.length < 2) return [];

	return rows.slice(1).map((cells) => {
		const weekRaw = cells[0]?.trim() ?? '';
		const weekNum = weekRaw.match(/^(\d+)$/) ? Number(weekRaw) : '';
		return {
			week: weekNum,
			keyTeachingExperiences: cells[1]?.trim() ?? '',
			theory: cells[2]?.trim() ?? '',
			prac: cells[3]?.trim() ?? '',
			assessment: cells[4]?.trim() ?? '',
			resources: cells[5]?.trim() ?? ''
		};
	});
}

export function parseUnitPlanDocx(buffer: Buffer): ParsedUnitPlanFields {
	const documentXml = loadDocumentXml(buffer);
	const blocks = extractBodyBlocks(documentXml);
	const parsed = emptyParsed();

	let section = '';
	let currentAssessment: ParsedUnitPlanFields['assessments'][number] | null = null;
	let currentCapability: ParsedUnitPlanFields['generalCapabilities'][number] | null = null;
	let capabilityParaIndex = 0;
	let pendingStrandLine = '';
	let bodyBuffer: string[] = [];

	function flushBody() {
		if (!section || bodyBuffer.length === 0) return;
		const text = bodyBuffer.join('\n').trim();
		bodyBuffer = [];
		if (!text) return;

		switch (section) {
			case 'unitDescription':
				parsed.unitDescription = text;
				break;
			case 'cohort':
				parsed.cohortAndClassConsiderations = text;
				break;
			case 'assessmentDescription':
				if (currentAssessment) currentAssessment.description = text;
				break;
			case 'capabilitySub':
				if (currentCapability) currentCapability.subElements = text;
				break;
			case 'capabilityEvidence':
				if (currentCapability) currentCapability.evidenceNotes = text;
				break;
			case 'evaluation':
				parsed.evaluation = text;
				break;
		}
	}

	for (const block of blocks) {
		if (block.type === 'table') {
			flushBody();
			if (section === 'teachingSequence') {
				parsed.teachingSequence = parseTeachingTable(block.xml);
			}
			continue;
		}

		const { style, text } = block;
		const trimmed = text.trim();
		if (!trimmed && style !== 'Heading2' && style !== 'Heading3') continue;

		if (style === 'Title') {
			flushBody();
			Object.assign(parsed, parseTitle(trimmed));
			continue;
		}

		if (!style && !section) {
			const unitLine = parseUnitLine(trimmed);
			if (unitLine.unitNumber !== undefined) {
				Object.assign(parsed, unitLine);
				continue;
			}
			if (trimmed.startsWith('School:')) continue;
			const status = parseStatus(trimmed);
			if (status) {
				parsed.status = status;
				continue;
			}
		}

		if (style === 'Heading2') {
			flushBody();
			section = '';
			currentAssessment = null;
			currentCapability = null;
			capabilityParaIndex = 0;
			pendingStrandLine = '';

			switch (trimmed) {
				case 'Unit description':
					section = 'unitDescription';
					break;
				case 'Cohort and class considerations':
					section = 'cohort';
					break;
				case 'Assessments':
					section = 'assessments';
					break;
				case 'General capabilities':
					section = 'capabilities';
					break;
				case 'Teaching and learning sequence':
					section = 'teachingSequence';
					break;
				case 'Evaluation':
					section = 'evaluation';
					break;
			}
			continue;
		}

		if (style === 'Heading3') {
			flushBody();
			pendingStrandLine = '';

			if (section === 'assessments') {
				if (trimmed === 'Content descriptions') {
					section = 'assessmentContentDescriptions';
					continue;
				}
				const heading = parseAssessmentHeading(trimmed);
				currentAssessment = {
					assessmentNumber: heading.number,
					title: heading.title,
					description: '',
					technique: '',
					mode: '',
					conditions: '',
					timing: '',
					achievementStandard: '',
					moderation: '',
					contentDescriptions: []
				};
				parsed.assessments.push(currentAssessment);
				section = 'assessmentDescription';
				continue;
			}

			if (section === 'capabilities' || section === 'capabilitySub' || section === 'capabilityEvidence') {
				currentCapability = {
					name: trimmed,
					subElements: '',
					evidenceNotes: ''
				};
				parsed.generalCapabilities.push(currentCapability);
				capabilityParaIndex = 0;
				section = 'capabilitySub';
				continue;
			}
		}

		if (section === 'assessmentContentDescriptions' && currentAssessment) {
			if (!pendingStrandLine) {
				pendingStrandLine = trimmed;
			} else {
				currentAssessment.contentDescriptions.push(
					parseContentDescriptionPair(pendingStrandLine, trimmed)
				);
				pendingStrandLine = '';
			}
			continue;
		}

		if (section === 'assessmentDescription' && currentAssessment) {
			const techniqueMode = parseTechniqueMode(trimmed);
			if (techniqueMode.technique || techniqueMode.mode) {
				currentAssessment.technique = techniqueMode.technique;
				currentAssessment.mode = techniqueMode.mode;
				continue;
			}
			const conditions = parseLabeledLine(trimmed, 'Conditions');
			if (conditions !== undefined) {
				currentAssessment.conditions = conditions;
				continue;
			}
			const timing = parseLabeledLine(trimmed, 'Timing');
			if (timing !== undefined) {
				currentAssessment.timing = timing;
				continue;
			}
			const achievement = parseLabeledLine(trimmed, 'Achievement standard');
			if (achievement !== undefined) {
				currentAssessment.achievementStandard = achievement;
				continue;
			}
			const moderation = parseLabeledLine(trimmed, 'Moderation');
			if (moderation !== undefined) {
				currentAssessment.moderation = moderation;
				continue;
			}
		}

		if (section === 'capabilitySub' || section === 'capabilityEvidence') {
			flushBody();
			if (capabilityParaIndex === 0) {
				bodyBuffer = [trimmed];
				section = 'capabilitySub';
				capabilityParaIndex = 1;
			} else {
				bodyBuffer = [trimmed];
				section = 'capabilityEvidence';
				capabilityParaIndex = 2;
			}
			flushBody();
			continue;
		}

		bodyBuffer.push(trimmed);
	}

	flushBody();
	return parsed;
}

export function mergeParsedUnitPlan(existing: UnitPlan, parsed: ParsedUnitPlanFields): UnitPlan {
	const plan: UnitPlan = structuredClone(existing);

	if (parsed.yearLevel !== '') plan.yearLevel.value = parsed.yearLevel;
	if (parsed.subject) plan.subject.value = parsed.subject;
	if (parsed.unitTitle) plan.unitTitle.value = parsed.unitTitle;
	if (parsed.unitNumber !== '') plan.unitNumber.value = parsed.unitNumber;
	if (parsed.startWeek) plan.startWeek.value = parsed.startWeek;
	if (parsed.finishWeek) plan.finishWeek.value = parsed.finishWeek;
	if (parsed.status) plan.status.value = parsed.status;
	if (parsed.unitDescription) plan.unitDescription.value = parsed.unitDescription;
	if (parsed.cohortAndClassConsiderations) {
		plan.cohortAndClassConsiderations.value = parsed.cohortAndClassConsiderations;
	}
	if (parsed.evaluation) plan.evaluation.value = parsed.evaluation;

	plan.assessments = mergeAssessments(plan.assessments, parsed.assessments);
	plan.generalCapabilities = mergeCapabilities(plan.generalCapabilities, parsed.generalCapabilities);
	plan.teachingSequence = mergeTeachingSequence(plan.teachingSequence, parsed.teachingSequence);

	return plan;
}

function mergeAssessments(
	existing: UnitAssessment[],
	parsed: ParsedUnitPlanFields['assessments']
): UnitAssessment[] {
	if (parsed.length === 0) return existing;

	return existing.map((base, index) => {
		const row = parsed[index];
		if (!row) return base;
		const merged = {
			...base,
			assessmentNumber: { ...base.assessmentNumber, value: row.assessmentNumber },
			title: { ...base.title, value: row.title },
			description: { ...base.description, value: row.description },
			technique: { ...base.technique, value: row.technique },
			mode: { ...base.mode, value: row.mode },
			conditions: { ...base.conditions, value: row.conditions },
			timing: { ...base.timing, value: row.timing },
			achievementStandard: { ...base.achievementStandard, value: row.achievementStandard },
			moderation: { ...base.moderation, value: row.moderation },
			contentDescriptions: row.contentDescriptions.map((cd, cdIndex) => {
				const existingCd = base.contentDescriptions[cdIndex];
				if (existingCd) {
					return {
						...existingCd,
						strand: { ...existingCd.strand, value: cd.strand },
						subStrand: { ...existingCd.subStrand, value: cd.subStrand },
						text: { ...existingCd.text, value: cd.text },
						code: { ...existingCd.code, value: cd.code }
					};
				}
				return {
					id: `ucd-import-${index}-${cdIndex}`,
					strand: { value: cd.strand, aiNotes: '' },
					subStrand: { value: cd.subStrand, aiNotes: '' },
					text: { value: cd.text, aiNotes: '' },
					code: { value: cd.code, aiNotes: '' }
				};
			})
		};
		return merged;
	});
}

function mergeCapabilities(
	existing: UnitGeneralCapability[],
	parsed: ParsedUnitPlanFields['generalCapabilities']
): UnitGeneralCapability[] {
	return existing.map((cap) => {
		const row = parsed.find((p) => p.name === cap.name.value);
		if (!row) return cap;
		const subElementChecks = applyCheckedSubElementsFromText(cap, row.subElements);
		return {
			...cap,
			subElementChecks,
			subElements: { ...cap.subElements, value: cap.subElements.value },
			evidenceNotes: { ...cap.evidenceNotes, value: row.evidenceNotes }
		};
	});
}

function mergeTeachingSequence(
	existing: TeachingWeek[],
	parsed: ParsedUnitPlanFields['teachingSequence']
): TeachingWeek[] {
	const byWeek = new Map(
		existing.map((week) => [Number(week.week.value), week] as const)
	);

	for (const row of parsed) {
		if (row.week === '') continue;
		const week = byWeek.get(Number(row.week));
		if (!week) continue;
		week.keyTeachingExperiences.value = row.keyTeachingExperiences;
		week.theory.value = row.theory;
		week.prac.value = row.prac;
		week.assessment.value = row.assessment;
		week.resources.value = row.resources;
	}

	return existing;
}
