import { getCurriculumForPlanType, type CurriculumContentDescriptor } from '$lib/curriculum/curriculum-catalogue';
import {
	createDefaultAuthenticationStrategies,
	createDefaultCheckpoints,
	createDefaultExamSections,
	createEmptyAssessmentItem,
	createId,
	normalizeYearBand
} from '$lib/defaults';
import { aiField, cloneAiField, type AssessmentCriteriaRow, type AssessmentItem, type UnitAssessment, type UnitPlan } from '$lib/types';

export type DigiTechBand = '7-8' | '9-10';

export type AssessmentTemplateKind = 'assignment' | 'exam';

export interface DigiTechInstrumentCatalogue {
	band: DigiTechBand;
	contentDescriptors: CurriculumContentDescriptor[];
	criteriaRows: Omit<AssessmentCriteriaRow, 'enabled'>[];
}

function row(
	id: string,
	category: string,
	strand: string,
	codes: string[],
	A: string,
	B: string,
	C: string,
	D: string,
	E: string
): Omit<AssessmentCriteriaRow, 'enabled'> {
	return {
		id,
		category,
		strand,
		contentDescriptionCodes: codes,
		descriptors: { A, B, C, D, E }
	};
}

const RUBRIC_7_8: Omit<AssessmentCriteriaRow, 'enabled'>[] = [
	row(
		'dt78-ds-hardware',
		'Knowledge and understanding',
		'Digital systems',
		['AC9TDI8K01'],
		'proficient selection of appropriate hardware for particular tasks',
		'effective selection of appropriate hardware for particular tasks',
		'selection of appropriate hardware for particular tasks',
		'guided selection of appropriate hardware for particular tasks',
		'directed selection of appropriate hardware for particular tasks'
	),
	row(
		'dt78-ds-networks',
		'Knowledge and understanding',
		'Digital systems',
		['AC9TDI8K02'],
		'considered explanation of how data is transmitted and secured in networks',
		'detailed explanation of how data is transmitted and secured in networks',
		'explanation of how data is transmitted and secured in networks',
		'description of how data is transmitted and/or secured in networks',
		'statement/s about data transmission and/or security'
	),
	row(
		'dt78-data-rep',
		'Knowledge and understanding',
		'Data representation',
		['AC9TDI8K03', 'AC9TDI8K04'],
		'reasoned representation of data with integers and binary',
		'effective representation of data with integers and binary',
		'representation of data with integers and binary',
		'partial representation of data with integers and binary',
		'fragmented representation of data with integers and/or binary'
	),
	row(
		'dt78-acquiring',
		'Processes and production skills',
		'Acquiring, managing and analysing data',
		['AC9TDI8P01', 'AC9TDI8P02', 'AC9TDI8P03'],
		'proficient acquisition, interpretation and modelling of data with spreadsheets',
		'effective acquisition, interpretation and modelling of data with spreadsheets',
		'acquisition, interpretation and modelling of data with spreadsheets',
		'partial acquisition, interpretation and/or modelling of data with spreadsheets',
		'fragmented acquisition, interpretation and/or modelling of data with spreadsheets'
	),
	row(
		'dt78-investigating',
		'Processes and production skills',
		'Investigating and defining',
		['AC9TDI8P04'],
		'reasoned decomposition of real-world problems',
		'logical decomposition of real-world problems',
		'decomposition of real-world problems',
		'partial decomposition of real-world problems',
		'statement/s about real-world problems'
	),
	row(
		'dt78-generating-algo',
		'Processes and production skills',
		'Generating and designing',
		['AC9TDI8P05', 'AC9TDI8P06'],
		'proficient design and tracing of algorithms',
		'effective design and tracing of algorithms',
		'design and tracing of algorithms',
		'guided design and/or tracing of algorithms',
		'directed design and/or tracing of algorithms'
	),
	row(
		'dt78-generating-ux',
		'Processes and production skills',
		'Generating and designing',
		['AC9TDI8P07'],
		'considered design of the user experience of a digital system',
		'effective design of the user experience of a digital system',
		'design of the user experience of a digital system',
		'partial design of the user experience of a digital system',
		'directed design of the user experience of a digital system'
	),
	row(
		'dt78-generating-design',
		'Processes and production skills',
		'Generating and designing',
		['AC9TDI8P08'],
		'considered development and modification of creative digital solutions',
		'effective development and modification of creative digital solutions',
		'development and modification of creative digital solutions',
		'partial development and modification of aspects of creative digital solutions',
		'fragmented development and/or modification of aspects of creative digital solutions'
	),
	row(
		'dt78-producing',
		'Processes and production skills',
		'Producing and implementing',
		['AC9TDI8P09'],
		'proficient implementation of algorithms in a general-purpose programming language',
		'effective implementation of algorithms in a general-purpose programming language',
		'implementation of algorithms in a general-purpose programming language',
		'partial implementation of algorithms in a general-purpose programming language',
		'directed implementation of algorithms'
	),
	row(
		'dt78-evaluating',
		'Processes and production skills',
		'Evaluating',
		['AC9TDI8P10'],
		'discerning evaluation of alternative solutions against user stories and design criteria',
		'plausible evaluation of alternative solutions against user stories and design criteria',
		'evaluation of alternative solutions against user stories and design criteria',
		'description of alternative solutions against user stories and design criteria',
		'identification of features of solutions'
	),
	row(
		'dt78-collaborating',
		'Processes and production skills',
		'Collaborating and managing',
		['AC9TDI8P11', 'AC9TDI8P12'],
		'proficient selection and use of a range of digital tools to efficiently and responsibly create, locate and share content; plan, collaborate on and manage projects',
		'effective selection and use of a range of digital tools to efficiently and responsibly create, locate and share content; plan, collaborate on and manage projects',
		'selection and use of a range of digital tools to efficiently and responsibly create, locate and share content; plan, collaborate on and manage projects',
		'variable selection and use of a range of digital tools to partially create, locate and/or share content; plan, collaborate on and/or manage projects',
		'directed selection and responsible use of a range of digital tools'
	),
	row(
		'dt78-privacy-cyber',
		'Processes and production skills',
		'Privacy and security',
		['AC9TDI8P13'],
		'discerning identification of cyber security threats',
		'informed identification of cyber security threats',
		'identification of cyber security threats',
		'partial identification of cyber security threats',
		'directed identification of cyber security threats'
	),
	row(
		'dt78-privacy-footprint',
		'Processes and production skills',
		'Privacy and security',
		['AC9TDI8P14'],
		'justified management of their digital footprint.',
		'informed management of their digital footprint.',
		'management of their digital footprint.',
		'management of aspects of their digital footprint.',
		'directed management of their digital footprint.'
	)
];

