import { generateContentWithCascade } from '$lib/server/gemini';
import {
	getAssessmentItem,
	getLevelPlan,
	getSettings,
	getUnitPlan
} from '$lib/server/data';
import {
	formatGenerationExamples,
	loadGenerationExamples
} from '$lib/server/generation-examples';
import type { ChunkGenerateRequest, ChunkTeachingWeekContext, GenerateRequest, LevelPlan, UnitPlan } from '$lib/types';
import type { GenerationUsage } from '$lib/gemini-models';

function summarizeLevelPlan(plan: LevelPlan) {
	return {
		bandSubjectTitle: plan.bandSubjectTitle.value,
		year: plan.year.value,
		levelDescription: plan.levelDescription.value,
		context: plan.contextAndCohortConsiderations.value,
		units: plan.units.map((u) => ({
			title: u.unitTitle.value,
			yearLevel: u.yearLevel.value,
			duration: u.duration.value,
			description: u.description.value,
			assessments: u.assessments.map((a) => ({
				number: a.assessmentNumber.value,
				title: a.title.value,
				term: a.term.value,
				week: a.week.value
			}))
		}))
	};
}

/** Band context for unit-scoped generation — excludes sibling unit topics/assessments. */
function summarizeLevelPlanForUnit(plan: LevelPlan, unit: UnitPlan) {
	const unitTitle = String(unit.unitTitle.value).trim();
	return {
		bandSubjectTitle: plan.bandSubjectTitle.value,
		year: plan.year.value,
		levelDescription: plan.levelDescription.value,
		context: plan.contextAndCohortConsiderations.value,
		otherUnitsInBand: plan.units
			.filter((u) => String(u.unitTitle.value).trim() !== unitTitle)
			.map((u) => ({
				title: u.unitTitle.value,
				yearLevel: u.yearLevel.value,
				duration: u.duration.value
			}))
	};
}

function summarizeUnitPlanForChunk(
	unit: UnitPlan,
	extras: Record<string, unknown> = {},
	snapshot?: ChunkGenerateRequest['unitSnapshot']
) {
	return {
		unitTitle: snapshot?.unitTitle ?? unit.unitTitle.value,
		unitNumber: unit.unitNumber.value,
		yearLevel: unit.yearLevel.value,
		subject: unit.subject.value,
		startWeek: unit.startWeek.value,
		finishWeek: unit.finishWeek.value,
		duration: unit.duration?.value ?? '',
		description: snapshot?.description ?? unit.unitDescription.value,
		cohort: unit.cohortAndClassConsiderations.value,
		assessments:
			snapshot?.assessments ??
			unit.assessments.map((a) => ({
				title: a.title.value,
				description: a.description.value,
				timing: a.timing.value,
				technique: a.technique.value
			})),
		...extras
	};
}

function summarizeUnitPlan(unit: UnitPlan) {
	return {
		unitTitle: unit.unitTitle.value,
		unitNumber: unit.unitNumber.value,
		yearLevel: unit.yearLevel.value,
		subject: unit.subject.value,
		startWeek: unit.startWeek.value,
		finishWeek: unit.finishWeek.value,
		duration: unit.duration?.value ?? '',
		description: unit.unitDescription.value,
		cohort: unit.cohortAndClassConsiderations.value,
		assessments: unit.assessments.map((a) => ({
			title: a.title.value,
			description: a.description.value,
			timing: a.timing.value,
			technique: a.technique.value
		})),
		teachingOutline: unit.teachingSequence.map((w) => ({
			week: w.week.value,
			outlineTheme: w.outlineTheme?.value,
			theory: w.theory.value,
			prac: w.prac.value
		}))
	};
}

export async function buildGenerationContext(
	request: GenerateRequest
): Promise<Record<string, unknown>> {
	const settings = await getSettings();
	const context: Record<string, unknown> = {
		school: settings.school,
		aiTone: settings.aiTone
	};

	if (request.docType === 'level-plan') {
		const plan = await getLevelPlan(request.docId);
		if (plan) context.levelPlan = summarizeLevelPlan(plan);
	}

	if (request.docType === 'unit-plan' && request.levelPlanId) {
		const [levelPlan, unit] = await Promise.all([
			getLevelPlan(request.levelPlanId),
			getUnitPlan(request.levelPlanId, request.docId)
		]);
		if (levelPlan && unit) context.levelPlan = summarizeLevelPlanForUnit(levelPlan, unit);
		if (unit) context.unitPlan = summarizeUnitPlan(unit);
	}

	if (request.docType === 'assessment-item') {
		const item = await getAssessmentItem(request.docId);
		if (item) {
			const [levelPlan, unit] = await Promise.all([
				getLevelPlan(item.levelPlanId),
				getUnitPlan(item.levelPlanId, item.unitPlanId)
			]);
			if (levelPlan && unit) context.levelPlan = summarizeLevelPlanForUnit(levelPlan, unit);
			if (unit) context.unitPlan = summarizeUnitPlan(unit);
			context.assessmentItem = {
				title: item.title.value,
				description: item.description.value,
				technique: item.technique.value,
				mode: item.mode.value,
				task: item.task.value,
				context: item.context.value,
				conditions: item.conditions.value,
				selectedContentDescriptions: item.contentDescriptions
					.filter((cd) => cd.selected)
					.map((cd) => ({
						code: cd.code.value,
						text: cd.text.value,
						strand: cd.strand.value
					}))
			};
		}
	}

	return context;
}

