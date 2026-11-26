/**
 * Workbook response presets — one kind per distinct print job.
 * Generate (choose) pass picks a kind; enrich emits a full WorkbookActivity JSON.
 */

/** Canonical kinds (choose-pass may only pick these). */
export const WORKBOOK_ACTIVITY_KINDS = [
	'table',
	'written',
	'ranking',
	'checklist',
	'cloze',
	'continuum',
	'overlap',
	'graphic',
	'wireframe',
	'user_story',
	'sitemap',
	'ai_prompt_log',
	'flow',
	'code',
	'storyboard',
	'annotate',
	'sort',
	'media',
	'prose'
] as const;

export type WorkbookActivityKind = (typeof WORKBOOK_ACTIVITY_KINDS)[number];

/** Legacy kind ids still accepted when parsing stored / AI JSON. */
export const WORKBOOK_LEGACY_KIND_MAP: Record<string, WorkbookActivityKind> = {
	list: 'written',
	sentence: 'written',
	long: 'written',
	exit_ticket: 'written',
	matrix: 'table',
	match: 'table',
	labeling: 'table',
	compare: 'table',
	venn: 'overlap'
};

export type WorkbookCellMode = 'locked' | 'blank' | 'tick';

/** Table cell: locked = given text; blank = write-on; tick = checkbox. */
export interface WorkbookCell {
	value?: string;
	mode: WorkbookCellMode;
}

export interface WorkbookActivityMeta {
	kind: WorkbookActivityKind;
	label: string;
	whenToUse: string;
	whenNotToUse: string;
	/** Typical minutes for the student response (choose-pass hint). */
	minutes: number;
	/** Solo / pair / either. */
	grouping: 'solo' | 'pair' | 'either';
}

