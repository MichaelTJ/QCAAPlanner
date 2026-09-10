import type { WorkbookActivity, WorkbookActivityKind } from './types';
import { WORKBOOK_ACTIVITY_CATALOG } from './types';

/** One fully worked example per kind for the catalog Word doc / AI few-shots. */
export const WORKBOOK_ACTIVITY_EXAMPLES: Record<WorkbookActivityKind, WorkbookActivity> = {
	table: {
		type: 'table',
		title: 'Classify homepage buttons',
		prompt: 'For each button, tick Info or Action (one tick only).',
		stimulus: 'Open the café homepage on the projector. Do not invent buttons that are not on screen.',
		headers: ['Button', 'Info', 'Action'],
		rows: [
			[
				{ mode: 'locked', value: 'Book Now' },
				{ mode: 'tick' },
				{ mode: 'tick' }
			],
			[
				{ mode: 'locked', value: 'Location / Map' },
				{ mode: 'tick' },
				{ mode: 'tick' }
			],
			[
				{ mode: 'locked', value: 'Our Menu' },
				{ mode: 'tick' },
				{ mode: 'tick' }
			],
			[
				{ mode: 'locked', value: 'Get a Quote' },
				{ mode: 'tick' },
				{ mode: 'tick' }
			]
		],
		modelAnswer: 'Book Now=Action; Location=Info; Menu=Info; Quote=Action.'
	},
	written: {
		type: 'written',
		title: '3-2-1 exit ticket',
		prompt: 'Complete each section before you leave.',
		stimulus: 'Use only evidence from today’s live-site walkthrough.',
		sections: [
			{ label: '3 functional purposes of a business website', lines: 3 },
			{ label: '2 common calls to action', lines: 2 },
			{ label: '1 reason a local Yeppoon business needs a digital presence', lines: 1 }
		],
		modelAnswer: 'Purposes: inform, convert, support. CTAs: Book / Contact. Need: customers expect hours online.'
	},
	ranking: {
		type: 'ranking',
		title: 'Prioritise features',
		prompt: 'Rank these features for a local trade business. Use each item once.',
		bank: ['Online booking', 'Photo gallery', 'Price list', 'Contact form'],
		slots: 4,
		directionLabel: 'Most important → least important',
		modelAnswer: '1 Online booking 2 Contact form 3 Photo gallery 4 Price list (example).'
	},
	sort: {
		type: 'sort',
		title: 'Sort homepage elements',
		prompt: 'Drop each item into one bucket.',
		bank: ['Book Now', 'Our Story', 'Gallery', 'Phone number', 'Opening hours', 'Get a Quote'],
		buckets: ['Information', 'Action', 'Trust'],
		linesPerBucket: 4
	},
	checklist: {
		type: 'checklist',
		title: 'Live-site audit',
		prompt: 'Tick each feature you can find on the live site.',
		items: [
			'Phone number visible without scrolling',
			'Clear primary CTA',
			'Map or address',
			'Service / product list',
			'Readable on a phone-sized window'
		]
	},
	cloze: {
		type: 'cloze',
		title: 'Guided notes',
		prompt: 'Fill each blank in the sentence.',
		text: 'A {{1}} guides the customer to take a specific action, while {{2}} helps a business capture customer details for follow-up.',
		wordBank: ['call to action (CTA)', 'lead generation'],
		modelAnswer: '1 CTA 2 lead generation'
	},
	continuum: {
		type: 'continuum',
		title: 'Rate the homepage',
		prompt: 'How effective is this homepage at converting a visitor?',
		left: 'Not effective',
		right: 'Highly effective',
		scale: 5,
		lines: 3,
		modelAnswer: 'Example: 4 — clear CTA above the fold, but contact buried.'
	},
	overlap: {
		type: 'overlap',
		title: 'Shopfront vs website',
		prompt: 'Compare a physical shopfront with a digital shopfront.',
		leftLabel: 'Physical shop',
		rightLabel: 'Website',
		lines: 3
	},
	graphic: {
		type: 'graphic',
		title: 'Audience mind map',
		prompt: 'Sketch a mind map of website users for your business.',
		mustInclude: ['Primary user', 'Need', 'Device', 'Barrier'],
		heightInches: 3.2
	},
	wireframe: {
		type: 'wireframe',
		title: 'Homepage wireframe',
		prompt: 'Complete the stencil for a local café homepage.',
		mustInclude: ['Logo', 'Primary CTA', 'Opening hours', 'Menu preview'],
		regions: [
			{ label: 'Header / nav' },
			{ label: 'Hero + primary CTA' },
			{ label: 'Content blocks' },
			{ label: 'Footer / contact' }
		],
		heightInches: 4
	},
	storyboard: {
		type: 'storyboard',
		title: 'Booking journey storyboard',
		prompt: 'Show what the user sees before, during, and after booking.',
		frames: [
			{ label: 'Before — arrives on site' },
			{ label: 'During — taps Book' },
			{ label: 'During — fills form' },
			{ label: 'After — confirmation' }
		],
		linesPerFrame: 2
	},
	flow: {
		type: 'flow',
		title: 'What happens when they click Book',
		prompt: 'Follow the path. After the calendar loads, branch on availability, then rejoin.',
		stimulus: 'Watch the booking demo on the board — match the stages you see.',
		stages: [{ label: 'User clicks Book Now' }, { label: 'Calendar loads' }],
		branchAfter: 1,
		yesLabel: 'Date free',
		noLabel: 'Date taken',
		yesPath: { label: 'Pick party size → pay deposit' },
		noPath: { blank: true },
		rejoin: { label: 'Confirmation email sent' },
		modelAnswer: 'No path: offer alternate dates / waitlist, then still confirm.'
	},
	code: {
		type: 'code',
		title: 'Circle the bug',
		prompt: 'One line is wrong. Circle it, then explain the fix.',
		language: 'html+js',
		mode: 'circle_bug',
		lines: [
			'<button id="book">Book Now</button>',
			'<script>',
			'  document.getElementById("book").onclick = () => {',
			'    alrt("Booked");',
			'  }',
			'</script>'
		],
		modelAnswer: 'Line 4: alrt → alert'
	},
	annotate: {
		type: 'annotate',
		title: 'Annotate the live homepage',
		prompt: 'Mark four callouts on the figure, then explain each in the legend.',
		stimulus: 'Teacher projects https://example-cafe.yeppoon.example — do not leave the tab.',
		figureHint: 'Mark ①–④ on the projected homepage (or sketch the layout in the box).',
		callouts: 4,
		linesPerCallout: 3,
		modelAnswer: '1 CTA 2 contact 3 trust signal 4 nav'
	},
	user_story: {
		type: 'user_story',
		title: 'User story',
		prompt: 'Write one user story for your chosen local business site.',
		role: 'parent booking a birthday party',
		want: '',
		soThat: '',
		modelAnswer:
			'As a parent booking a birthday party, I want to see package prices online so that I can decide before I call.'
	},
	sitemap: {
		type: 'sitemap',
		title: 'Site map',
		prompt: 'Complete the hierarchy. Blank lines are pages/sections you invent.',
		root: {
			label: 'Home',
			children: [
				{
					label: 'Services',
					children: [{ label: 'Catering' }, { label: '' }, { label: '' }]
				},
				{
					label: 'About',
					children: 2
				},
				{
					label: '',
					children: [{ label: '' }, { label: '' }]
				}
			]
		}
	},
	ai_prompt_log: {
		type: 'ai_prompt_log',
		title: 'AI prompt log',
		prompt: 'Record two prompt → output → critique cycles while drafting copy.',
		rounds: 2
	},
	media: {
		type: 'media',
		title: 'Find a CTA explainer',
		prompt: 'Search YouTube using the terms below, watch a short video, then note two CTAs you could use on a local business site.',
		medium: 'youtube',
		name: 'call to action website convert visitors',
		searchTerms: 'call to action website convert visitors',
		lines: 3,
		modelAnswer: 'Example CTAs: Book a table / Get a quote.'
	},
	prose: {
		type: 'prose',
		title: 'Notes (last resort)',
		prompt: 'Only when no other kind fits.',
		text: 'Use a structured kind whenever possible.',
		lines: 3
	}
};

export function exampleInputJson(kind: WorkbookActivityKind): string {
	return JSON.stringify(WORKBOOK_ACTIVITY_EXAMPLES[kind], null, 2);
}

export function catalogRowsForDemo() {
	return WORKBOOK_ACTIVITY_CATALOG.map((meta) => ({
		meta,
		example: WORKBOOK_ACTIVITY_EXAMPLES[meta.kind],
		json: exampleInputJson(meta.kind)
	}));
}