function redactGeneratingField(
	context: Record<string, unknown>,
	fieldPath: string
): Record<string, unknown> {
	const clone = structuredClone(context);
	const leaf = fieldPath.includes('.') ? fieldPath.split('.').pop()! : fieldPath;

	const assessmentItem = clone.assessmentItem;
	if (assessmentItem && typeof assessmentItem === 'object') {
		const item = assessmentItem as Record<string, unknown>;
		if (leaf in item) {
			item[leaf] = '(omitted — this is the field being generated; see Current content)';
		}
	}

	const unitPlan = clone.unitPlan;
	if (unitPlan && typeof unitPlan === 'object') {
		const unit = unitPlan as Record<string, unknown>;
		const unitKey =
			leaf === 'unitDescription' ? 'description' : leaf === 'cohortAndClassConsiderations' ? 'cohort' : leaf;
		if (unitKey in unit && typeof unit[unitKey] === 'string') {
			unit[unitKey] = '(omitted — this is the field being generated; see Current content)';
		}

		const weekMatch = fieldPath.match(/^teachingSequence\.(\d+)\.(\w+)$/);
		if (weekMatch && Array.isArray(unit.teachingOutline)) {
			const idx = Number(weekMatch[1]);
			const weekField = weekMatch[2];
			const row = unit.teachingOutline[idx];
			if (row && typeof row === 'object' && weekField in row) {
				(row as Record<string, unknown>)[weekField] =
					'(omitted — this is the field being generated; see Current content)';
			}
		}
	}

	const levelPlan = clone.levelPlan;
	if (levelPlan && typeof levelPlan === 'object') {
		const plan = levelPlan as Record<string, unknown>;
		const levelKey = leaf === 'contextAndCohortConsiderations' ? 'context' : leaf;
		if (levelKey in plan && typeof plan[levelKey] === 'string') {
			plan[levelKey] = '(omitted — this is the field being generated; see Current content)';
		}
	}

	return clone;
}

function normalizeGeneratedText(text: string): string {
	return text.replace(/\r\n/g, '\n').trim();
}

function textsEffectivelySame(a: string, b: string): boolean {
	return normalizeGeneratedText(a) === normalizeGeneratedText(b);
}

function buildSystemPrompt(settings: Awaited<ReturnType<typeof getSettings>>, docType: string) {
	return `You are an expert Australian curriculum writer for QCAA-aligned faculty planning documents.
School: ${settings.school}
Tone and style: ${settings.aiTone}
Document type: ${docType}
Write only the requested field content. Do not include headings, labels, or markdown unless appropriate for the field.
Use Australian English.
When reference examples are provided, treat them as length and tone guides only — never reuse their topics, technologies, or assessment content.
When revising existing content, you must apply the user instructions and return changed text — never echo the current content unchanged.`;
}

function buildUserPrompt(
	request: GenerateRequest,
	context: Record<string, unknown>,
	examplesText: string,
	options?: { forceChange?: boolean }
) {
	const improving = request.currentValue.trim().length > 0;
	const hasNotes = request.aiNotes.trim().length > 0;
	const safeContext = redactGeneratingField(context, request.fieldPath);

	let task: string;
	if (!improving) {
		task = 'Generate new content for this field.';
	} else if (hasNotes) {
		task =
			'Revise the existing content. You MUST apply the user instructions below. Do NOT return the current content unchanged — produce a clearly revised version that reflects those instructions.';
	} else {
		task =
			'Improve the existing content for clarity, curriculum alignment, and professional tone. Make meaningful edits — do not return the text unchanged.';
	}

	if (options?.forceChange) {
		task +=
			' CRITICAL: Your previous reply was identical to the current content. That is not acceptable. Rewrite the field so the user instructions are visibly applied.';
	}

	return `Field: ${request.fieldLabel}
Task: ${task}

User instructions:
${request.aiNotes || '(No specific instructions — use context and professional judgment.)'}

${improving ? `Current content:\n${request.currentValue}\n` : ''}
Context (JSON):
${JSON.stringify(safeContext, null, 2)}
${examplesText ? `\n${examplesText}` : ''}`;
}