export const WORKBOOK_ACTIVITY_CATALOG: WorkbookActivityMeta[] = [
	{
		kind: 'table',
		label: 'Table',
		whenToUse:
			'Classification/audits (locked items + tick columns). MATCH word↔definition: locked terms in column 1, blank Match column, AND a bank array of every definition (same count — both words and definitions must print). DEFINE n terms: n rows of locked term + blank definition (if the heading says 3 terms, emit 3 rows).',
		whenNotToUse: 'Do not use for a single paragraph answer or a blank sketch.',
		minutes: 8,
		grouping: 'either'
	},
	{
		kind: 'written',
		label: 'Written response',
		whenToUse:
			'Numbered reasons, short sentences, long justifications, 3-2-1 exit tickets — lines with optional starter/sections.',
		whenNotToUse: 'Do not use when the response is a filled table, tick list, or diagram.',
		minutes: 6,
		grouping: 'solo'
	},
	{
		kind: 'ranking',
		label: 'Ranking',
		whenToUse: 'Students order a scrambled item bank into blank numbered slots.',
		whenNotToUse: 'Do not pre-order items on the sheet — that is not ranking.',
		minutes: 5,
		grouping: 'solo'
	},
	{
		kind: 'sort',
		label: 'Sort into buckets',
		whenToUse: 'Drop a scrambled bank into named piles/buckets (not a tick-grid).',
		whenNotToUse: 'Prefer table with tick columns when there are few columns and clear categories.',
		minutes: 6,
		grouping: 'either'
	},
	{
		kind: 'checklist',
		label: 'Checklist',
		whenToUse: 'Tick feature presence, success criteria, or procedural steps.',
		whenNotToUse: 'Do not use for open written answers.',
		minutes: 4,
		grouping: 'either'
	},
	{
		kind: 'cloze',
		label: 'Cloze',
		whenToUse: 'Guided notes: students fill blanks inside an English sentence.',
		whenNotToUse: 'Do not use for code holes — use code. Free sentences → written.',
		minutes: 4,
		grouping: 'solo'
	},
	{
		kind: 'continuum',
		label: 'Scale',
		whenToUse: 'Rate quality/effectiveness on a numbered tick scale, then justify.',
		whenNotToUse: 'Do not use without scale points — vibes-only arrows are not enough.',
		minutes: 5,
		grouping: 'solo'
	},
	{
		kind: 'overlap',
		label: 'Overlap compare',
		whenToUse: 'Only-A / both / only-B compare (Word-safe “Venn” regions).',
		whenNotToUse: 'Do not call this a drawn Venn; use table if you need a multi-column grid.',
		minutes: 6,
		grouping: 'pair'
	},
	{
		kind: 'graphic',
		label: 'Sketch space',
		whenToUse: 'Open sketch/mind-map with must-include labels (not a bare empty box).',
		whenNotToUse: 'Prefer wireframe for UI; storyboard for multi-frame journeys; annotate for callouts on a figure.',
		minutes: 8,
		grouping: 'solo'
	},
	{
		kind: 'wireframe',
		label: 'Wireframe stencil',
		whenToUse: 'UI layout with faint browser chrome / labelled regions to complete.',
		whenNotToUse: 'Do not use a blank box — Year 8 will draw a logo and stall.',
		minutes: 10,
		grouping: 'solo'
	},
	{
		kind: 'storyboard',
		label: 'Storyboard',
		whenToUse: '4–6 equal frames (user journey, arcade loop, before → during → after).',
		whenNotToUse: 'wireframe is one screen; graphic is one blob; flow is stages/arrows not frames.',
		minutes: 10,
		grouping: 'solo'
	},
	{
		kind: 'flow',
		label: 'Flow / journey',
		whenToUse:
			'Numbered stages with arrows; optional Yes/No branch. User journeys, algorithms, “what happens when they click Book”.',
		whenNotToUse: 'Not sitemap (tree), not ranking (permute a bank), not written (sentences).',
		minutes: 8,
		grouping: 'either'
	},
	{
		kind: 'code',
		label: 'Code snippet',
		whenToUse: 'Monospaced snippet with line numbers, {{1}} holes, or “circle the bug”.',
		whenNotToUse: 'Cloze is English sentences — use code for HTML / CSS / JS / Arduino.',
		minutes: 8,
		grouping: 'solo'
	},
	{
		kind: 'annotate',
		label: 'Annotate figure',
		whenToUse:
			'Numbered callouts + legend (“1 is the CTA because…”). Screenshot on sheet or figure on the projector.',
		whenNotToUse: 'graphic can’t do numbered callouts on a live-site figure.',
		minutes: 8,
		grouping: 'solo'
	},
	{
		kind: 'user_story',
		label: 'User story frame',
		whenToUse: 'As a … I want … so that … (DigiTech requirements).',
		whenNotToUse: 'Do not dump this as prose without the three stems.',
		minutes: 6,
		grouping: 'solo'
	},
	{
		kind: 'sitemap',
		label: 'Site map / hierarchy',
		whenToUse: 'Page hierarchy as a parent→children tree (Home → sections → pages).',
		whenNotToUse: 'Do not emit flat sibling lists — nest children under parents.',
		minutes: 8,
		grouping: 'either'
	},
	{
		kind: 'ai_prompt_log',
		label: 'AI prompt log',
		whenToUse: 'Record prompt → output → critique/refine when using generative AI.',
		whenNotToUse: 'Do not use for non-AI tasks.',
		minutes: 8,
		grouping: 'solo'
	},
	{
		kind: 'media',
		label: 'YouTube / website',
		whenToUse:
			'Send students to find a YouTube video or website. Print search terms only for YouTube (never invent URLs). Websites may include a real URL from the stimulus bank.',
		whenNotToUse: 'Do not invent youtube.com links. Do not use for in-app artefacts (wireframe, code, table).',
		minutes: 8,
		grouping: 'solo'
	},
	{
		kind: 'prose',
		label: 'Prose (last resort)',
		whenToUse: 'Almost never — only if no other kind can represent the artefact.',
		whenNotToUse: 'Default away from this. Prefer table, written, DigiTech, or flow/code/storyboard/annotate.',
		minutes: 5,
		grouping: 'solo'
	}
];

