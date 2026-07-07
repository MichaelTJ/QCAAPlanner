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
import type { ChunkGenerateRequest, GenerateRequest, LevelPlan, UnitPlan } from '$lib/types';
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

function summarizeUnitPlan(unit: UnitPlan) {
	return {
		unitTitle: unit.unitTitle.value,
		unitNumber: unit.unitNumber.value,
		yearLevel: unit.yearLevel.value,
		subject: unit.subject.value,
		startWeek: unit.startWeek.value,
		finishWeek: unit.finishWeek.value,
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
		if (levelPlan) context.levelPlan = summarizeLevelPlan(levelPlan);
		if (unit) context.unitPlan = summarizeUnitPlan(unit);
	}

	if (request.docType === 'assessment-item') {
		const item = await getAssessmentItem(request.docId);
		if (item) {
			const [levelPlan, unit] = await Promise.all([
				getLevelPlan(item.levelPlanId),
				getUnitPlan(item.levelPlanId, item.unitPlanId)
			]);
			if (levelPlan) context.levelPlan = summarizeLevelPlan(levelPlan);
			if (unit) context.unitPlan = summarizeUnitPlan(unit);
			context.assessmentItem = {
				title: item.title.value,
				description: item.description.value
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

export async function generateChunkContent(request: ChunkGenerateRequest) {
	const settings = await getSettings();
	const [levelPlan, unit, examples] = await Promise.all([
		getLevelPlan(request.levelPlanId),
		getUnitPlan(request.levelPlanId, request.unitId),
		loadGenerationExamples()
	]);

	if (!levelPlan || !unit) throw new Error('Level plan or unit plan not found');

	const chunkWeeks = unit.teachingSequence
		.filter((w) => {
			const n = Number(w.week.value);
			return n >= request.startWeek && n <= request.endWeek;
		})
		.sort((a, b) => Number(a.week.value) - Number(b.week.value))
		.map((w) => ({
			week: w.week.value,
			outlineTheme: w.outlineTheme?.value ?? '',
			theory: w.theory.value,
			prac: w.prac.value
		}));

	const context = {
		levelPlan: summarizeLevelPlan(levelPlan),
		unitPlan: {
			...summarizeUnitPlan(unit),
			chunkOutline: chunkWeeks
		},
		chunk: { startWeek: request.startWeek, endWeek: request.endWeek }
	};
	const examplesText = formatGenerationExamples(examples);
	const weekCount = request.endWeek - request.startWeek + 1;

	const modeInstructions =
		request.mode === 'outline'
			? `Generate a high-level outline for weeks ${request.startWeek}–${request.endWeek} (${weekCount} weeks). Return exactly ${weekCount} objects in order. Object at index 0 is week ${request.startWeek}, index 1 is week ${request.startWeek + 1}, and so on. For each week return only: week number and outlineTheme (brief focus/theme, not full lesson detail).`
			: `Generate detailed weekly content for weeks ${request.startWeek}–${request.endWeek} (${weekCount} weeks). Return exactly ${weekCount} objects in order. Object at index 0 is week ${request.startWeek}, index 1 is week ${request.startWeek + 1}, and so on.

For each week N, the detailed content MUST implement the outlineTheme for week N from chunkOutline in the context — do not use the previous or next week's theme.
For each week return: week number, keyTeachingExperiences, theory, prac, assessment, resources.`;

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