const RUBRIC_9_10: Omit<AssessmentCriteriaRow, 'enabled'>[] = [
	row(
		'dt910-ds',
		'Knowledge and understanding',
		'Digital systems',
		['AC9TDI10K01'],
		'considered explanation of how digital systems manage, control and secure access to data',
		'detailed explanation of how digital systems manage, control and secure access to data',
		'explanation of how digital systems manage, control and secure access to data',
		'description of how digital systems manage, control and/or secure access to data',
		'statement/s about data management, control and/or secure access to data'
	),
	row(
		'dt910-data-rep',
		'Knowledge and understanding',
		'Data representation',
		['AC9TDI10K02', 'AC9TDI10K03'],
		'reasoned representation of documents as content, structure and presentation; discerning investigation of simple data compression techniques',
		'effective representation of documents as content, structure and presentation; informed investigation of simple data compression techniques',
		'representation of documents as content, structure and presentation; investigation of simple data compression techniques',
		'partial representation of documents as content, structure and/or presentation; partial investigation of simple data compression techniques',
		'directed representation of documents as content, structure and/or presentation; statement/s about simple data compression techniques'
	),
	row(
		'dt910-acquiring',
		'Processes and production skills',
		'Acquiring, managing and analysing data',
		['AC9TDI10P01', 'AC9TDI10P02', 'AC9TDI10P03'],
		'proficient acquisition, interpretation and modelling of complex data with databases',
		'effective acquisition, interpretation and modelling of complex data with databases',
		'acquisition, interpretation and modelling of complex data with databases',
		'partial acquisition, interpretation and/or modelling of complex data with databases',
		'fragmented acquisition, interpretation and modelling of complex data with databases'
	),
	row(
		'dt910-investigating',
		'Processes and production skills',
		'Investigating and defining',
		['AC9TDI10P04'],
		'reasoned decomposition of real-world problems',
		'effective decomposition of real-world problems',
		'decomposition of real-world problems',
		'partial decomposition of real-world problems',
		'statement/s about real-world problems'
	),
	row(
		'dt910-generating-algo',
		'Processes and production skills',
		'Generating and designing',
		['AC9TDI10P05', 'AC9TDI10P06'],
		'considered design and validation of algorithms',
		'effective design and validation of algorithms',
		'design and validation of algorithms',
		'guided design and/or validation of algorithms',
		'directed design and/or validation of algorithms'
	),
	row(
		'dt910-generating-ux',
		'Processes and production skills',
		'Generating and designing',
		['AC9TDI10P07'],
		'considered design and prototyping of the user experience of a digital system',
		'effective design and prototyping of the user experience of a digital system',
		'design and prototyping of the user experience of a digital system',
		'partial design and/or prototyping of the user experience of a digital system',
		'directed design and/or prototyping of the user experience of a digital system'
	),
	row(
		'dt910-generating-design',
		'Processes and production skills',
		'Generating and designing',
		['AC9TDI10P08'],
		'considered development and modification of innovative digital solutions',
		'effective development and modification of innovative digital solutions',
		'development and modification of innovative digital solutions',
		'partial development and modification of innovative digital solutions',
		'fragmented development and/or modification of innovative digital solutions'
	),
	row(
		'dt910-producing',
		'Processes and production skills',
		'Producing and implementing',
		['AC9TDI10P09'],
		'proficient implementation of algorithms, including in an object-oriented programming language',
		'effective implementation of algorithms, including in an object-oriented programming language',
		'implementation of algorithms, including in an object-oriented programming language',
		'partial implementation of algorithms, including in an object-oriented programming language',
		'directed implementation of algorithms'
	),
	row(
		'dt910-evaluating',
		'Processes and production skills',
		'Evaluating',
		['AC9TDI10P10'],
		'discerning critical evaluation of alternative solutions against stakeholder elicited user stories',
		'effective critical evaluation of alternative solutions against stakeholder elicited user stories',
		'critical evaluation of alternative solutions against stakeholder elicited user stories',
		'partial evaluation of alternative solutions against stakeholder elicited user stories',
		'identification of alternative solutions against stakeholder elicited user stories'
	),
	row(
		'dt910-collaborating',
		'Processes and production skills',
		'Collaborating and managing',
		['AC9TDI10P11', 'AC9TDI10P12'],
		'proficient use of advanced features of digital tools to create interactive content; plan, collaborate on and manage agile projects',
		'effective use of advanced features of digital tools to create interactive content; plan, collaborate on and manage agile projects',
		'use of advanced features of digital tools to create interactive content; plan, collaborate on and manage agile projects',
		'variable use of advanced features of digital tools to partially create interactive content; plan, collaborate on and/or manage agile projects',
		'directed use of digital tools'
	),
	row(
		'dt910-privacy-cyber',
		'Processes and production skills',
		'Privacy and security',
		['AC9TDI10P13'],
		'discerning modelling of cyber security threats and exploration of a vulnerability',
		'plausible modelling of cyber security threats and exploration of a vulnerability',
		'modelling of cyber security threats and exploration of a vulnerability',
		'partial modelling of cyber security threats and/or exploration of a vulnerability',
		'statement/s about cyber security threats'
	),
	row(
		'dt910-privacy-footprint',
		'Processes and production skills',
		'Privacy and security',
		['AC9TDI10P14'],
		'proficient application of privacy principles to manage digital footprints.',
		'informed application of privacy principles to manage digital footprints.',
		'application of privacy principles to manage digital footprints.',
		'partial application of privacy principles to manage digital footprints.',
		'directed application of privacy principles to manage digital footprints.'
	)
];

