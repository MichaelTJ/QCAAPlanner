import { GENERAL_CAPABILITY_NAMES } from '$lib/defaults';
import type { CapabilityRow, LevelPlan, LevelPlanUnit, UnitPlan } from '$lib/types';

export interface CapabilitySubElement {
	id: string;
	label: string;
}

export interface CapabilityCategory {
	id: string;
	label: string;
	subElements: CapabilitySubElement[];
}

export interface CapabilityDefinition {
	name: string;
	categories: CapabilityCategory[];
}

export const GENERAL_CAPABILITY_DEFINITIONS: CapabilityDefinition[] = [
	{
		name: 'Critical and creative thinking',
		categories: [
			{
				id: 'cct-inquiring',
				label: 'Inquiring',
				subElements: [
					{ id: 'cct-inquiring-develop-questions', label: 'Develop questions' },
					{
						id: 'cct-inquiring-identify-process-evaluate',
						label: 'Identify, process and evaluate information'
					}
				]
			},
			{
				id: 'cct-generating',
				label: 'Generating',
				subElements: [
					{ id: 'cct-generating-create-possibilities', label: 'Create possibilities' },
					{ id: 'cct-generating-consider-alternatives', label: 'Consider alternatives' },
					{ id: 'cct-generating-put-ideas-into-action', label: 'Put ideas into action' }
				]
			},
			{
				id: 'cct-analysing',
				label: 'Analysing',
				subElements: [
					{
						id: 'cct-analysing-interpret-concepts',
						label: 'Interpret concepts and problems'
					},
					{
						id: 'cct-analysing-draw-conclusions',
						label: 'Draw conclusions and provide reasons'
					},
					{
						id: 'cct-analysing-evaluate-actions',
						label: 'Evaluate actions and outcomes'
					}
				]
			},
			{
				id: 'cct-reflecting',
				label: 'Reflecting',
				subElements: [
					{
						id: 'cct-reflecting-metacognition',
						label: 'Thinking about thinking (metacognition)'
					},
					{ id: 'cct-reflecting-transfer-knowledge', label: 'Transfer knowledge' }
				]
			}
		]
	},
	{
		name: 'Digital literacy',
		categories: [
			{
				id: 'dl-safety-wellbeing',
				label: 'Practising digital safety and wellbeing',
				subElements: [
					{ id: 'dl-safety-manage-online', label: 'Manage online safety' },
					{
						id: 'dl-safety-privacy-identity',
						label: 'Manage digital privacy and identity'
					},
					{ id: 'dl-safety-wellbeing', label: 'Manage digital wellbeing' }
				]
			},
			{
				id: 'dl-investigating',
				label: 'Investigating',
				subElements: [
					{ id: 'dl-investigating-locate', label: 'Locate information' },
					{ id: 'dl-investigating-acquire', label: 'Acquire and collate data' },
					{ id: 'dl-investigating-interpret', label: 'Interpret data' }
				]
			},
			{
				id: 'dl-creating-exchanging',
				label: 'Creating and exchanging',
				subElements: [
					{ id: 'dl-creating-plan', label: 'Plan' },
					{
						id: 'dl-creating-communicate-collaborate',
						label: 'Create, communicate and collaborate'
					},
					{ id: 'dl-creating-ip', label: 'Respect intellectual property' }
				]
			},
			{
				id: 'dl-managing-operating',
				label: 'Managing and operating',
				subElements: [
					{ id: 'dl-managing-content', label: 'Manage content' },
					{ id: 'dl-managing-protect', label: 'Protect content' },
					{ id: 'dl-managing-operate', label: 'Select and operate tools' }
				]
			}
		]
	},
	{
		name: 'Ethical understanding',
		categories: [
			{
				id: 'eu-concepts',
				label: 'Understanding ethical concepts and perspectives',
				subElements: [
					{ id: 'eu-concepts-explore', label: 'Explore ethical concepts' },
					{
						id: 'eu-concepts-values-rights',
						label: 'Examine values, rights and responsibilities, and ethical norms'
					},
					{
						id: 'eu-concepts-influences',
						label: 'Recognise influences on ethical behaviour and perspectives'
					}
				]
			},
			{
				id: 'eu-responding',
				label: 'Responding to ethical issues',
				subElements: [
					{
						id: 'eu-responding-frameworks',
						label: 'Explore ethical perspectives and frameworks'
					},
					{ id: 'eu-responding-issues', label: 'Explore ethical issues' },
					{
						id: 'eu-responding-decisions',
						label: 'Make and reflect on ethical decisions'
					}
				]
			}
		]
	},
	{
		name: 'Intercultural understanding',
		categories: [
			{
				id: 'iu-reflecting',
				label: 'Reflecting on culture and cultural diversity',
				subElements: [
					{
						id: 'iu-reflecting-cultures-identities',
						label: 'Reflect on the relationship between cultures and identities'
					},
					{
						id: 'iu-reflecting-perspectives',
						label: 'Examine cultural perspectives and world views'
					},
					{
						id: 'iu-reflecting-influence',
						label: 'Explore the influence of cultures on interactions'
					}
				]
			},
			{
				id: 'iu-engaging',
				label: 'Engaging with cultural and linguistic diversity',
				subElements: [
					{ id: 'iu-engaging-communicate', label: 'Communicate responsively' },
					{ id: 'iu-engaging-perspectives', label: 'Develop multiple perspectives' },
					{ id: 'iu-engaging-empathy', label: 'Develop empathy' }
				]
			},
			{
				id: 'iu-navigating',
				label: 'Navigating intercultural contexts',
				subElements: [
					{
						id: 'iu-navigating-responses',
						label: 'Consider responses to intercultural experiences'
					},
					{
						id: 'iu-navigating-biases',
						label: 'Respond to biases, stereotypes, prejudices and discrimination'
					},
					{ id: 'iu-navigating-adapt', label: 'Adapt in intercultural exchanges' }
				]
			}
		]
	},
	{
		name: 'Literacy',
		categories: [
			{
				id: 'lit-speaking-listening',
				label: 'Speaking and listening',
				subElements: [
					{ id: 'lit-listening', label: 'Listening' },
					{ id: 'lit-interacting', label: 'Interacting' },
					{ id: 'lit-speaking', label: 'Speaking' }
				]
			},
			{
				id: 'lit-reading-viewing',
				label: 'Reading and viewing',
				subElements: [
					{ id: 'lit-understanding-texts', label: 'Understanding texts' },
					{ id: 'lit-phonological-awareness', label: 'Phonological awareness' },
					{
						id: 'lit-phonic-knowledge',
						label: 'Phonic knowledge and word recognition'
					},
					{ id: 'lit-fluency', label: 'Fluency' }
				]
			},
			{
				id: 'lit-writing',
				label: 'Writing',
				subElements: [
					{ id: 'lit-creating-texts', label: 'Creating texts' },
					{ id: 'lit-grammar', label: 'Grammar' },
					{ id: 'lit-punctuation', label: 'Punctuation' },
					{ id: 'lit-spelling', label: 'Spelling' },
					{ id: 'lit-handwriting-keyboarding', label: 'Handwriting and keyboarding' }
				]
			}
		]
	},
	{
		name: 'Numeracy',
		categories: [
			{
				id: 'num-number-algebra',
				label: 'Number sense and algebra',
				subElements: [
					{ id: 'num-place-value', label: 'Number and place value' },
					{ id: 'num-counting', label: 'Counting processes' },
					{ id: 'num-additive', label: 'Additive strategies' },
					{ id: 'num-multiplicative', label: 'Multiplicative strategies' },
					{ id: 'num-fractions', label: 'Interpreting fractions' },
					{ id: 'num-proportional', label: 'Proportional thinking' },
					{
						id: 'num-patterns-algebra',
						label: 'Number patterns and algebraic thinking'
					},
					{ id: 'num-money', label: 'Understanding money' }
				]
			},
			{
				id: 'num-measurement-geometry',
				label: 'Measurement and geometry',
				subElements: [
					{
						id: 'num-units-measurement',
						label: 'Understanding units of measurement'
					},
					{
						id: 'num-geometric-properties',
						label: 'Understanding geometric properties'
					},
					{ id: 'num-positioning', label: 'Positioning and locating' },
					{ id: 'num-measuring-time', label: 'Measuring time' }
				]
			},
			{
				id: 'num-statistics-probability',
				label: 'Statistics and probability',
				subElements: [
					{ id: 'num-chance', label: 'Understanding chance' },
					{ id: 'num-data', label: 'Interpreting and representing data' }
				]
			}
		]
	},
	{
		name: 'Personal and social capability',
		categories: [
			{
				id: 'psc-self-awareness',
				label: 'Self-awareness',
				subElements: [
					{ id: 'psc-personal-awareness', label: 'Personal awareness' },
					{ id: 'psc-emotional-awareness', label: 'Emotional awareness' },
					{ id: 'psc-reflective-practice', label: 'Reflective practice' }
				]
			},
			{
				id: 'psc-self-management',
				label: 'Self-management',
				subElements: [
					{ id: 'psc-goal-setting', label: 'Goal setting' },
					{ id: 'psc-emotional-regulation', label: 'Emotional regulation' },
					{
						id: 'psc-perseverance',
						label: 'Perseverance and adaptability'
					}
				]
			},
			{
				id: 'psc-social-awareness',
				label: 'Social awareness',
				subElements: [
					{ id: 'psc-empathy', label: 'Empathy' },
					{ id: 'psc-relational-awareness', label: 'Relational awareness' },
					{ id: 'psc-community-awareness', label: 'Community awareness' }
				]
			},
			{
				id: 'psc-social-management',
				label: 'Social management',
				subElements: [
					{ id: 'psc-communication', label: 'Communication' },
					{ id: 'psc-collaboration', label: 'Collaboration' },
					{ id: 'psc-leadership', label: 'Leadership' },
					{ id: 'psc-decision-making', label: 'Decision-making' },
					{ id: 'psc-conflict-resolution', label: 'Conflict resolution' }
				]
			}
		]
	}
];

