import { createId, LESSON_ACTIVITY_MAX_MINUTES, LESSON_DURATION_MINUTES, LESSONS_PER_WEEK } from '$lib/defaults';
import { generateContentWithCascade } from '$lib/server/gemini';
import { getLevelPlan, getSettings, getUnitPlan } from '$lib/server/data';
import type {
	LessonActivity,
	LessonActivityStage,
	LessonEnhancePath,
	LessonGenerateRequest,
	LessonPlan
} from '$lib/types';
import { LESSON_REQUEST_TIMEOUT_MS, type GenerationUsage } from '$lib/gemini-models';
import {
	inferWorkbookKindFromText,
	parseMarkdownTableToWorkbook,
	parseWorkbookActivity,
	repairTableMatchDefine,
	workbookActivityFromLessonFields
} from '$lib/workbook/parse';
import {
	resolveWorkbookKind,
	WORKBOOK_ACTIVITY_KINDS,
	workbookCatalogPromptBlock,
	workbookChoosePassPrompt,
	type WorkbookActivity,
	type WorkbookActivityKind
} from '$lib/workbook/types';

const ACTIVITY_STAGES: LessonActivityStage[] = [
	'i-do',
	'we-do',
	'you-do',
	'vocabulary',
	'guided-notes',
	'generative'
];

const ENHANCE_PATHS: LessonEnhancePath[] = ['skill-building', 'knowledge-building'];

/** Real local stimuli — inject into prompts so [Link] / [Business Name] cannot appear. */
const YEPPOON_STIMULUS_BANK = {
	websites: [
		{
			name: 'Keppel Bay Marina',
			url: 'https://www.keppelbaymarina.com.au/',
			searchTerms: 'Keppel Bay Marina Yeppoon'
		},
		{
			name: 'Capricorn Coast Visitor Information',
			url: 'https://www.capricorncoast.com.au/',
			searchTerms: 'Capricorn Coast tourism Yeppoon'
		},
		{
			name: 'Yeppoon Seagulls Rugby League',
			url: 'https://www.yeppoonseagulls.com.au/',
			searchTerms: 'Yeppoon Seagulls RLFC'
		},
		{
			name: "St Brendan's College",
			url: 'https://www.stbrendans.qld.edu.au/',
			searchTerms: "St Brendan's College Yeppoon"
		},
		{
			name: 'Livingstone Shire Council',
			url: 'https://www.livingstone.qld.gov.au/',
			searchTerms: 'Livingstone Shire Council'
		}
	],
	youtube: [
		{
			topic: 'call to action website buttons convert visitors',
			searchTerms: 'call to action website convert visitors',
			note: 'Search YouTube for a short CTA explainer — do not invent a URL.'
		}
	]
};