export function resolveDigiTechBand(
	yearLevel: number | '' | string,
	subject = ''
): DigiTechBand | null {
	const subjectLower = subject.toLowerCase();
	if (subjectLower && !subjectLower.includes('digital')) return null;

	const yl =
		typeof yearLevel === 'number'
			? yearLevel
			: Number(String(yearLevel).replace(/[^0-9].*$/, '')) || 0;
	if (yl >= 7 && yl <= 8) return '7-8';
	if (yl >= 9 && yl <= 10) return '9-10';

	const band = normalizeYearBand(String(yearLevel));
	if (band.startsWith('7') || band.includes('7-8')) return '7-8';
	if (band.startsWith('9') || band.includes('9-10')) return '9-10';
	return null;
}

export function getDigiTechCatalogue(band: DigiTechBand): DigiTechInstrumentCatalogue {
	const planType =
		band === '7-8' ? '7-8-digital-technologies' : '9-10-digital-technologies';
	return {
		band,
		contentDescriptors: getCurriculumForPlanType(planType).contentDescriptors,
		criteriaRows: band === '7-8' ? RUBRIC_7_8 : RUBRIC_9_10
	};
}

export function resolveTemplateKind(technique: string): AssessmentTemplateKind {
	return technique === 'Examination' ? 'exam' : 'assignment';
}