export function getCapabilityDefinition(name: string): CapabilityDefinition | undefined {
	return GENERAL_CAPABILITY_DEFINITIONS.find((def) => def.name === name);
}

export function formatCheckedSubElements(
	name: string,
	checks: Record<string, boolean>
): string {
	const def = getCapabilityDefinition(name);
	if (!def) return '';

	const lines: string[] = [];
	for (const category of def.categories) {
		const categoryParts: string[] = [];
		for (const sub of category.subElements) {
			if (checks[sub.id]) categoryParts.push(sub.label);
		}
		if (categoryParts.length) {
			lines.push(`${category.label}: ${categoryParts.join('; ')}`);
		}
	}
	return lines.join('\n');
}

export function allSubElementIds(definition: CapabilityDefinition): string[] {
	return definition.categories.flatMap((cat) => cat.subElements.map((sub) => sub.id));
}

export function allCategoryIds(definition: CapabilityDefinition): string[] {
	return definition.categories.map((cat) => cat.id);
}

function resizeInclusionArray(
	record: Record<string, boolean[]>,
	key: string,
	unitCount: number
) {
	if (!record[key]) record[key] = Array(unitCount).fill(false);
	while (record[key].length < unitCount) record[key].push(false);
	record[key] = record[key].slice(0, unitCount);
}