const MATERIALS_REQUIREMENTS = `Concrete materials (mandatory — never leave these as named references only):
- Call it a "workbook" (never "digital workbook"). Hard copy or digital — the word is workbook.
- workbookKind: REQUIRED on every Enhance activity (generate + enrich). Follow the choose-pass decision tree. Prefer DigiTech kinds (user_story, sitemap, wireframe, media, flow, annotate), table, ranking, checklist, cloze, continuum, overlap, graphic, written. prose is almost never correct.
- workbookSpec: REQUIRED on enrich. JSON object with "type" equal to workbookKind and concrete printable content. NEVER put markdown pipe tables in workbookMaterials — those must be type "table" with locked/blank/tick cells. Ranking MUST use bank + empty slots. Cloze MUST use {{1}} in the sentence and a wordBank (answers may be listed in blank order — Word will scramble the bank on print). written 3-2-1 MUST use sections. For media youtube: searchTerms ONLY — never invent youtube.com / youtu.be URLs. For media website: use a real URL from stimulusBank.websites only.
- MATCH word↔definition tables: locked terms in column 1, blank Match column, AND bank: ["definition A", "definition B", …] with the SAME count as term rows. Both words and definitions must be in workbookSpec. Do not lock definitions into the grid — they belong in bank.
- DEFINE n terms: exactly n table rows (locked term + blank definition). "Define these 3 terms" → 3 rows, never 2.
- stimulus on workbookSpec: for websites use stimulusBank URLs; for YouTube give searchTerms only. Ban placeholders: [Link], [Business Name], [URL], "a local café website" without naming it.
- workbookMaterials: short editor caption only (optional). The printable widget is workbookSpec.
- studentsDo / visibleInstructions: student-facing only. Tell them what to fill/tick/compare. Do NOT tell them to write headers, checklist items, or labels that are already locked in workbookSpec. Do NOT put "Laptops down", "eyes up", "observe the modeling", or teacher movement notes in these fields — those belong in teacherDoes / eLearning only.
- teacherDoes: Delivery script + modelled examples (still generate; may be hidden on Word export).
- questioning: 2–4 inferential questions, each with an expected answer. Format like: "Why might…? Expected: … What if…? Expected: …" Do NOT write "Question, Pause, Name", "Pause", or "Name: [Student]".
- scaffolding: FULL lists/definitions students need (for vocabulary: write the actual definitions). Do not name an organiser ("Feature Checklist", "Venn") without also emitting that kind as workbookSpec.
- teacherAnswerKey: Complete worked answers matching workbookSpec as a plain STRING (e.g. "1. CTA\\n2. Lead generation"). Never an object.
- eLearning: optional classroom-management note for the teacher only. Do NOT invent standalone e-learning activities — tools appear inside the workbook activity when needed.
- Culminate smartFinish that is a 3-2-1 exit ticket must be mirrored as a written workbookSpec with sections on the last Enhance activity OR described so export can render sections — prefer a dedicated written activity with sections.
- Stage-gate tools: Do NOT mention GitHub Codespaces, AI prompt logs, or build-tool IDEs until the unit's build/prototype weeks. Investigation/requirements weeks use browser + workbook only.

Week stimulusBank (USE THESE — do not invent fake URLs; YouTube = search terms only):
${JSON.stringify(YEPPOON_STIMULUS_BANK, null, 2)}

${workbookChoosePassPrompt()}

Workbook kinds (${WORKBOOK_ACTIVITY_KINDS.join(', ')}):
${workbookCatalogPromptBlock()}`;

function usageFromResult(result: Awaited<ReturnType<typeof generateContentWithCascade>>): GenerationUsage {
	return {
		model: result.model,
		modelLabel: result.modelLabel,
		attemptedModels: result.attemptedModels,
		usedFallback: result.usedFallback
	};
}

function asString(value: unknown, fallback = ''): string {
	if (value == null) return fallback;
	if (typeof value === 'string') return value.trim() || fallback;
	if (typeof value === 'number' || typeof value === 'boolean') return String(value);
	if (Array.isArray(value)) {
		const joined = value
			.map((item) => asString(item))
			.filter(Boolean)
			.join('\n');
		return joined || fallback;
	}
	if (typeof value === 'object') {
		const o = value as Record<string, unknown>;
		// Common enrich shapes: { text }, { modelAnswer }, { answers: [...] }, { "1": "...", "2": "..." }
		if (typeof o.text === 'string' && o.text.trim()) return o.text.trim();
		if (typeof o.modelAnswer === 'string' && o.modelAnswer.trim()) return o.modelAnswer.trim();
		if (Array.isArray(o.answers)) return asString(o.answers, fallback);
		if (Array.isArray(o.blanks)) return asString(o.blanks, fallback);
		const entries = Object.entries(o)
			.map(([k, v]) => {
				const body = asString(v);
				return body ? `${k}: ${body}` : '';
			})
			.filter(Boolean);
		return entries.length ? entries.join('\n') : fallback;
	}
	return fallback;
}

function asMinutes(value: unknown, fallback = 10): number {
	const n = Number(value);
	if (!Number.isFinite(n) || n <= 0) return fallback;
	return Math.min(LESSON_ACTIVITY_MAX_MINUTES, Math.round(n));
}

function asStage(value: unknown, path: LessonEnhancePath): LessonActivityStage {
	const raw = asString(value).toLowerCase() as LessonActivityStage;
	if (ACTIVITY_STAGES.includes(raw)) return raw;
	return path === 'skill-building' ? 'we-do' : 'guided-notes';
}

function asEnhancePath(value: unknown, fallback: LessonEnhancePath = 'skill-building'): LessonEnhancePath {
	const raw = asString(value).toLowerCase() as LessonEnhancePath;
	if (ENHANCE_PATHS.includes(raw)) return raw;
	return fallback;
}