export function selectedContentDescriptionCodes(item: AssessmentItem): string[] {
	return item.contentDescriptions.filter((cd) => cd.selected).map((cd) => String(cd.code.value));
}

/** Enable criteria rows that share any selected content-description code. */
export function applyContentDescriptionSelection(
	item: AssessmentItem,
	selectedCodes: string[]
): AssessmentItem {
	const selected = new Set(selectedCodes.filter(Boolean));
	item.contentDescriptions = item.contentDescriptions.map((cd) => ({
		...cd,
		selected: selected.has(String(cd.code.value))
	}));
	item.criteriaRows = item.criteriaRows.map((row) => ({
		...row,
		enabled: row.contentDescriptionCodes.some((code) => selected.has(code))
	}));
	return item;
}

export function toggleContentDescription(item: AssessmentItem, code: string, selected: boolean): AssessmentItem {
	const codes = new Set(selectedContentDescriptionCodes(item));
	if (selected) codes.add(code);
	else codes.delete(code);
	return applyContentDescriptionSelection(item, [...codes]);
}

/** Enable/disable a criteria row and keep matching content-description selections in sync. */
export function toggleCriteriaRow(
	item: AssessmentItem,
	rowId: string,
	enabled: boolean
): AssessmentItem {
	const row = item.criteriaRows.find((r) => r.id === rowId);
	if (!row) return item;
	const codes = new Set(selectedContentDescriptionCodes(item));
	for (const code of row.contentDescriptionCodes) {
		if (enabled) codes.add(code);
		else codes.delete(code);
	}
	return applyContentDescriptionSelection(item, [...codes]);
}

function buildContentDescriptions(
	catalogue: DigiTechInstrumentCatalogue,
	selectedCodes: Set<string>
): AssessmentItem['contentDescriptions'] {
	return catalogue.contentDescriptors.map((cd) => ({
		id: createId('acd'),
		strand: aiField(cd.strand),
		subStrand: aiField(cd.subStrand),
		text: aiField(cd.text),
		code: aiField(cd.code),
		selected: selectedCodes.has(cd.code)
	}));
}

