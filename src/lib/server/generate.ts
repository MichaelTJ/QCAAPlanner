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
	mode: 'outline' | 'weekly',
	extras: Record<string, unknown> = {},
	snapshot?: ChunkGenerateRequest['unitSnapshot']
) {
	const base = {
		unitTitle: snapshot?.unitTitle ?? unit.unitTitle.value,
		unitNumber: unit.unitNumber.value,
		yearLevel: unit.yearLevel.value,
		subject: unit.subject.value,
		startWeek: unit.startWeek.value,
		finishWeek: unit.finishWeek.value,
		duration: unit.duration?.value ?? '',
		description: snapshot?.description ?? unit.unitDescription.value,
		cohort: unit.cohortAndClassConsiderations.value,
		assessments: (snapshot?.assessments ?? unit.assessments.map((a) => ({
			title: a.title.value,
			description: a.description.value,
			timing: a.timing.value,
			technique: a.technique.value
		})))
	};

	if (mode === 'weekly') {
		return {
			...base,
			...extras,
			teachingOutline: unit.teachingSequence.map((w) => ({
				week: w.week.value,
				outlineTheme: w.outlineTheme?.value ?? ''
			}))
		};
	}

	return { ...base, ...extras };
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

function buildSystemPrompt(settings: Awaited<ReturnType<typeof getSettings>>, docType: string) {
	return `You are an expert Australian curriculum writer for QCAA-aligned faculty planning documents.
School: ${settings.school}
Tone and style: ${settings.aiTone}
Document type: ${docType}
Write only the requested field content. Do not include headings, labels, or markdown unless appropriate for the field.
Use Australian English.
When reference examples are provided, treat them as length and tone guides only — never reuse their topics, technologies, or assessment content.`;
}

function buildUserPrompt(
	request: GenerateRequest,
	context: Record<string, unknown>,
	examplesText: string
) {
	const improving = request.currentValue.trim().length > 0;
	return `Field: ${request.fieldLabel}
Task: ${improving ? 'Improve or revise the existing content based on the user notes.' : 'Generate new content for this field.'}

User instructions:
${request.aiNotes || '(No specific instructions — use context and professional judgment.)'}

${improving ? `Current content:\n${request.currentValue}\n` : ''}
Context (JSON):
${JSON.stringify(context, null, 2)}
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

	const result = await generateContentWithCascade({
		contents: buildUserPrompt(request, context, examplesText),
		config: {
			systemInstruction: buildSystemPrompt(settings, request.docType)
		}
	});

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

	const context = {
		targetUnit: {
			title: request.unitSnapshot?.unitTitle ?? unit.unitTitle.value,
			number: unit.unitNumber.value,
			instruction:
				'Generate content ONLY for this unit. Use only its description and assessments. Do not use topics from otherUnitsInBand.'
		},
		levelPlan: summarizeLevelPlanForUnit(levelPlan, unit),
		unitPlan: summarizeUnitPlanForChunk(unit, request.mode, {
			chunkOutline: chunkWeeks,
			...(previousWeeksDetail.length > 0 && { previousWeeksDetail })
		}, request.unitSnapshot),
		chunk: { startWeek: request.startWeek, endWeek: request.endWeek }
	};
	const examplesText = formatGenerationExamples(examples);
	const weekCount = request.endWeek - request.startWeek + 1;
	const targetUnitTitle = String(request.unitSnapshot?.unitTitle ?? unit.unitTitle.value);

	const modeInstructions =
		request.mode === 'outline'
			? `Generate a high-level outline for "${targetUnitTitle}" only — weeks ${request.startWeek}–${request.endWeek} (${weekCount} weeks). Return exactly ${weekCount} objects in order. Object at index 0 is week ${request.startWeek}, index 1 is week ${request.startWeek + 1}, and so on. For each week return only: week number and outlineTheme (focus/theme aligned to this unit's description and assessments, not full lesson detail). Make the outlines bigger — they get 3 lessons a week so feel free to fill them up. Do NOT use topics from other units in the band.`
			: `Generate detailed weekly content for "${targetUnitTitle}" only — weeks ${request.startWeek}–${request.endWeek} (${weekCount} weeks). Return exactly ${weekCount} objects in order. Object at index 0 is week ${request.startWeek}, index 1 is week ${request.startWeek + 1}, and so on.

For each week N, the detailed content MUST implement the outlineTheme for week N from chunkOutline in the context — do not use the previous or next week's theme.
${
	previousWeeksDetail.length > 0
		? `Previous weeks in this unit already have detailed content in previousWeeksDetail. Continue the progression from those weeks. Do NOT repeat topics, activities, experiences, or assessment tasks already covered — week ${request.startWeek} must be clearly new content building on what came before.`
		: ''
}
Do NOT use topics from other units in the band. For each week return: week number, keyTeachingExperiences, theory, prac, assessment, resources.`;

	const result = await generateContentWithCascade({
		contents: `${modeInstructions}

User instructions:
${request.aiNotes || '(No specific instructions.)'}

Context:
${JSON.stringify(context, null, 2)}
${examplesText ? `\n${examplesText}` : ''}

Respond with valid JSON only — an array of exactly ${weekCount} week objects in order (index 0 = week ${request.startWeek}). Fields: week (number), outlineTheme (outline mode) OR keyTeachingExperiences, theory, prac, assessment, resources (weekly mode).`,
		config: {
			systemInstruction: buildSystemPrompt(settings, 'unit-plan-chunk')
		}
	});

	const jsonMatch = result.text.match(/\[[\s\S]*\]/);
	if (!jsonMatch) throw new Error('Could not parse chunk response as JSON array');

	const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>[];
	const weeks = parsed.slice(0, weekCount).map((week, index) => ({
		...week,
		week: request.startWeek + index
	}));

	return {
		weeks,
		lastGenerated: new Date().toISOString(),
		...usageFromResult(result)
	};
}