function normalizeActivity(
	raw: Record<string, unknown>,
	path: LessonEnhancePath,
	preserve?: LessonActivity
): LessonActivity {
	const pick = (key: keyof LessonActivity, fallback = ''): string => {
		const next = asString(raw[key as string]);
		// Discard corrupt stringify leftovers from earlier bugs
		if (next && next !== '[object Object]') return next;
		const prev = preserve?.[key];
		if (typeof prev === 'string' && prev && prev !== '[object Object]') return prev;
		return fallback;
	};

	const workbookKind: WorkbookActivityKind | undefined =
		resolveWorkbookKind(raw.workbookKind) ??
		preserve?.workbookKind ??
		inferWorkbookKindFromText(
			asString(raw.scaffolding),
			asString(raw.title),
			asString(raw.visibleInstructions),
			asString(raw.studentsDo),
			asString(raw.workbookMaterials)
		);

	let workbookSpec: WorkbookActivity | undefined =
		parseWorkbookActivity(raw.workbookSpec) ?? preserve?.workbookSpec;

	// Coerce leftover markdown pipe tables into real table specs
	if (!workbookSpec || (workbookSpec.type === 'prose' && workbookSpec.text.includes('|'))) {
		const fromMaterials = parseMarkdownTableToWorkbook(asString(raw.workbookMaterials));
		if (fromMaterials) workbookSpec = fromMaterials;
	}

	if (!workbookSpec) {
		workbookSpec = workbookActivityFromLessonFields({
			workbookSpec: undefined,
			workbookMaterials: raw.workbookMaterials ?? preserve?.workbookMaterials,
			workbookKind,
			scaffolding: asString(raw.scaffolding) || preserve?.scaffolding,
			title: asString(raw.title) || preserve?.title,
			visibleInstructions: asString(raw.visibleInstructions) || preserve?.visibleInstructions,
			studentsDo: asString(raw.studentsDo) || preserve?.studentsDo
		});
	}

	const resolvedKind: WorkbookActivityKind | undefined = workbookKind ?? workbookSpec?.type;

	const scrubWorkbook = (s: string) =>
		s
			.replace(/\bdigital workbooks?\b/gi, 'workbook')
			.replace(/\(?\s*Question\s*,?\s*Pause\s*,?\s*Name\s*[:.]?\s*\)?/gi, '')
			.replace(/\bPause\.?\s*Name:\s*\[[^\]]*\]\.?/gi, '')
			.replace(/\bPause\.?\s*Name:\s*[A-Za-z][A-Za-z\-']*\.?/gi, '');

	// timeLabel must be a clock range (e.g. "10:00–20:00"), not "I Do: Modeling"
	let timeLabel = scrubWorkbook(pick('timeLabel'));
	if (
		timeLabel &&
		!/\d{1,2}\s*[:.]\s*\d{2}/.test(timeLabel) &&
		/\b(i\s*do|we\s*do|you\s*do|vocabulary|guided|generative|model)/i.test(timeLabel)
	) {
		timeLabel = '';
	}

	const title = pick('title', 'Activity');
	if (workbookSpec?.type === 'table') {
		workbookSpec = repairTableMatchDefine(
			workbookSpec,
			[title, pick('studentsDo'), pick('visibleInstructions'), pick('scaffolding')].join('\n')
		);
	}

	return {
		id: preserve?.id || createId('lact'),
		minutes: asMinutes(raw.minutes, preserve?.minutes ?? 10),
		timeLabel,
		title,
		stage: asStage(raw.stage ?? preserve?.stage, path),
		teacherDoes: scrubWorkbook(pick('teacherDoes')),
		studentsDo: scrubWorkbook(pick('studentsDo')),
		visibleInstructions: scrubWorkbook(pick('visibleInstructions')),
		questioning: scrubWorkbook(pick('questioning')),
		scaffolding: scrubWorkbook(pick('scaffolding')),
		eLearning: scrubWorkbook(pick('eLearning')),
		transition: scrubWorkbook(pick('transition')),
		workbookKind: resolvedKind,
		workbookSpec,
		workbookMaterials: scrubWorkbook(pick('workbookMaterials')),
		teacherAnswerKey: scrubWorkbook(pick('teacherAnswerKey'))
	};
}

function toICanGoal(goal: string): string {
	const scrubbed = goal.replace(/\bdigital workbooks?\b/gi, 'workbook').replace(/\.$/, '').trim();
	if (!scrubbed) return '';
	if (/^i can\b/i.test(scrubbed)) return scrubbed.replace(/^i can/i, 'I can');
	return `I can ${scrubbed.charAt(0).toLowerCase()}${scrubbed.slice(1)}`;
}

function normalizeLesson(
	raw: Record<string, unknown>,
	lessonNumber: number,
	lastGenerated: string,
	forcedPath?: LessonEnhancePath,
	preserve?: LessonPlan,
	options: { enrich?: boolean } = {}
): LessonPlan {
	const enhancePath = forcedPath ?? asEnhancePath(raw.enhancePath, preserve?.enhancePath);
	const enhanceRaw =
		raw.enhance && typeof raw.enhance === 'object'
			? (raw.enhance as { activities?: unknown })
			: {};
	const activitiesRaw = Array.isArray(enhanceRaw.activities) ? enhanceRaw.activities : [];
	const orientateRaw =
		raw.orientate && typeof raw.orientate === 'object'
			? (raw.orientate as Record<string, unknown>)
			: {};
	const culminateRaw =
		raw.culminate && typeof raw.culminate === 'object'
			? (raw.culminate as Record<string, unknown>)
			: {};

	const existingActivities = preserve?.enhance?.activities ?? [];

	let activities: LessonActivity[];
	if (activitiesRaw.length === 0 && existingActivities.length > 0) {
		// Enrich/partial responses must not wipe existing enhance activities.
		activities = existingActivities.map((activity) => ({ ...activity }));
	} else {
		activities = activitiesRaw
			.filter((a): a is Record<string, unknown> => a != null && typeof a === 'object')
			.map((a, index) => normalizeActivity(a, enhancePath, existingActivities[index]));
		// If the model returned fewer activities than before, keep the remainder.
		if (options.enrich && activities.length < existingActivities.length) {
			activities = [
				...activities,
				...existingActivities.slice(activities.length).map((activity) => ({ ...activity }))
			];
		}
	}

	const pickLesson = (value: unknown, fallback = ''): string => {
		const next = asString(value);
		return next || fallback;
	};

	const scrub = (s: string) => s.replace(/\bdigital workbooks?\b/gi, 'workbook');
	const rawDisplay = pickLesson(
		orientateRaw.learningGoalDisplay,
		preserve?.orientate?.learningGoalDisplay || pickLesson(raw.learningGoal)
	);

	return {
		id: preserve?.id || createId('lesson'),
		lessonNumber,
		durationMinutes: LESSON_DURATION_MINUTES,
		title: scrub(pickLesson(raw.title, preserve?.title || `Lesson ${lessonNumber}`)),
		enhancePath,
		learningGoal: scrub(pickLesson(raw.learningGoal, preserve?.learningGoal ?? '')),
		orientate: {
			smartStart: scrub(pickLesson(orientateRaw.smartStart, preserve?.orientate?.smartStart ?? '')),
			learningGoalDisplay: toICanGoal(rawDisplay)
		},
		enhance: { activities },
		culminate: {
			smartFinish: scrub(pickLesson(culminateRaw.smartFinish, preserve?.culminate?.smartFinish ?? '')),
			summarise: scrub(pickLesson(culminateRaw.summarise, preserve?.culminate?.summarise ?? '')),
			nextSteps: scrub(pickLesson(culminateRaw.nextSteps, preserve?.culminate?.nextSteps ?? ''))
		},
		resources: scrub(pickLesson(raw.resources, preserve?.resources ?? '')),
		lastGenerated
	};
}

function parseLessonsJson(text: string): Record<string, unknown>[] {
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		const arrayMatch = text.match(/\[[\s\S]*\]/);
		const objectMatch = text.match(/\{[\s\S]*\}/);
		if (arrayMatch) {
			parsed = JSON.parse(arrayMatch[0]);
		} else if (objectMatch) {
			parsed = JSON.parse(objectMatch[0]);
		} else {
			throw new Error('Could not parse lesson response as JSON');
		}
	}

	if (Array.isArray(parsed)) {
		return parsed.filter((item): item is Record<string, unknown> => item != null && typeof item === 'object');
	}

	if (parsed && typeof parsed === 'object') {
		const obj = parsed as { lessons?: unknown; lesson?: unknown };
		if (Array.isArray(obj.lessons)) {
			return obj.lessons.filter(
				(item): item is Record<string, unknown> => item != null && typeof item === 'object'
			);
		}
		if (obj.lesson && typeof obj.lesson === 'object') {
			return [obj.lesson as Record<string, unknown>];
		}
	}

	throw new Error('Lesson response was not a JSON array of lessons');
}