/** Minimum write-on lines for a sentence-length student response. */
export const WRITE_LINES_PER_SENTENCE = 3;

interface WorkbookBase {
	/** Student-facing heading (not the filler phrase "Workbook task"). */
	title?: string;
	/** Instruction under the title. */
	prompt?: string;
	/**
	 * Locked stimulus above the widget (scenario, URL, “watch the board”).
	 * Not a kind — sits above any activity so you don’t invent prose just for the case study.
	 */
	stimulus?: string;
	/** Teacher-only model answers — never printed on the student sheet. */
	modelAnswer?: string;
}

export interface WorkbookTable extends WorkbookBase {
	type: 'table';
	headers: string[];
	/** Row-major cells. Prefer WorkbookCell objects; bare strings = locked if non-empty else blank. */
	rows: WorkbookCell[][];
	/**
	 * Scrambled match bank printed above the grid (definitions for a term-match).
	 * Same length as the number of term rows. Students write A/B/C in the Match column.
	 */
	bank?: string[];
}

export interface WorkbookWritten extends WorkbookBase {
	type: 'written';
	/**
	 * When numbered: number of items. When not: total write-on lines.
	 * Ignored when `sections` is set. Each sentence-length response prints WRITE_LINES_PER_SENTENCE lines.
	 */
	lines?: number;
	/** Optional starter printed once above the lines. */
	starter?: string;
	/** If true, number the items 1..lines (each item gets multiple write-on lines). */
	numbered?: boolean;
	/** Optional labeled sections (e.g. 3-2-1); each has its own item/line count. */
	sections?: Array<{ label: string; lines: number }>;
}

export interface WorkbookRanking extends WorkbookBase {
	type: 'ranking';
	/** Items shown as a scrambled bank (never pre-ordered on the sheet). */
	bank: string[];
	/** Empty numbered slots students fill (usually = bank.length). */
	slots: number;
	directionLabel?: string;
}

export interface WorkbookSort extends WorkbookBase {
	type: 'sort';
	bank: string[];
	buckets: string[];
	/** Write-on lines per bucket. */
	linesPerBucket?: number;
}

export interface WorkbookChecklist extends WorkbookBase {
	type: 'checklist';
	items: string[];
}

export interface WorkbookCloze extends WorkbookBase {
	type: 'cloze';
	/** Passage with blanks as {{1}}, {{2}}, … (filled in-sentence). */
	text: string;
	wordBank?: string[];
}

export interface WorkbookContinuum extends WorkbookBase {
	type: 'continuum';
	left: string;
	right: string;
	/** Scale points (default 5). */
	scale: number;
	/** Justification lines under the scale (default 3). */
	lines?: number;
}

export interface WorkbookOverlap extends WorkbookBase {
	type: 'overlap';
	leftLabel: string;
	rightLabel: string;
	/** Lines per region (only-left / both / only-right). */
	lines: number;
}

export interface WorkbookGraphic extends WorkbookBase {
	type: 'graphic';
	/** Labels the sketch must include. */
	mustInclude: string[];
	heightInches?: number;
}

export interface WorkbookWireframe extends WorkbookBase {
	type: 'wireframe';
	mustInclude: string[];
	/** Stencil regions shown faintly. */
	regions?: Array<{ label: string }>;
	heightInches?: number;
}

export interface WorkbookStoryboard extends WorkbookBase {
	type: 'storyboard';
	/** Frame captions (4–6). Empty caption = blank frame label. */
	frames: Array<{ label?: string }>;
	/** Write-on lines under each frame sketch. */
	linesPerFrame?: number;
}