function usageFromResult(result: Awaited<ReturnType<typeof generateContentWithCascade>>): GenerationUsage {
	return {
		model: result.model,
		modelLabel: result.modelLabel,
		attemptedModels: result.attemptedModels,
		usedFallback: result.usedFallback
	};
}

export async function generateFieldContent(request: GenerateRequest) {
	const settings = await getSettings();
	const [context, examples] = await Promise.all([
		buildGenerationContext(request),
		loadGenerationExamples()
	]);
	const examplesText = formatGenerationExamples(examples);
	const current = String(request.currentValue ?? '');
	const hasNotes = Boolean(request.aiNotes?.trim());
	const shouldForceChange = current.trim().length > 0 && hasNotes;

	let result = await generateContentWithCascade({
		contents: buildUserPrompt(request, context, examplesText),
		config: {
			systemInstruction: buildSystemPrompt(settings, request.docType)
		}
	});

	// Flash models sometimes echo current content when revising; retry once with a harder instruction.
	if (shouldForceChange && textsEffectivelySame(result.text, current)) {
		result = await generateContentWithCascade({
			contents: buildUserPrompt(request, context, examplesText, { forceChange: true }),
			config: {
				systemInstruction: buildSystemPrompt(settings, request.docType)
			}
		});
	}

	return {
		value: result.text,
		lastGenerated: new Date().toISOString(),
		...usageFromResult(result)
	};
}

function weekNumber(week: number | string): number {
	return Number(week);
}

function teachingWeekToContext(week: {
	week: { value: number | string };
	outlineTheme?: { value: string };
	keyTeachingExperiences: { value: string };
	theory: { value: string };
	prac: { value: string };
	assessment: { value: string };
	resources: { value: string };
}): ChunkTeachingWeekContext {
	return {
		week: week.week.value,
		outlineTheme: week.outlineTheme?.value ?? '',
		keyTeachingExperiences: week.keyTeachingExperiences.value,
		theory: week.theory.value,
		prac: week.prac.value,
		assessment: week.assessment.value,
		resources: week.resources.value
	};
}

function weekHasWeeklyDetail(week: ChunkTeachingWeekContext): boolean {
	return Boolean(
		week.keyTeachingExperiences?.trim() ||
			week.theory?.trim() ||
			week.prac?.trim() ||
			week.assessment?.trim() ||
			week.resources?.trim()
	);
}