function buildSystemInstruction(school: string, aiTone: string, mode: 'generate' | 'enrich'): string {
	const modeLine =
		mode === 'enrich'
			? 'You are enriching existing ASPIRE lesson plans with concrete classroom materials, student workbook artefacts, and teacher answer keys. Keep lesson structure and timing; expand materials fields only.'
			: 'You are an expert educational designer generating classroom lesson plans for Australian Curriculum / QCAA-aligned secondary subjects.';

	return `${modeLine}
School: ${school}
Tone and style: ${aiTone}
Use Australian English.
Respond with valid JSON only — no markdown fences, no commentary.

Act using the school's ASPIRE Teaching & Learning framework. Structure every lesson exactly according to the phases below and integrate the mandatory instructional strategies throughout.

Required Lesson Structure (60 minutes):
- Orientate (0–10 mins): Smart Start — a closed task for spaced retrieval or concept attainment requiring full student participation. Learning Goal — explicitly state the goal using a specific cognitive verb and the subject matter, visible to students.
- Enhance (10–50 mins): Deliver the Critical Input Experience using explicit instruction. Choose ONE path:
  1. skill-building — Gradual Release of Responsibility (I Do: focused instruction/modeling; We Do: guided practice/co-construction; You Do: independent practice). Activity stages: i-do, we-do, you-do.
  2. knowledge-building — Teach vocabulary, use guided notes, and include generative activities. Activity stages: vocabulary, guided-notes, generative.
  Chunk this phase so no single activity exceeds ${LESSON_ACTIVITY_MAX_MINUTES} minutes.
- Culminate (50–60 mins): Smart Finish — a specific task to gauge understanding from all students. Summarise — revisit the learning goal and main points. Inform students of next steps.

Mandatory Instructional Strategies & Routines:
- Task Chunking: break procedural tasks into small deconstructed parts; never exceed ${LESSON_ACTIVITY_MAX_MINUTES} minutes per activity.
- Clear Instructions: brief visibleInstructions for every verbal instruction (student-facing — no teacher-management jargon).
- Questioning Systems: 2–4 inferential questions each with an expected answer in the questioning field. Do NOT script "Question, Pause, Name" or "Name: [Student]".
- Scaffolding: sentence starters, full graphic-organiser content, definitions written out (scaffolding).
- E-Learning & Environment: put "laptops down" / "eyes up" / rear-of-room monitoring ONLY in teacherDoes or eLearning — never in studentsDo or visibleInstructions. Do not create separate e-learning activities.
- Transitions: link phases and pre-warn before changing activities (transition).
- learningGoalDisplay must be an "I can…" statement. learningGoal can be the teacher cognitive-verb form; the visible goal is I can…

${MATERIALS_REQUIREMENTS}`;
}

