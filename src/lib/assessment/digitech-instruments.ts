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

/** Digital and Design instrument catalogues used for CD pickers + A–E rubrics. */
export type InstrumentCatalogueKey = 'digital-7-8' | 'digital-9-10' | 'design-9-10';

export type AssessmentTemplateKind = 'assignment' | 'exam';

export interface InstrumentCatalogue {
	key: InstrumentCatalogueKey;
	contentDescriptors: CurriculumContentDescriptor[];
	criteriaRows: Omit<AssessmentCriteriaRow, 'enabled'>[];
}

/** @deprecated Prefer InstrumentCatalogue — kept for DigiTech template export helpers. */
export type DigiTechInstrumentCatalogue = InstrumentCatalogue & { band: DigiTechBand };

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

/**
 * Design and Technologies Years 9–10 A–E rows from QCAA standards elaborations
 * (ac9_tech_design_se_yr9-10.docx). Mapped to AC v9.0 content description codes
 * so selecting a CD enables the matching SE criterion.
 */
const RUBRIC_DESIGN_9_10: Omit<AssessmentCriteriaRow, 'enabled'>[] = [
	row(
		'de910-se-society-factors',
		'Knowledge and understanding',
		'Technologies and society',
		['AC9TDE10K01'],
		'discerning explanation of how people consider factors that impact on design decisions and the technologies used to design and produce products, services and environments for sustainable living',
		'detailed explanation of how people consider factors that impact on design decisions and the technologies used to design and produce products, services and environments for sustainable living',
		'explanation of how people consider factors that impact on design decisions and the technologies used to design and produce products, services and environments for sustainable living',
		'description of how people consider factors that impact on design decisions and the technologies used to design and produce products, services and environments for sustainable living',
		'statement/s about factors that impact on design decisions and/or the technologies used to design and produce designed solutions'
	),
	row(
		'de910-se-society-innovation',
		'Knowledge and understanding',
		'Technologies and society',
		['AC9TDE10K02'],
		'discerning explanation of the contribution of innovation, enterprise skills and emerging technologies to global preferred futures',
		'detailed explanation of the contribution of innovation, enterprise skills and emerging technologies to global preferred futures',
		'explanation of the contribution of innovation, enterprise skills and emerging technologies to global preferred futures',
		'description of the contribution of innovation, enterprise skills and emerging technologies to global preferred futures',
		'statement/s about innovation, enterprise skills, and/or emerging technologies'
	),
	row(
		'de910-se-contexts',
		'Knowledge and understanding',
		'Technologies contexts',
		['AC9TDE10K03', 'AC9TDE10K04', 'AC9TDE10K05', 'AC9TDE10K06'],
		'discerning explanation of the features of technologies and their appropriateness for purpose for one or more of the prescribed technologies contexts',
		'detailed explanation of the features of technologies and their appropriateness for purpose for one or more of the prescribed technologies contexts',
		'explanation of the features of technologies and their appropriateness for purpose for one or more of the prescribed technologies contexts',
		'description of the features of technologies and their appropriateness for purpose for one or more of the prescribed technologies contexts',
		'statement/s about the features of technologies and/or their appropriateness for purpose'
	),
	row(
		'de910-se-investigating',
		'Processes and production skills',
		'Investigating and defining',
		['AC9TDE10P01'],
		'proficient analysis of needs or opportunities for one or more of the prescribed technologies contexts',
		'effective analysis of needs or opportunities for one or more of the prescribed technologies contexts',
		'analysis of needs or opportunities for one or more of the prescribed technologies contexts',
		'superficial analysis of needs or opportunities for one or more of the prescribed technologies contexts',
		'identification of needs or opportunities for one or more of the prescribed technologies contexts'
	),
	row(
		'de910-se-generating-ideas',
		'Processes and production skills',
		'Generating and designing',
		['AC9TDE10P02', 'AC9TDE10P04'],
		'development of reasoned design criteria that include sustainability; proficient creation, adaptation and refinement of comprehensive design ideas, processes and solutions based on analysis of needs or opportunities',
		'development of effective design criteria that include sustainability; informed creation, adaptation and refinement of effective design ideas, processes and solutions based on analysis of needs or opportunities',
		'development of design criteria that include sustainability; creation, adaptation and refinement of design ideas, processes and solutions based on analysis of needs or opportunities',
		'guided development of design criteria that include sustainability; partial creation, adaptation and refinement of simple design ideas, processes and solutions based on analysis of needs or opportunities',
		'directed development of design criteria that include sustainability; fragmented creation, adaptation and refinement of basic design ideas, processes and solutions based on needs or opportunities'
	),
	row(
		'de910-se-generating-communicate',
		'Processes and production skills',
		'Generating and designing',
		['AC9TDE10P02'],
		'communication of comprehensive design ideas, processes and solutions to a range of audiences, including using digital tools',
		'communication of effective design ideas, processes and solutions to a range of audiences, including using digital tools',
		'communication of design ideas, processes and solutions to a range of audiences, including using digital tools',
		'communication of superficial design ideas, processes and solutions to a range of audiences, including using digital tools',
		'communication of fragmented design ideas, processes and solutions'
	),
	row(
		'de910-se-producing',
		'Processes and production skills',
		'Producing and implementing',
		['AC9TDE10P03'],
		'purposeful selection and use of technologies to proficiently, skilfully and safely produce designed solutions',
		'effective selection and use of technologies to effectively, skilfully and safely produce designed solutions',
		'selection and use of technologies to skilfully and safely produce designed solutions',
		'simple selection and use of technologies to safely produce simple designed solutions',
		'basic selection and use of technologies to safely produce basic solutions'
	),
	row(
		'de910-se-evaluating',
		'Processes and production skills',
		'Evaluating',
		['AC9TDE10P04'],
		'discerning justification of decisions against developed design criteria that include sustainability',
		'logical justification of decisions against developed design criteria that include sustainability',
		'justification of decisions against developed design criteria that include sustainability',
		'partial justification of decisions against aspects of developed design criteria that include sustainability',
		'statement/s about design decisions'
	),
	row(
		'de910-se-collaborating',
		'Processes and production skills',
		'Collaborating and managing',
		['AC9TDE10P05'],
		'independent and collaborative: proficient development of production and project management plans; proficient application of production and project management plans, adjusting processes when necessary.',
		'independent and collaborative: effective development of production and project management plans; effective application of production and project management plans, adjusting processes when necessary.',
		'independent and collaborative development and application of production and project management plans, adjusting processes when necessary.',
		'independent and collaborative: partial development of production and project management plans; partial application of production and project management plans, adjusting processes when necessary.',
		'independent and/or collaborative: fragmented development of production and project management plans; fragmented application of production and project management plans, adjusting processes when necessary.'
	)
];