export interface WorkbookFlow extends WorkbookBase {
	type: 'flow';
	/** Linear stages before any branch (and the full flow if there is no branch). */
	stages: Array<{ label?: string; blank?: boolean }>;
	/** Optional Yes/No branch after a stage index (0-based) in `stages`. */
	branchAfter?: number;
	yesLabel?: string;
	noLabel?: string;
	/** Parallel next step on the Yes path (not a shared numbered stage). */
	yesPath?: { label?: string; blank?: boolean };
	/** Parallel next step on the No path. */
	noPath?: { label?: string; blank?: boolean };
	/** Optional stage after both paths rejoin (not numbered as orphan of one branch). */
	rejoin?: { label?: string; blank?: boolean };
}

export interface WorkbookCode extends WorkbookBase {
	type: 'code';
	/** Source lines; use {{1}} holes when mode is fill_holes. */
	lines: string[];
	/** fill_holes | circle_bug */
	mode?: 'fill_holes' | 'circle_bug';
	/** Teacher/editor only — not printed on the student sheet. */
	language?: string;
}

export interface WorkbookAnnotate extends WorkbookBase {
	type: 'annotate';
	/** How many numbered callouts. */
	callouts: number;
	/** Optional figure caption / “see projector”. */
	figureHint?: string;
	/** Lines per legend row. */
	linesPerCallout?: number;
}

export interface WorkbookUserStory extends WorkbookBase {
	type: 'user_story';
	/** Optional partially filled stems. */
	role?: string;
	want?: string;
	soThat?: string;
}

/** Nested IA node: parent → children (not flat sibling rows). */
export interface WorkbookSitemapNode {
	/** Locked label; omit or "" for a blank write-in. */
	label?: string;
	/**
	 * Nested children, or a number meaning N blank child slots under this node.
	 * Prefer nested objects when some children are labelled.
	 */
	children?: WorkbookSitemapNode[] | number;
}

export interface WorkbookSitemap extends WorkbookBase {
	type: 'sitemap';
	root: WorkbookSitemapNode;
}

export interface WorkbookAiPromptLog extends WorkbookBase {
	type: 'ai_prompt_log';
	/** Number of prompt/response/critique cycles. */
	rounds: number;
}

export interface WorkbookMedia extends WorkbookBase {
	type: 'media';
	/** youtube | website */
	medium: 'youtube' | 'website';
	/** Topic / suggested video or page name (not the activity heading — that is `title`). */
	name: string;
	/** Optional channel / creator hint for YouTube search. */
	creator?: string;
	/**
	 * Full URL — websites only when taken from the real stimulus bank.
	 * Never invent YouTube URLs; leave empty and use searchTerms instead.
	 */
	url?: string;
	/**
	 * What to search for. YouTube: topic (+ optional creator). Website: site/page name.
	 * If omitted: YouTube = "name — creator"; website = name.
	 */
	searchTerms?: string;
	/** Note-taking lines under the find-prompt (default 3). */
	lines?: number;
}

export interface WorkbookProse extends WorkbookBase {
	type: 'prose';
	text: string;
	lines?: number;
}

export type WorkbookActivity =
	| WorkbookTable
	| WorkbookWritten
	| WorkbookRanking
	| WorkbookSort
	| WorkbookChecklist
	| WorkbookCloze
	| WorkbookContinuum
	| WorkbookOverlap
	| WorkbookGraphic
	| WorkbookWireframe
	| WorkbookStoryboard
	| WorkbookFlow
	| WorkbookCode
	| WorkbookAnnotate
	| WorkbookUserStory
	| WorkbookSitemap
	| WorkbookAiPromptLog
	| WorkbookMedia
	| WorkbookProse;

export function resolveWorkbookKind(value: unknown): WorkbookActivityKind | undefined {
	const raw = String(value ?? '')
		.trim()
		.toLowerCase()
		.replace(/-/g, '_');
	if ((WORKBOOK_ACTIVITY_KINDS as readonly string[]).includes(raw)) {
		return raw as WorkbookActivityKind;
	}
	return WORKBOOK_LEGACY_KIND_MAP[raw];
}