export async function generateChunkContent(request: ChunkGenerateRequest) {
	const settings = await getSettings();
	const [levelPlan, unit, examples] = await Promise.all([
		getLevelPlan(request.levelPlanId),
		getUnitPlan(request.levelPlanId, request.unitId),
		loadGenerationExamples()
	]);

	if (!levelPlan || !unit) throw new Error('Level plan or unit plan not found');

	const sequence: ChunkTeachingWeekContext[] =
		request.teachingSequenceContext ??
		unit.teachingSequence.map((week) => teachingWeekToContext(week));

	const chunkWeeks = sequence
		.filter((w) => {
			const n = weekNumber(w.week);
			return n >= request.startWeek && n <= request.endWeek;
		})
		.sort((a, b) => weekNumber(a.week) - weekNumber(b.week))
		.map((w) => ({
			week: w.week,
			outlineTheme: w.outlineTheme ?? '',
			theory: w.theory ?? '',
			prac: w.prac ?? ''
		}));

	const previousWeeksDetail =
		request.mode === 'weekly'
			? sequence
					.filter((w) => weekNumber(w.week) < request.startWeek && weekHasWeeklyDetail(w))
					.sort((a, b) => weekNumber(a.week) - weekNumber(b.week))
			: [];

	const teachingOutline = sequence
		.map((w) => ({
			week: w.week,
			outlineTheme: (w.outlineTheme ?? '').trim()
		}))
		.filter((w) => w.outlineTheme.length > 0);

	const existingChunkOutlines = chunkWeeks.filter((w) => (w.outlineTheme ?? '').trim());
	const revisingOutline = request.mode === 'outline' && existingChunkOutlines.length > 0;

	const context = {
		targetUnit: {
			title: request.unitSnapshot?.unitTitle ?? unit.unitTitle.value,
			number: unit.unitNumber.value,
			instruction:
				'Generate content ONLY for this unit. Use only its description and assessments. Do not use topics from otherUnitsInBand.'
		},
		levelPlan: summarizeLevelPlanForUnit(levelPlan, unit),
		unitPlan: summarizeUnitPlanForChunk(
			unit,
			{
				chunkOutline: chunkWeeks,
				...(teachingOutline.length > 0 && { teachingOutline }),
				...(previousWeeksDetail.length > 0 && { previousWeeksDetail })
			},
			request.unitSnapshot
		),
		chunk: { startWeek: request.startWeek, endWeek: request.endWeek }
	};
	const examplesText = formatGenerationExamples(examples);
	const weekCount = request.endWeek - request.startWeek + 1;
	const targetUnitTitle = String(request.unitSnapshot?.unitTitle ?? unit.unitTitle.value);

	const densityGuide = `Density requirement: classes run about 3 lessons per week. Content must be substantial enough to fill that teaching time — not one-line themes or thin bullet stubs. Match the length/tone of sampleTeachingWeek in the reference examples when present.`;

	const modeInstructions =
		request.mode === 'outline'
			? `${revisingOutline ? 'Revise' : 'Generate'} the unit outline for "${targetUnitTitle}" only — weeks ${request.startWeek}–${request.endWeek} (${weekCount} weeks). Return exactly ${weekCount} objects in order. Object at index 0 is week ${request.startWeek}, index 1 is week ${request.startWeek + 1}, and so on.
For each week return only: week (number) and outlineTheme (string).
Each outlineTheme must be 2–4 full sentences describing the week's teaching arc across ~3 lessons (what students learn/do across the week), aligned to this unit's description and assessments. Do not write full lesson scripts, but do not write one-line titles either.
${densityGuide}
${
	existingChunkOutlines.length > 0
		? 'Existing outlineTheme values are in chunkOutline — improve them using the user instructions; do not shrink them or ignore the feedback.'
		: ''
}
Do NOT use topics from other units in the band.`
			: `Generate detailed weekly content for "${targetUnitTitle}" only — weeks ${request.startWeek}–${request.endWeek} (${weekCount} weeks). Return exactly ${weekCount} objects in order. Object at index 0 is week ${request.startWeek}, index 1 is week ${request.startWeek + 1}, and so on.

For each week N, the detailed content MUST implement the outlineTheme for week N from chunkOutline / teachingOutline in the context — do not use the previous or next week's theme.
${densityGuide}
For each week, write:
- keyTeachingExperiences: a short paragraph covering the week's learning experiences across ~3 lessons
- theory: a substantial paragraph of explicit teaching / concepts (roughly 3–6 sentences)
- prac: a substantial paragraph of practical activities across the week's lessons (roughly 3–6 sentences)
- assessment: formative/summative notes for the week
- resources: concrete tools, sites, or materials
${
	previousWeeksDetail.length > 0
		? `Previous weeks in this unit already have detailed content in previousWeeksDetail. Continue the progression from those weeks. Do NOT repeat topics, activities, experiences, or assessment tasks already covered — week ${request.startWeek} must be clearly new content building on what came before.`
		: ''
}
Do NOT use topics from other units in the band. For each week return: week number, keyTeachingExperiences, theory, prac, assessment, resources.`;

	const result = await generateContentWithCascade({
		contents: `${modeInstructions}

User instructions (follow these carefully when revising or regenerating):
${request.aiNotes || '(No specific instructions.)'}

Context:
${JSON.stringify(context, null, 2)}
${examplesText ? `\n${examplesText}` : ''}

Respond with valid JSON only — an array of exactly ${weekCount} week objects in order (index 0 = week ${request.startWeek}). Fields: week (number), outlineTheme (outline mode) OR keyTeachingExperiences, theory, prac, assessment, resources (weekly mode).`,
		config: {
			systemInstruction: buildSystemPrompt(settings, 'unit-plan-chunk'),
			maxOutputTokens: 16384
		}
	});

	let parsed: unknown;
	try {
		parsed = JSON.parse(result.text);
	} catch {
		const jsonMatch = result.text.match(/\[[\s\S]*\]/);
		if (!jsonMatch) throw new Error('Could not parse chunk response as JSON array');
		parsed = JSON.parse(jsonMatch[0]);
	}

	if (!Array.isArray(parsed)) {
		const weeksField =
			parsed && typeof parsed === 'object' && 'weeks' in parsed
				? (parsed as { weeks: unknown }).weeks
				: null;
		if (!Array.isArray(weeksField)) {
			throw new Error('Chunk response was not a JSON array');
		}
		parsed = weeksField;
	}

	const weeks = (parsed as Record<string, unknown>[]).slice(0, weekCount).map((week, index) => ({
		...week,
		week: request.startWeek + index
	}));

	return {
		weeks,
		lastGenerated: new Date().toISOString(),
		...usageFromResult(result)
	};
}