export function syncCapabilityRowColumns(row: CapabilityRow, unitCount: number) {
	const def = getCapabilityDefinition(row.name.value);
	while (row.unitInclusions.length < unitCount) row.unitInclusions.push(false);
	row.unitInclusions = row.unitInclusions.slice(0, unitCount);
	if (!def) return;

	row.categoryInclusions ??= {};
	row.subElementInclusions ??= {};
	for (const category of def.categories) {
		resizeInclusionArray(row.categoryInclusions, category.id, unitCount);
		for (const sub of category.subElements) {
			resizeInclusionArray(row.subElementInclusions, sub.id, unitCount);
		}
	}
}

export function ensureUnitCapabilityChecks(cap: {
	name: { value: string };
	subElementChecks?: Record<string, boolean>;
}): Record<string, boolean> {
	const def = getCapabilityDefinition(cap.name.value);
	if (!cap.subElementChecks) cap.subElementChecks = {};
	if (!def) return cap.subElementChecks;
	for (const id of allSubElementIds(def)) {
		cap.subElementChecks[id] ??= false;
	}
	return cap.subElementChecks;
}

export function capabilityTaxonomyForPrompt(capabilityName?: string) {
	const defs = capabilityName
		? GENERAL_CAPABILITY_DEFINITIONS.filter((def) => def.name === capabilityName)
		: GENERAL_CAPABILITY_DEFINITIONS;
	return defs.map((def) => ({
		capability: def.name,
		elements: def.categories.map((category) => ({
			element: category.label,
			subElements: category.subElements.map((sub) => ({ id: sub.id, label: sub.label }))
		}))
	}));
}