function buildCriteriaRows(
	catalogue: DigiTechInstrumentCatalogue,
	selectedCodes: Set<string>
): AssessmentCriteriaRow[] {
	return catalogue.criteriaRows.map((row) => ({
		...row,
		enabled: row.contentDescriptionCodes.some((code) => selectedCodes.has(code)),
		descriptors: { ...row.descriptors }
	}));
}

export function seedInstrumentFromUnitAssessment(
	unit: UnitPlan,
	unitAssessment: UnitAssessment,
	options?: {
		id?: string;
		levelPlanId?: string;
		assessmentIndex?: number;
		band?: DigiTechBand | null;
	}
): AssessmentItem {
	const band =
		options?.band ??
		resolveDigiTechBand(unit.yearLevel.value || unitAssessment.yearLevel.value, String(unit.subject.value));
	const id = options?.id ?? createId('assess');
	const levelPlanId = options?.levelPlanId ?? unit.levelPlanId;
	const item = createEmptyAssessmentItem(
		id,
		levelPlanId,
		unit.id,
		String(unitAssessment.title.value) || 'New assessment item'
	);

	const assessmentNumber =
		unitAssessment.assessmentNumber.value !== '' && unitAssessment.assessmentNumber.value != null
			? Number(unitAssessment.assessmentNumber.value)
			: options?.assessmentIndex != null
				? options.assessmentIndex + 1
				: '';

	item.assessmentNumber = aiField(assessmentNumber);
	item.yearLevel = cloneAiField(unitAssessment.yearLevel.value !== '' ? unitAssessment.yearLevel : unit.yearLevel);
	item.subject = cloneAiField(unit.subject);
	item.unitTitle = cloneAiField(unit.unitTitle);
	item.title = cloneAiField(unitAssessment.title);
	item.description = cloneAiField(unitAssessment.description);
	item.technique = cloneAiField(unitAssessment.technique);
	item.mode = cloneAiField(unitAssessment.mode);
	item.conditions = cloneAiField(unitAssessment.conditions);
	item.topics = cloneAiField(unitAssessment.title);
	item.task = cloneAiField(unitAssessment.description);
	item.context = aiField(String(unit.unitDescription.value) || '');
	item.checkpoints = createDefaultCheckpoints(String(unit.finishWeek.value));
	item.authenticationStrategies = createDefaultAuthenticationStrategies();
	item.examSections = createDefaultExamSections();

	const selectedCodes = new Set(
		unitAssessment.contentDescriptions.map((cd) => String(cd.code.value)).filter(Boolean)
	);

	if (band) {
		const catalogue = getDigiTechCatalogue(band);
		item.contentDescriptions = buildContentDescriptions(catalogue, selectedCodes);
		item.criteriaRows = buildCriteriaRows(catalogue, selectedCodes);
	} else {
		item.contentDescriptions = unitAssessment.contentDescriptions.map((cd) => ({
			id: createId('acd'),
			strand: cloneAiField(cd.strand),
			subStrand: cloneAiField(cd.subStrand),
			text: cloneAiField(cd.text),
			code: cloneAiField(cd.code),
			selected: true
		}));
		item.criteriaRows = [];
	}

	return item;
}