function activityFieldsList(): string {
	return `{ minutes, timeLabel (clock range only, e.g. "10:00–20:00" — NEVER "I Do" / "We Do" / stage names), title, stage ("i-do"|"we-do"|"you-do" OR "vocabulary"|"guided-notes"|"generative"), teacherDoes, studentsDo, visibleInstructions, questioning, scaffolding, eLearning, transition, workbookKind, workbookSpec, workbookMaterials, teacherAnswerKey }`;
}

export async function generateWeekLessons(request: LessonGenerateRequest) {
	const settings = await getSettings();
	const [levelPlan, unit] = await Promise.all([
		getLevelPlan(request.levelPlanId),
		getUnitPlan(request.levelPlanId, request.unitId)
	]);

	if (!levelPlan || !unit) throw new Error('Level plan or unit plan not found');

	const mode = request.mode === 'enrich' ? 'enrich' : 'generate';
	const singleLesson = request.lessonNumber != null && request.lessonNumber >= 1;
	const targetLessonNumber = singleLesson ? Number(request.lessonNumber) : null;
	const forcedPath = request.enhancePath;
	const existing = [...(request.existingLessons ?? [])].sort(
		(a, b) => a.lessonNumber - b.lessonNumber
	);

	if (mode === 'enrich' && existing.length === 0) {
		throw new Error('Enrich mode requires existingLessons for this week');
	}

	const unitTitle = request.unitSnapshot?.unitTitle ?? String(unit.unitTitle.value);
	const description = request.unitSnapshot?.description ?? String(unit.unitDescription.value);
	const assessments =
		request.unitSnapshot?.assessments ??
		unit.assessments.map((a) => ({
			title: String(a.title.value),
			description: String(a.description.value),
			timing: String(a.timing.value),
			technique: String(a.technique.value)
		}));

	const context = {
		targetUnit: {
			title: unitTitle,
			number: unit.unitNumber.value,
			description,
			yearLevel: unit.yearLevel.value,
			subject: unit.subject.value,
			assessments
		},
		band: {
			bandSubjectTitle: levelPlan.bandSubjectTitle.value,
			year: levelPlan.year.value
		},
		week: request.weekContext,
		nextWeekOutlineTheme: request.nextWeekOutlineTheme ?? '',
		priorLessons: request.priorLessons ?? [],
		existingLessons: existing,
		stimulusBank: YEPPOON_STIMULUS_BANK,
		constraints: {
			lessonsPerWeek: LESSONS_PER_WEEK,
			durationMinutes: LESSON_DURATION_MINUTES,
			maxActivityMinutes: LESSON_ACTIVITY_MAX_MINUTES
		}
	};

	let userPrompt: string;

	if (mode === 'enrich') {
		const scope = singleLesson
			? `Enrich exactly ONE lesson: lessonNumber ${targetLessonNumber}. Return a JSON array with that single enriched lesson.`
			: `Enrich all ${existing.length} existing lessons for week ${request.weekNumber}. Return a JSON array with the same lessonNumbers in order.`;

		userPrompt = `${scope}

This is a MATERIALS pass. Keep titles, enhancePath, timing, stages, workbookKind, and activity count aligned with existingLessons. Do not invent a different lesson arc.

For every activity, expand or rewrite these fields so nothing is a vague reference:
${MATERIALS_REQUIREMENTS}

For each activity, emit workbookSpec as a JSON object matching the activity's workbookKind (type field must equal workbookKind) with concrete content ready to print. NEVER emit markdown tables. Table cells MUST use mode locked|blank|tick. Ranking MUST use bank + empty slots. Cloze MUST use {{1}} blanks in the sentence. title = student-facing heading (never "Workbook task"). Include modelAnswer (teacher-only) and teacherAnswerKey with full definitions/answers. Website URLs only from stimulusBank; YouTube = searchTerms only (never invent youtube.com links). Say "workbook" not "digital workbook".

Also refresh teacherDoes and questioning so they include concrete modelled examples (teacherDoes) and multiple questions with expected answers (questioning) — no Pause/Name scripts — with full keys in teacherAnswerKey.

Preserve lessonNumber. Keep the same number of enhance.activities in the same order (match by index / title).

Each lesson object fields:
- lessonNumber, title, enhancePath, learningGoal
- orientate: { smartStart, learningGoalDisplay }
- enhance: { activities: [ ${activityFieldsList()} ] }
- culminate: { smartFinish, summarise, nextSteps }
- resources

User instructions:
${request.aiNotes || '(No specific instructions — fully flesh out materials and answer keys.)'}

Context:
${JSON.stringify(context, null, 2)}

Respond with valid JSON only.`;
	} else {
		const reviseNote =
			existing.length > 0 && request.aiNotes?.trim()
				? 'Existing lessons for this week are in existingLessons. Revise them using the user instructions; do not ignore the feedback or shrink content into stubs.'
				: existing.length > 0
					? 'Existing lessons for this week are in existingLessons — improve clarity and ASPIRE fidelity while keeping the same progression across the three lessons.'
					: '';

		const singleNote = singleLesson
			? `Generate exactly ONE lesson: lessonNumber ${targetLessonNumber} only. Return a JSON array with a single lesson object (or {"lessons":[...]} with one item).`
			: `Generate exactly ${LESSONS_PER_WEEK} lessons for week ${request.weekNumber}. Return a JSON array of ${LESSONS_PER_WEEK} lesson objects in order (lessonNumber 1, 2, 3). Distribute the week's theory and prac across the three lessons so together they cover the week's outlineTheme and weekly detail without repeating the same activity.`;

		const pathNote = forcedPath
			? `This lesson MUST use enhancePath "${forcedPath}".`
			: 'Choose enhancePath per lesson based on content (skill-building for prac/skill focus; knowledge-building for theory/concept focus). Mix paths across the week when appropriate.';

		userPrompt = `${singleNote}
${pathNote}
${reviseNote}

Each lesson object fields:
- lessonNumber (number)
- title (string)
- enhancePath ("skill-building" | "knowledge-building")
- learningGoal (string — cognitive verb + subject matter)
- orientate: { smartStart, learningGoalDisplay }
- enhance: { activities: [ ${activityFieldsList()} ] }
- culminate: { smartFinish, summarise, nextSteps }
- resources (string)

Enhance activities must fill ~40 minutes total (within 10–50), each activity ≤ ${LESSON_ACTIVITY_MAX_MINUTES} minutes, with appropriate stage values for the chosen path.
Every Enhance activity MUST include workbookKind from the decision tree (${WORKBOOK_ACTIVITY_KINDS.join(', ')}). prose is almost never correct. Do NOT invent freeform markdown tables — use workbookKind "table". workbookSpec may be a minimal stub on generate but MUST be a full object on enrich. learningGoalDisplay must start with "I can". Say "workbook" not "digital workbook". No Codespaces / AI logs in investigation weeks. No [Link] or [Business Name] — use stimulusBank.
Include concrete scaffolding lists and definitions, modelled examples in teacherDoes, sample answers in questioning, and full teacherAnswerKey entries for every activity.
Use priorLessons to avoid repeating learning goals/activities. Use nextWeekOutlineTheme for Culminate nextSteps when present.

User instructions:
${request.aiNotes || '(No specific instructions.)'}

Context:
${JSON.stringify(context, null, 2)}

Respond with valid JSON only.`;
	}

	const result = await generateContentWithCascade({
		contents: userPrompt,
		...(request.models?.length ? { models: request.models } : {}),
		config: {
			systemInstruction: buildSystemInstruction(settings.school, settings.aiTone, mode),
			maxOutputTokens: 16384,
			responseMimeType: 'application/json',
			timeoutMs: LESSON_REQUEST_TIMEOUT_MS
		}
	});

	const lastGenerated = new Date().toISOString();
	const parsed = parseLessonsJson(result.text);

	let lessons: LessonPlan[];
	if (singleLesson && targetLessonNumber != null) {
		const raw =
			parsed.find((p) => Number(p.lessonNumber) === targetLessonNumber) ?? parsed[0];
		if (!raw) throw new Error('No lesson returned');
		const preserve = existing.find((l) => l.lessonNumber === targetLessonNumber);
		const generated = normalizeLesson(
			raw,
			targetLessonNumber,
			lastGenerated,
			forcedPath,
			preserve,
			{ enrich: mode === 'enrich' }
		);
		if (existing.length === 0) {
			lessons = [generated];
		} else {
			lessons = existing.map((ex) =>
				ex.lessonNumber === targetLessonNumber ? generated : ex
			);
			if (!lessons.some((l) => l.lessonNumber === targetLessonNumber)) {
				lessons = [...lessons, generated].sort((a, b) => a.lessonNumber - b.lessonNumber);
			}
		}
	} else if (mode === 'enrich') {
		lessons = existing.map((ex, index) => {
			const raw =
				parsed.find((p) => Number(p.lessonNumber) === ex.lessonNumber) ?? parsed[index];
			if (!raw) return ex;
			return normalizeLesson(raw, ex.lessonNumber, lastGenerated, undefined, ex, {
				enrich: true
			});
		});
		if (lessons.length === 0) {
			throw new Error('Enrich mode produced no lessons');
		}
	} else {
		lessons = parsed.slice(0, LESSONS_PER_WEEK).map((raw, index) =>
			normalizeLesson(raw, index + 1, lastGenerated, undefined, existing[index])
		);
		while (lessons.length < LESSONS_PER_WEEK) {
			const n = lessons.length + 1;
			lessons.push(
				normalizeLesson(
					{ title: `Lesson ${n}`, enhancePath: 'skill-building', enhance: { activities: [] } },
					n,
					lastGenerated
				)
			);
		}
	}

	return {
		weekNumber: request.weekNumber,
		lessons,
		mode,
		lastGenerated,
		...usageFromResult(result)
	};
}
