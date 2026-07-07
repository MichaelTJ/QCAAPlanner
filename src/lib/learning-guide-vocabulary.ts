import type { LearningGuideData } from '$lib/learning-guide-data';
import type { UnitPlan } from '$lib/types';

/** Example format from the approved learning guide template. */
export const LEARNING_GUIDE_VOCABULARY_EXAMPLE = `OneDrive/Teams: Cloud Storage, OneDrive, Permissions, Channel,
Word/Excel/PowerPoint: Format, Template, Spreadsheet, Formula, Function, Data, Chart, Slide, Animation
Artificial Intelligence: Machine Learning, Bias, Ethical use
Cybersecurity: Multi-Factor Authentication (MFA), Social Engineering`;

export interface LearningGuideWeekSummary {
	week: number | '';
	title: string;
	bullets: string[];
}

export interface LearningGuideGenerationResult {
	vocabulary: string;
	weeks: LearningGuideWeekSummary[];
}

export function learningGuideContentLimits(weekCount: number): {
	maxBullets: number;
	maxBulletWords: number;
	maxTitleWords: number;
} {
	if (weekCount > 14) return { maxBullets: 1, maxBulletWords: 8, maxTitleWords: 6 };
	if (weekCount > 10) return { maxBullets: 1, maxBulletWords: 10, maxTitleWords: 7 };
	return { maxBullets: 2, maxBulletWords: 10, maxTitleWords: 8 };
}

export function normalizeLearningGuideVocabulary(text: string): string {
	return text
		.replace(/```[\s\S]*?```/g, '')
		.replace(/^vocabulary\s*:?\s*/i, '')
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean)
		.join('\n');
}

function normalizeWeekSummary(raw: unknown): LearningGuideWeekSummary | null {
	if (!raw || typeof raw !== 'object') return null;
	const record = raw as Record<string, unknown>;
	const week =
		typeof record.week === 'number' || record.week === ''
			? record.week
			: typeof record.week === 'string' && record.week.trim() !== ''
				? Number(record.week)
				: '';
	const title = typeof record.title === 'string' ? record.title.trim() : '';
	const bullets = Array.isArray(record.bullets)
		? record.bullets
				.filter((bullet): bullet is string => typeof bullet === 'string')
				.map((bullet) => bullet.trim())
				.filter(Boolean)
		: [];
	if (week === '' && !title && bullets.length === 0) return null;
	return { week, title, bullets };
}

export function parseLearningGuideGenerationResponse(text: string): LearningGuideGenerationResult {
	const jsonMatch = text.match(/\{[\s\S]*\}/);
	if (!jsonMatch) throw new Error('Could not parse learning guide response as JSON');

	const parsed = JSON.parse(jsonMatch[0]) as {
		vocabulary?: unknown;
		weeks?: unknown;
		weekSummaries?: unknown;
	};

	const vocabulary = normalizeLearningGuideVocabulary(
		typeof parsed.vocabulary === 'string' ? parsed.vocabulary : ''
	);
	if (!vocabulary) throw new Error('Gemini returned empty vocabulary');

	const rawWeeks = parsed.weeks ?? parsed.weekSummaries;
	const weeks = Array.isArray(rawWeeks)
		? rawWeeks
				.map(normalizeWeekSummary)
				.filter((week): week is LearningGuideWeekSummary => week !== null)
		: [];

	if (!weeks.length) {
		throw new Error('Gemini returned no week summaries');
	}

	return { vocabulary, weeks };
}

export function applyLearningGuideWeekSummaries(
	guide: LearningGuideData,
	summaries: LearningGuideWeekSummary[]
): LearningGuideData {
	const byWeek = new Map(summaries.map((summary) => [String(summary.week), summary]));

	return {
		...guide,
		weeks: guide.weeks.map((week) => {
			const summary = byWeek.get(String(week.week));
			if (!summary) return week;
			return {
				week: week.week,
				title: summary.title || week.title,
				bullets: summary.bullets.length ? summary.bullets : week.bullets
			};
		})
	};
}

export function buildLearningGuideVocabularyContext(
	unit: UnitPlan,
	guide: LearningGuideData
): Record<string, unknown> {
	return {
		unitTitle: unit.unitTitle.value,
		subject: unit.subject.value,
		yearLevel: unit.yearLevel.value,
		term: guide.term,
		unitDescription: unit.unitDescription.value,
		assessments: unit.assessments.map((assessment) => ({
			title: assessment.title.value,
			description: assessment.description.value,
			timing: assessment.timing.value
		})),
		teachingWeeks: unit.teachingSequence.map((week) => ({
			week: week.week.value,
			outlineTheme: week.outlineTheme?.value?.trim() ?? '',
			theory: week.theory.value.trim(),
			prac: week.prac.value.trim(),
			keyTeachingExperiences: week.keyTeachingExperiences.value.trim()
		})),
		learningGuideWeeks: guide.weeks.map((week) => ({
			week: week.week,
			title: week.title,
			bullets: week.bullets
		}))
	};
}

export function buildLearningGuideVocabularyUserPrompt(
	context: Record<string, unknown>,
	aiNotes?: string
): string {
	return `Create the VOCABULARY section for a student learning guide based on this unit and its weekly content.

The vocabulary must use this exact format:
- One topic or tool group per line
- Each line: "Topic/Theme: term1, term2, term3" (comma-separated terms after the colon)
- 3–6 topic lines covering the main concepts, tools, and skills in the unit
- Terms should be student-friendly and drawn from the unit content below
- Use Australian English
- Do not include headings, labels, bullet points, or markdown
- Do not wrap the response in code fences

Example format (topics will differ for each unit):
${LEARNING_GUIDE_VOCABULARY_EXAMPLE}

Unit and learning guide context (JSON):
${JSON.stringify(context, null, 2)}

${aiNotes ? `Additional instructions:\n${aiNotes}` : ''}

Return only the vocabulary lines, nothing else.`;
}

export function buildLearningGuideSummaryUserPrompt(
	context: Record<string, unknown>,
	aiNotes?: string
): string {
	const teachingWeeks = Array.isArray(context.teachingWeeks) ? context.teachingWeeks : [];
	const limits = learningGuideContentLimits(teachingWeeks.length);

	return `Create content for a student learning guide that must fit on ONE printed A4 page (including the vocabulary section).

Return a single JSON object with this exact shape:
{
  "vocabulary": "topic lines here (newline-separated string)",
  "weeks": [
    { "week": 1, "title": "Short theme", "bullets": ["Objective one", "Objective two"] }
  ]
}

VOCABULARY rules:
- One topic or tool group per line inside the vocabulary string
- Each line: "Topic/Theme: term1, term2, term3" (comma-separated terms after the colon)
- 3–6 topic lines covering the main concepts, tools, and skills in the unit
- Terms should be student-friendly and drawn from the unit content below
- Use Australian English

WEEK SUMMARY rules (critical — the page overflows if these are too long):
- Include one entry in "weeks" for every teaching week in teachingWeeks (match the week number)
- title: max ${limits.maxTitleWords} words — a short student-friendly theme for the week
- bullets: max ${limits.maxBullets} bullet(s) per week
- each bullet: max ${limits.maxBulletWords} words — one concise learning objective
- Distil the week's theory and practical focus; do not copy long sentences from the source
- Use Australian English

Example vocabulary format (topics will differ for each unit):
${LEARNING_GUIDE_VOCABULARY_EXAMPLE}

Unit and learning guide context (JSON):
${JSON.stringify(context, null, 2)}

${aiNotes ? `Additional instructions:\n${aiNotes}` : ''}

Return only the JSON object, with no markdown fences or commentary.`;
}