export function isWorkbookActivityKind(value: unknown): value is WorkbookActivityKind {
	const raw = String(value ?? '')
		.trim()
		.toLowerCase()
		.replace(/-/g, '_');
	return (WORKBOOK_ACTIVITY_KINDS as readonly string[]).includes(raw);
}

/** Flat catalog lines for prompts. */
export function workbookCatalogPromptBlock(): string {
	return WORKBOOK_ACTIVITY_CATALOG.map(
		(row) =>
			`- ${row.kind}: ${row.label} — USE: ${row.whenToUse} — NOT: ${row.whenNotToUse} (${row.minutes} min, ${row.grouping})`
	).join('\n');
}

const KIND_ENRICH_SHAPE: Record<WorkbookActivityKind, string> = {
	table: `{"type":"table","title","prompt","stimulus?","modelAnswer","headers":[string],"rows":[[{"value?","mode":"locked"|"blank"|"tick"}]],"bank"?:[string]}
MATCH: headers ["Term","Match"]; each row locked term + blank Match; bank = every definition (same count as rows).
DEFINE n terms: headers ["Term","Definition"]; exactly n rows locked term + blank definition.`,
	written: `{"type":"written","title","prompt","stimulus?","modelAnswer","lines"?,"starter"?,"numbered"?,"sections"?[{"label","lines"}]}
3-2-1 exit tickets MUST use sections, not a flat numbered list.`,
	ranking: `{"type":"ranking","title","prompt","modelAnswer","bank":[string],"slots":number,"directionLabel"?}
bank is scrambled on print; slots are empty — never pre-order items.`,
	sort: `{"type":"sort","title","prompt","modelAnswer","bank":[string],"buckets":[string],"linesPerBucket"?}`,
	checklist: `{"type":"checklist","title","prompt","modelAnswer","items":[string]}`,
	cloze: `{"type":"cloze","title","prompt","modelAnswer","text":"sentence with {{1}} {{2}} holes","wordBank"?:[string]}
Answers may be listed in blank order — Word scrambles the bank on print.`,
	continuum: `{"type":"continuum","title","prompt","modelAnswer","left","right","scale":number,"lines"?}`,
	overlap: `{"type":"overlap","title","prompt","modelAnswer","leftLabel","rightLabel","lines":number}`,
	graphic: `{"type":"graphic","title","prompt","modelAnswer","mustInclude":[string],"heightInches"?}`,
	wireframe: `{"type":"wireframe","title","prompt","modelAnswer","mustInclude":[string],"regions"?[{"label"}],"heightInches"?}`,
	storyboard: `{"type":"storyboard","title","prompt","modelAnswer","frames":[{"label"?}],"linesPerFrame"?}
4–6 frames.`,
	flow: `{"type":"flow","title","prompt","modelAnswer","stages":[{"label"?,"blank"?}],"branchAfter"?,"yesLabel"?,"noLabel"?,"yesPath"?,"noPath"?,"rejoin"?}`,
	code: `{"type":"code","title","prompt","modelAnswer","lines":[string],"mode"?:"fill_holes"|"circle_bug","language"?}
Use {{1}} holes when mode is fill_holes.`,
	annotate: `{"type":"annotate","title","prompt","modelAnswer","callouts":number,"figureHint"?,"linesPerCallout"?}`,
	user_story: `{"type":"user_story","title","prompt","modelAnswer","role"?,"want"?,"soThat"?}`,
	sitemap: `{"type":"sitemap","title","prompt","modelAnswer","root":{"label"?,"children":[node]|number}}
Nest children under parents — not a flat sibling list.`,
	ai_prompt_log: `{"type":"ai_prompt_log","title","prompt","modelAnswer","rounds":number}`,
	media: `{"type":"media","title","prompt","modelAnswer","medium":"youtube"|"website","name","creator"?,"url"?,"searchTerms"?,"lines"?}
youtube: searchTerms ONLY — never invent youtube.com URLs. website: url only from stimulusBank.`,
	prose: `{"type":"prose","title","prompt","modelAnswer","text","lines"?}
Almost never correct — only if no other kind fits.`
};