function yearBandFromLevel(yearLevel: number | '' | string): DigiTechBand | null {
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

/** Resolve DigiTech band for DigiTech Word templates only. */
export function resolveDigiTechBand(
	yearLevel: number | '' | string,
	subject = ''
): DigiTechBand | null {
	const subjectLower = subject.toLowerCase();
	if (subjectLower && !subjectLower.includes('digital')) return null;
	return yearBandFromLevel(yearLevel);
}

export function resolveInstrumentCatalogueKey(
	yearLevel: number | '' | string,
	subject = ''
): InstrumentCatalogueKey | null {
	const subjectLower = subject.toLowerCase();
	const band = yearBandFromLevel(yearLevel);
	if (!band) return null;

	if (subjectLower.includes('digital')) {
		return band === '7-8' ? 'digital-7-8' : 'digital-9-10';
	}
	if (subjectLower.includes('design')) {
		// Curriculum catalogue currently covers Years 9–10 Design only.
		if (band === '9-10') return 'design-9-10';
		return null;
	}
	return null;
}

export function getInstrumentCatalogue(key: InstrumentCatalogueKey): InstrumentCatalogue {
	switch (key) {
		case 'digital-7-8':
			return {
				key,
				contentDescriptors: getCurriculumForPlanType('7-8-digital-technologies').contentDescriptors,
				criteriaRows: RUBRIC_7_8
			};
		case 'digital-9-10':
			return {
				key,
				contentDescriptors: getCurriculumForPlanType('9-10-digital-technologies').contentDescriptors,
				criteriaRows: RUBRIC_9_10
			};
		case 'design-9-10':
			return {
				key,
				contentDescriptors: getCurriculumForPlanType('9-10-design').contentDescriptors,
				criteriaRows: RUBRIC_DESIGN_9_10
			};
	}
}

export function getDigiTechCatalogue(band: DigiTechBand): DigiTechInstrumentCatalogue {
	const key: InstrumentCatalogueKey = band === '7-8' ? 'digital-7-8' : 'digital-9-10';
	const catalogue = getInstrumentCatalogue(key);
	return { ...catalogue, band };
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
	catalogue: InstrumentCatalogue,
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
	catalogue: InstrumentCatalogue,
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
		catalogueKey?: InstrumentCatalogueKey | null;
	}
): AssessmentItem {
	const catalogueKey =
		options?.catalogueKey ??
		resolveInstrumentCatalogueKey(
			unit.yearLevel.value || unitAssessment.yearLevel.value,
			String(unit.subject.value)
		);
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

	if (catalogueKey) {
		const catalogue = getInstrumentCatalogue(catalogueKey);
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
	const catalogueKey = resolveInstrumentCatalogueKey(
		item.yearLevel.value,
		String(item.subject.value)
	);
	if (!catalogueKey) return item;
	const catalogue = getInstrumentCatalogue(catalogueKey);
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

/** Push unit-assessment content-description selections onto a linked instrument. */
export function applyUnitAssessmentContentDescriptionsToItem(
	item: AssessmentItem,
	unitAssessment: UnitAssessment
): AssessmentItem {
	const selectedCodes = unitAssessment.contentDescriptions
		.map((cd) => String(cd.code.value))
		.filter(Boolean);
	const withCatalogue = ensureInstrumentCatalogue(item);
	return applyContentDescriptionSelection(withCatalogue, selectedCodes);
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