export function validSubElementIds(capabilityName?: string): string[] {
	const defs = capabilityName
		? GENERAL_CAPABILITY_DEFINITIONS.filter((def) => def.name === capabilityName)
		: GENERAL_CAPABILITY_DEFINITIONS;
	return defs.flatMap((def) => allSubElementIds(def));
}

export function applyCheckedSubElementIds(
	checks: Record<string, boolean>,
	checkedIds: string[],
	scopeIds?: string[]
) {
	const scope = scopeIds ?? Object.keys(checks);
	for (const id of scope) {
		checks[id] = false;
	}
	for (const id of checkedIds) {
		if (scope.includes(id)) checks[id] = true;
	}
}

function normalizeUnitTitle(title: string) {
	return title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function unitPlanForLevelIndex(
	levelUnit: LevelPlanUnit,
	unitIndex: number,
	unitPlans: UnitPlan[]
): UnitPlan | undefined {
	const byNumber = unitPlans.find(
		(plan) => plan.unitNumber.value !== '' && Number(plan.unitNumber.value) === unitIndex + 1
	);
	if (byNumber) return byNumber;

	const levelTitle = normalizeUnitTitle(String(levelUnit.unitTitle.value));
	return unitPlans.find((plan) => {
		const unitTitle = normalizeUnitTitle(String(plan.unitTitle.value));
		return (
			levelTitle === unitTitle ||
			unitTitle.includes(levelTitle) ||
			levelTitle.includes(unitTitle)
		);
	});
}

export function applyUnitPlanCapabilitiesToLevelPlan(
	levelPlan: LevelPlan,
	unitPlan: UnitPlan,
	unitIndex: number
) {
	const unitCount = levelPlan.units.length;
	if (unitIndex < 0 || unitIndex >= unitCount) return;

	for (const row of levelPlan.generalCapabilities) {
		syncCapabilityRowColumns(row, unitCount);
	}

	for (const unitCap of unitPlan.generalCapabilities) {
		const levelRow = levelPlan.generalCapabilities.find(
			(row) => row.name.value === unitCap.name.value
		);
		if (!levelRow) continue;

		const checks = ensureUnitCapabilityChecks(unitCap);
		const def = getCapabilityDefinition(unitCap.name.value);
		if (!def) continue;

		let anyChecked = false;
		for (const category of def.categories) {
			for (const sub of category.subElements) {
				const checked = Boolean(checks[sub.id]);
				levelRow.subElementInclusions![sub.id][unitIndex] = checked;
				if (checked) anyChecked = true;
			}
			const allChecked = category.subElements.every((sub) =>
				Boolean(levelRow.subElementInclusions![sub.id][unitIndex])
			);
			levelRow.categoryInclusions![category.id][unitIndex] = allChecked;
		}
		levelRow.unitInclusions[unitIndex] = anyChecked;
	}
}

export function syncUnitPlansIntoLevelCapabilities(levelPlan: LevelPlan, unitPlans: UnitPlan[]) {
	for (let unitIndex = 0; unitIndex < levelPlan.units.length; unitIndex++) {
		const unitPlan = unitPlanForLevelIndex(levelPlan.units[unitIndex], unitIndex, unitPlans);
		if (unitPlan) applyUnitPlanCapabilitiesToLevelPlan(levelPlan, unitPlan, unitIndex);
	}
}

// Validate taxonomy matches defaults list
for (const name of GENERAL_CAPABILITY_NAMES) {
	if (!getCapabilityDefinition(name)) {
		throw new Error(`Missing general capability definition for: ${name}`);
	}
}