export function ensureInstrumentCatalogue(item: AssessmentItem): AssessmentItem {
	const band = resolveDigiTechBand(item.yearLevel.value, String(item.subject.value));
	if (!band) return item;
	const catalogue = getDigiTechCatalogue(band);
	const selected = new Set(selectedContentDescriptionCodes(item));

	if (!item.contentDescriptions.length) {
		item.contentDescriptions = buildContentDescriptions(catalogue, selected);
	} else {
		// Keep any teacher selections, but ensure every catalogue CD is present (e.g. K02).
		const byCode = new Map(
			item.contentDescriptions.map((cd) => [String(cd.code.value), cd] as const)
		);
		item.contentDescriptions = catalogue.contentDescriptors.map((cd) => {
			const existing = byCode.get(cd.code);
			if (existing) {
				return {
					...existing,
					strand: existing.strand?.value ? existing.strand : aiField(cd.strand),
					subStrand: existing.subStrand ?? aiField(cd.subStrand),
					text: existing.text?.value ? existing.text : aiField(cd.text),
					code: aiField(cd.code),
					selected: selected.has(cd.code) || Boolean(existing.selected)
				};
			}
			return {
				id: createId('acd'),
				strand: aiField(cd.strand),
				subStrand: aiField(cd.subStrand),
				text: aiField(cd.text),
				code: aiField(cd.code),
				selected: selected.has(cd.code)
			};
		});
	}

	if (!item.criteriaRows.length) {
		item.criteriaRows = buildCriteriaRows(catalogue, selected);
	} else {
		// Refresh codes/labels from catalogue so CD↔criteria links stay accurate.
		const byId = new Map(item.criteriaRows.map((row) => [row.id, row] as const));
		item.criteriaRows = catalogue.criteriaRows.map((catalogueRow) => {
			const existing = byId.get(catalogueRow.id);
			if (!existing) {
				return {
					...catalogueRow,
					enabled: catalogueRow.contentDescriptionCodes.some((code) => selected.has(code)),
					descriptors: { ...catalogueRow.descriptors }
				};
			}
			return {
				...existing,
				category: catalogueRow.category,
				strand: catalogueRow.strand,
				contentDescriptionCodes: [...catalogueRow.contentDescriptionCodes],
				descriptors: existing.descriptors ?? { ...catalogueRow.descriptors }
			};
		});
	}

	return applyContentDescriptionSelection(item, selectedContentDescriptionCodes(item));
}

/** Push instrument planning fields onto the matching unit assessment. */
export function applyAssessmentItemToUnitAssessment(
	unitAssessment: UnitAssessment,
	item: AssessmentItem
): void {
	unitAssessment.title = cloneAiField(item.title);
	unitAssessment.description = cloneAiField(item.description);
	unitAssessment.technique = cloneAiField(item.technique);
	unitAssessment.mode = cloneAiField(item.mode);
	unitAssessment.conditions = cloneAiField(item.conditions);
	if (item.assessmentNumber.value !== '') {
		unitAssessment.assessmentNumber = cloneAiField(item.assessmentNumber);
	}
	if (item.yearLevel.value !== '') {
		unitAssessment.yearLevel = cloneAiField(item.yearLevel);
	}
	unitAssessment.contentDescriptions = item.contentDescriptions
		.filter((cd) => cd.selected)
		.map((cd) => ({
			id: createId('ucd'),
			strand: cloneAiField(cd.strand),
			subStrand: cloneAiField(cd.subStrand),
			text: cloneAiField(cd.text),
			code: cloneAiField(cd.code)
		}));
}

function normalizeTitle(title: string) {
	return title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function assessmentItemForUnitIndex(
	unitAssessment: UnitAssessment,
	assessmentIndex: number,
	items: AssessmentItem[]
): AssessmentItem | undefined {
	const byNumber = items.find(
		(item) =>
			item.assessmentNumber.value !== '' &&
			Number(item.assessmentNumber.value) === assessmentIndex + 1
	);
	if (byNumber) return byNumber;

	const slotTitle = normalizeTitle(String(unitAssessment.title.value));
	if (!slotTitle) return undefined;
	return items.find((item) => {
		const itemTitle = normalizeTitle(String(item.title.value));
		return (
			slotTitle === itemTitle ||
			itemTitle.includes(slotTitle) ||
			slotTitle.includes(itemTitle)
		);
	});
}