/** Kind-specific enrich snippet (one activity). */
export function workbookKindEnrichPrompt(kind: WorkbookActivityKind): string {
	const row = WORKBOOK_ACTIVITY_CATALOG.find((item) => item.kind === kind);
	const use = row
		? `${row.label} — USE: ${row.whenToUse} — NOT: ${row.whenNotToUse}`
		: kind;
	return `workbookKind is "${kind}". workbookSpec.type MUST be "${kind}".
${use}
Shape:
${KIND_ENRICH_SHAPE[kind]}`;
}

/**
 * Choose-pass decision tree — prefer structured kinds; prose is last resort.
 */
export function workbookChoosePassPrompt(): string {
	return `Choose workbookKind using this decision tree (do NOT default to prose):
1. DigiTech artefact?
   - User story (As a / I want / so that) → user_story
   - Page hierarchy as nested parent→children → sitemap
   - UI layout with regions to complete → wireframe
   - Multi-frame journey / arcade loop / before-during-after → storyboard (2×2 or 3×2 grid)
   - Stages with arrows / Yes-No branch then rejoin → flow
   - Code/HTML/CSS/JS/Arduino with holes or circle-the-bug → code
   - Numbered callouts on a screenshot / projector figure → annotate
   - Logging generative-AI prompt → output → critique → ai_prompt_log
   - Find a YouTube video or website (search terms; real website URL only from stimulusBank — never invent YouTube URLs) → media
2. Need a grid (classify, match/define, label, compare columns)? → table
   MATCH a word to a definition (mandatory layout — both sides must appear on the sheet):
     headers ["Term", "Match"]
     rows: one locked term per row; Match cell mode "blank" (student writes A/B/C)
     bank: EVERY definition, same count as rows (Word will scramble the bank)
     NEVER print terms without the definition bank. NEVER print definitions without the terms.
     If you already know both columns, put terms in rows and definitions in bank — do not lock both columns.
   DEFINE n terms (students write definitions):
     headers ["Term", "Definition"]
     exactly n rows: locked term + blank definition. If the title says "3 terms", emit 3 rows, not 2.
   Other grids: given text = locked; write-on = blank; checkboxes = tick.
3. Drop many items into named piles (tick-grid feels wrong)? → sort
4. Need students to order a set of items? → ranking
   (Provide a bank to scramble; slots are empty — never print items already ranked.)
5. Tick list of criteria/features? → checklist
6. Fill missing words inside an English sentence? → cloze
7. Rate on a numbered scale then justify? → continuum
8. Only-A / both / only-B compare? → overlap
9. Open sketch with required labels (not UI chrome)? → graphic
10. Numbered reasons / short or long writing / 3-2-1 sections? → written
    (For 3-2-1 use sections: [{label, lines}, …] — not a flat numbered list.)
11. Nothing else fits → prose (rare)

Rules:
- title must be the student-facing heading for THIS task (never the filler "Workbook task").
- Use stimulus for locked scenario / “watch the board” above any kind — do not invent prose just to print the case study.
- For media youtube: searchTerms only (topic the teacher/student should search). Never invent youtube.com URLs.
- For media website: use a real URL from stimulusBank when available; otherwise searchTerms only.
- Do not leave placeholders like [Business Name] — use a concrete example or a blank locked stem.
- Sentence-length answers need ~3 write-on lines (lines field / defaults handle this).
- workbookSpec.type must equal workbookKind.
- Prefer existing kinds — do not invent new kinds beyond the catalog.
- modelAnswer is teacher-only (enrich); never print it on the student sheet.
- questioning: multiple questions each with an expected answer. Do NOT write "Pause", "Name: [Student]", or "Question, Pause, Name".`;
}
