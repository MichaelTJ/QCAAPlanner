/**
 * Teacher PowerPoint export for ASPIRE lessons.
 * Pattern: activity (student-facing) → answers (reveal) → next activity.
 * Visual theme: coastal ink (not default white / not purple-AI).
 */
import PptxGenJS from 'pptxgenjs';
import type {
	LessonActivity,
	LessonActivityStage,
	LessonEnhancePath,
	LessonPlan,
	TeachingWeek,
	UnitPlan
} from '$lib/types';
import { workbookActivityFromLessonFields } from '$lib/workbook/parse';
import type { WorkbookActivity } from '$lib/workbook/types';
import { weeksWithLessons } from './lesson-plans-docx';

const STAGE_LABEL: Record<LessonActivityStage, string> = {
	'i-do': 'I Do',
	'we-do': 'We Do',
	'you-do': 'You Do',
	vocabulary: 'Vocabulary',
	'guided-notes': 'Guided notes',
	generative: 'Generative'
};

const PATH_LABEL: Record<LessonEnhancePath, string> = {
	'skill-building': 'Skill-building',
	'knowledge-building': 'Knowledge-building'
};

/** Coastal ink theme — readable on a classroom projector. */
const T = {
	bg: '0B1C24',
	bgDeep: '07141A',
	card: '14303C',
	cardSoft: '1A3A48',
	accent: '3DB8A0',
	accentWarm: 'E8A45A',
	text: 'F2F6F5',
	muted: '8FA8B3',
	line: '2A4A58',
	answerBg: '122E28',
	answerAccent: '6EE7B7',
	dangerSoft: '3A2A24'
};

type QaPair = { q: string; a: string };

function text(value: unknown): string {
	if (value == null) return '';
	return String(value).trim();
}

function workbookWording(value: string): string {
	return value
		.replace(/\bdigital workbooks?\b/gi, 'workbook')
		.replace(/\bDigital Workbooks?\b/g, 'Workbook');
}

function stripWaitTimeScripts(raw: string): string {
	return raw
		.replace(/\(?\s*Question\s*,?\s*Pause\s*,?\s*Name\s*[:.]?\s*\)?/gi, '')
		.replace(/\bPause\.?\s*Name:\s*\[[^\]]*\]\.?/gi, '')
		.replace(/\bPause\.?\s*Name:\s*[A-Za-z][A-Za-z\-']*\.?/gi, '')
		.replace(/\bName:\s*\[[^\]]*\]\.?/gi, '')
		.replace(/\bWait\s*Time\b[^.]*\.?/gi, '')
		.replace(/\bScript:\s*/gi, '')
		.replace(/\s{2,}/g, ' ')
		.replace(/\s+([,.;:])/g, '$1')
		.trim();
}

function parseQuestionPairs(raw: string): QaPair[] {
	const cleaned = stripWaitTimeScripts(workbookWording(raw));
	if (!cleaned) return [];

	const pairs: QaPair[] = [];
	const pairedRe =
		/([^?]+?\?)\s*(?:\((?:Expected(?:\s+answer)?|Sample|Expectation)\s*[:\-–]\s*([^)]+)\)|(?:Expected(?:\s+answer)?|Sample|Expectation)\s*[:\-–]\s*([^.]+)\.?)/gi;
	let m: RegExpExecArray | null;
	const consumed: Array<{ start: number; end: number }> = [];
	while ((m = pairedRe.exec(cleaned)) !== null) {
		pairs.push({
			q: m[1].replace(/^\d+[\).:\s]+/, '').trim(),
			a: (m[2] || m[3] || '').trim().replace(/\.$/, '')
		});
		consumed.push({ start: m.index, end: m.index + m[0].length });
	}

	const bareRe = /([^?]+?\?)/g;
	while ((m = bareRe.exec(cleaned)) !== null) {
		const already = consumed.some((c) => m!.index >= c.start && m!.index < c.end);
		if (already) continue;
		const q = m[1].replace(/^\d+[\).:\s]+/, '').trim();
		if (q.length > 8) pairs.push({ q, a: '' });
	}

	if (!pairs.length && cleaned.length > 12) {
		pairs.push({ q: cleaned, a: '' });
	}
	return pairs;
}

function asICanGoal(lesson: LessonPlan): string {
	const display = text(lesson.orientate?.learningGoalDisplay);
	const fallback = text(lesson.learningGoal);
	let goal = display || fallback;
	if (!goal) return '';
	goal = workbookWording(goal).replace(/\.$/, '');
	if (/^i can\b/i.test(goal)) return goal.replace(/^i can/i, 'I can');
	return `I can ${goal.charAt(0).toLowerCase()}${goal.slice(1)}`;
}

function activityMeta(activity: LessonActivity): string {
	const stage = STAGE_LABEL[activity.stage] ?? activity.stage;
	const rawLabel = text(activity.timeLabel);
	const timing = /\d{1,2}\s*[:.]\s*\d{2}/.test(rawLabel)
		? rawLabel
		: activity.minutes
			? `${activity.minutes} min`
			: '';
	return [timing, stage].filter(Boolean).join('  ·  ');
}

function sortedLessons(week: TeachingWeek): LessonPlan[] {
	return [...(week.lessons ?? [])].sort((a, b) => a.lessonNumber - b.lessonNumber);
}

function unitSubtitle(plan: UnitPlan): string {
	const yearLevel = plan.yearLevel.value === '' ? '' : `Year ${plan.yearLevel.value}`;
	const unitNumber = plan.unitNumber.value === '' ? '' : `Unit ${plan.unitNumber.value}`;
	return [yearLevel, text(plan.subject.value), unitNumber].filter(Boolean).join('  ·  ');
}

function resolveWidget(activity: LessonActivity): WorkbookActivity | undefined {
	return workbookActivityFromLessonFields({
		workbookSpec: activity.workbookSpec,
		workbookMaterials: activity.workbookMaterials,
		workbookKind: activity.workbookKind,
		scaffolding: activity.scaffolding,
		title: activity.title,
		visibleInstructions: activity.visibleInstructions,
		studentsDo: activity.studentsDo
	});
}

/** Compact student-facing summary of the workbook widget for the activity slide. */
function workbookPreviewLines(spec: WorkbookActivity): string[] {
	const lines: string[] = [];
	if (spec.prompt) lines.push(spec.prompt);
	if (spec.stimulus) lines.push(`Stimulus: ${spec.stimulus}`);

	switch (spec.type) {
		case 'table':
			lines.push(`Table: ${spec.headers.join(' | ')}`);
			for (const row of spec.rows.slice(0, 6)) {
				const label = row.find((c) => c.mode === 'locked' && c.value)?.value;
				if (label) lines.push(`• ${label}`);
			}
			if (spec.rows.length > 6) lines.push(`… +${spec.rows.length - 6} more rows`);
			break;
		case 'checklist':
			lines.push('Checklist:');
			spec.items.slice(0, 8).forEach((item) => lines.push(`☐ ${item}`));
			break;
		case 'cloze':
			lines.push(spec.text.replace(/\{\{(\d+)\}\}/g, '(__$1__)'));
			if (spec.wordBank?.length) lines.push(`Word bank: (scrambled on the workbook sheet)`);
			break;
		case 'ranking':
			lines.push(spec.directionLabel || 'Rank the items');
			lines.push(`Bank: ${spec.bank.join(' · ')}`);
			lines.push(`${spec.slots} ranking slots`);
			break;
		case 'sort':
			lines.push(`Sort into: ${spec.buckets.join(' / ')}`);
			lines.push(`Bank: ${spec.bank.join(' · ')}`);
			break;
		case 'written':
			if (spec.sections?.length) {
				spec.sections.forEach((s) => lines.push(`• ${s.label}`));
			} else {
				lines.push(spec.starter || `${spec.lines ?? 3} write-on lines`);
			}
			break;
		case 'media':
			lines.push(
				spec.medium === 'youtube'
					? `Search YouTube: ${spec.searchTerms || spec.name}`
					: `Find website: ${spec.searchTerms || spec.name}`
			);
			if (spec.url) lines.push(`URL: ${spec.url}`);
			break;
		case 'user_story':
			lines.push('As a… / I want… / so that…');
			break;
		case 'sitemap':
			lines.push(`Site map root: ${spec.root.label || 'Home'}`);
			break;
		case 'overlap':
			lines.push(`Only ${spec.leftLabel} · Both · Only ${spec.rightLabel}`);
			break;
		case 'continuum':
			lines.push(`Scale ${spec.left} ←→ ${spec.right} (${spec.scale} points)`);
			break;
		case 'graphic':
		case 'wireframe':
		case 'storyboard':
		case 'flow':
		case 'code':
		case 'annotate':
		case 'ai_prompt_log':
			lines.push(`${spec.type} task — see student workbook`);
			break;
		case 'prose':
			lines.push(spec.text);
			break;
		default:
			lines.push('See student workbook');
	}
	return lines.filter(Boolean).slice(0, 14);
}

function answerKeyLines(activity: LessonActivity, spec?: WorkbookActivity): string[] {
	const lines: string[] = [];
	const key = text(activity.teacherAnswerKey);
	if (key && key !== '[object Object]') {
		lines.push(...key.split(/\r?\n/).map((l) => l.trim()).filter(Boolean));
	}
	if (spec?.modelAnswer) {
		const model =
			typeof spec.modelAnswer === 'string'
				? spec.modelAnswer
				: JSON.stringify(spec.modelAnswer);
		if (model && !lines.includes(model)) lines.push(model);
	}
	const pairs = parseQuestionPairs(activity.questioning);
	for (const p of pairs) {
		if (p.a) lines.push(`${p.q} → ${p.a}`);
	}
	return lines.slice(0, 16);
}

function addBg(slide: PptxGenJS.Slide, deep = false) {
	slide.addShape('rect', {
		x: 0,
		y: 0,
		w: '100%',
		h: '100%',
		fill: { color: deep ? T.bgDeep : T.bg }
	});
	// Top accent bar
	slide.addShape('rect', {
		x: 0,
		y: 0,
		w: '100%',
		h: 0.08,
		fill: { color: T.accent }
	});
}

function addFooter(slide: PptxGenJS.Slide, left: string, right: string) {
	slide.addText(left, {
		x: 0.45,
		y: 5.15,
		w: 6.5,
		h: 0.28,
		fontSize: 10,
		fontFace: 'Calibri',
		color: T.muted,
		margin: 0
	});
	slide.addText(right, {
		x: 7.0,
		y: 5.15,
		w: 2.5,
		h: 0.28,
		fontSize: 10,
		fontFace: 'Calibri',
		color: T.muted,
		align: 'right',
		margin: 0
	});
}

function chip(slide: PptxGenJS.Slide, label: string, x: number, y: number, warm = false) {
	const w = Math.min(3.2, 0.22 * label.length + 0.6);
	slide.addShape('roundRect', {
		x,
		y,
		w,
		h: 0.32,
		fill: { color: warm ? T.accentWarm : T.accent },
		shadow: { type: 'outer', color: '000000', blur: 4, opacity: 0.25, offset: 2 }
	});
	slide.addText(label, {
		x,
		y,
		w,
		h: 0.32,
		fontSize: 11,
		fontFace: 'Calibri',
		bold: true,
		color: T.bgDeep,
		align: 'center',
		valign: 'middle',
		margin: 0
	});
}

function addCover(
	pptx: PptxGenJS,
	opts: { school: string; unitTitle: string; subtitle: string }
) {
	const slide = pptx.addSlide();
	addBg(slide, true);
	// Large left panel
	slide.addShape('rect', {
		x: 0,
		y: 0,
		w: 0.35,
		h: '100%',
		fill: { color: T.accent }
	});
	slide.addText(opts.school, {
		x: 0.7,
		y: 1.1,
		w: 8.5,
		h: 0.35,
		fontSize: 14,
		fontFace: 'Calibri',
		color: T.accent,
		bold: true,
		margin: 0
	});
	slide.addText('Teacher slides', {
		x: 0.7,
		y: 1.55,
		w: 8.5,
		h: 0.35,
		fontSize: 16,
		fontFace: 'Calibri',
		color: T.muted,
		margin: 0
	});
	slide.addText(opts.unitTitle, {
		x: 0.7,
		y: 2.1,
		w: 8.5,
		h: 1.1,
		fontSize: 36,
		fontFace: 'Georgia',
		bold: true,
		color: T.text,
		margin: 0
	});
	slide.addText(opts.subtitle || 'ASPIRE  ·  Orientate → Enhance → Culminate', {
		x: 0.7,
		y: 3.4,
		w: 8.5,
		h: 0.4,
		fontSize: 16,
		fontFace: 'Calibri',
		color: T.muted,
		margin: 0
	});
	slide.addText('Each activity: task slide → answers slide', {
		x: 0.7,
		y: 4.3,
		w: 8.5,
		h: 0.35,
		fontSize: 14,
		fontFace: 'Calibri',
		color: T.accentWarm,
		margin: 0
	});
}

function addLessonDivider(
	pptx: PptxGenJS,
	weekLabel: string,
	lesson: LessonPlan,
	footerLeft: string
) {
	const slide = pptx.addSlide();
	addBg(slide);
	chip(slide, weekLabel, 0.55, 1.5);
	chip(
		slide,
		PATH_LABEL[lesson.enhancePath] ?? lesson.enhancePath,
		0.55,
		1.95,
		true
	);
	slide.addText(`Lesson ${lesson.lessonNumber}`, {
		x: 0.55,
		y: 2.5,
		w: 9,
		h: 0.4,
		fontSize: 18,
		fontFace: 'Calibri',
		color: T.muted,
		margin: 0
	});
	slide.addText(lesson.title || 'Untitled lesson', {
		x: 0.55,
		y: 2.95,
		w: 9,
		h: 1.0,
		fontSize: 32,
		fontFace: 'Georgia',
		bold: true,
		color: T.text,
		margin: 0
	});
	const goal = asICanGoal(lesson);
	if (goal) {
		slide.addShape('roundRect', {
			x: 0.55,
			y: 4.1,
			w: 8.9,
			h: 0.7,
			fill: { color: T.card },
			shadow: { type: 'outer', color: '000000', blur: 6, opacity: 0.3, offset: 2 }
		});
		slide.addText(goal, {
			x: 0.75,
			y: 4.2,
			w: 8.5,
			h: 0.5,
			fontSize: 15,
			fontFace: 'Calibri',
			color: T.text,
			italic: true,
			margin: 0
		});
	}
	addFooter(slide, footerLeft, `${weekLabel} · L${lesson.lessonNumber}`);
}

function addOrientateSlide(
	pptx: PptxGenJS,
	weekLabel: string,
	lesson: LessonPlan,
	footerLeft: string
) {
	const slide = pptx.addSlide();
	addBg(slide);
	chip(slide, 'Orientate', 0.5, 0.35);
	chip(slide, '0–10 min', 2.0, 0.35, true);

	slide.addText('Learning goal', {
		x: 0.5,
		y: 0.9,
		w: 9,
		h: 0.3,
		fontSize: 12,
		fontFace: 'Calibri',
		color: T.accent,
		bold: true,
		margin: 0
	});
	slide.addText(asICanGoal(lesson) || '—', {
		x: 0.5,
		y: 1.2,
		w: 9,
		h: 0.7,
		fontSize: 22,
		fontFace: 'Georgia',
		color: T.text,
		margin: 0
	});

	slide.addShape('roundRect', {
		x: 0.5,
		y: 2.15,
		w: 9,
		h: 2.6,
		fill: { color: T.card },
		shadow: { type: 'outer', color: '000000', blur: 8, opacity: 0.35, offset: 2 }
	});
	slide.addText('SMART start', {
		x: 0.75,
		y: 2.35,
		w: 8.5,
		h: 0.3,
		fontSize: 13,
		fontFace: 'Calibri',
		color: T.accentWarm,
		bold: true,
		margin: 0
	});
	slide.addText(workbookWording(text(lesson.orientate?.smartStart)) || '—', {
		x: 0.75,
		y: 2.75,
		w: 8.5,
		h: 1.75,
		fontSize: 16,
		fontFace: 'Calibri',
		color: T.text,
		valign: 'top',
		margin: 0
	});
	addFooter(slide, footerLeft, `${weekLabel} · L${lesson.lessonNumber}`);
}

function addActivitySlide(
	pptx: PptxGenJS,
	weekLabel: string,
	lesson: LessonPlan,
	activity: LessonActivity,
	footerLeft: string
) {
	const slide = pptx.addSlide();
	addBg(slide);
	const meta = activityMeta(activity);
	chip(slide, 'Activity', 0.5, 0.3);
	if (meta) chip(slide, meta, 1.85, 0.3, true);

	slide.addText(activity.title || 'Activity', {
		x: 0.5,
		y: 0.75,
		w: 9,
		h: 0.55,
		fontSize: 24,
		fontFace: 'Georgia',
		bold: true,
		color: T.text,
		margin: 0
	});

	const task =
		workbookWording(text(activity.visibleInstructions)) ||
		workbookWording(text(activity.studentsDo));
	const spec = resolveWidget(activity);
	const preview = spec ? workbookPreviewLines(spec) : [];

	// Task card
	slide.addShape('roundRect', {
		x: 0.5,
		y: 1.4,
		w: 4.4,
		h: 3.4,
		fill: { color: T.card },
		shadow: { type: 'outer', color: '000000', blur: 8, opacity: 0.35, offset: 2 }
	});
	slide.addText('Do this', {
		x: 0.7,
		y: 1.55,
		w: 4,
		h: 0.28,
		fontSize: 12,
		fontFace: 'Calibri',
		bold: true,
		color: T.accent,
		margin: 0
	});
	slide.addText(task || 'Complete the workbook task.', {
		x: 0.7,
		y: 1.9,
		w: 4,
		h: 2.65,
		fontSize: 14,
		fontFace: 'Calibri',
		color: T.text,
		valign: 'top',
		margin: 0
	});

	// Workbook card
	slide.addShape('roundRect', {
		x: 5.15,
		y: 1.4,
		w: 4.35,
		h: 3.4,
		fill: { color: T.cardSoft },
		shadow: { type: 'outer', color: '000000', blur: 8, opacity: 0.35, offset: 2 }
	});
	slide.addText('Workbook', {
		x: 5.35,
		y: 1.55,
		w: 4,
		h: 0.28,
		fontSize: 12,
		fontFace: 'Calibri',
		bold: true,
		color: T.accentWarm,
		margin: 0
	});
	slide.addText(
		preview.length
			? preview.map((l) => (l.startsWith('•') || l.startsWith('☐') ? l : l)).join('\n')
			: 'See printed student workbook.',
		{
			x: 5.35,
			y: 1.9,
			w: 3.95,
			h: 2.65,
			fontSize: 13,
			fontFace: 'Calibri',
			color: T.text,
			valign: 'top',
			margin: 0
		}
	);

	addFooter(slide, footerLeft, `${weekLabel} · L${lesson.lessonNumber}`);
}

function addAnswersSlide(
	pptx: PptxGenJS,
	weekLabel: string,
	lesson: LessonPlan,
	activity: LessonActivity,
	footerLeft: string
) {
	const slide = pptx.addSlide();
	addBg(slide);
	chip(slide, 'Answers', 0.5, 0.3, true);
	slide.addText(activity.title || 'Activity', {
		x: 0.5,
		y: 0.75,
		w: 9,
		h: 0.45,
		fontSize: 22,
		fontFace: 'Georgia',
		bold: true,
		color: T.text,
		margin: 0
	});

	const pairs = parseQuestionPairs(activity.questioning);
	const spec = resolveWidget(activity);
	const keys = answerKeyLines(activity, spec);

	slide.addShape('roundRect', {
		x: 0.5,
		y: 1.35,
		w: 9,
		h: 3.5,
		fill: { color: T.answerBg },
		shadow: { type: 'outer', color: '000000', blur: 8, opacity: 0.35, offset: 2 }
	});

	const blocks: PptxGenJS.TextProps[] = [];
	if (pairs.some((p) => p.a)) {
		blocks.push({
			text: 'Questioning',
			options: { bold: true, color: T.answerAccent, breakLine: true, fontSize: 13 }
		});
		for (const [i, p] of pairs.entries()) {
			if (!p.a) continue;
			blocks.push({
				text: `Q${i + 1}. ${p.q}`,
				options: { color: T.text, breakLine: true, fontSize: 13 }
			});
			blocks.push({
				text: `   → ${p.a}`,
				options: { color: T.answerAccent, breakLine: true, fontSize: 13, italic: true }
			});
		}
	}
	if (keys.length) {
		if (blocks.length) {
			blocks.push({ text: ' ', options: { breakLine: true, fontSize: 8 } });
		}
		blocks.push({
			text: 'Workbook / answer key',
			options: { bold: true, color: T.answerAccent, breakLine: true, fontSize: 13 }
		});
		for (const line of keys.slice(0, 10)) {
			blocks.push({
				text: line,
				options: { color: T.text, breakLine: true, fontSize: 13 }
			});
		}
	}
	if (!blocks.length) {
		blocks.push({
			text: 'No answer key recorded for this activity yet.',
			options: { color: T.muted, italic: true }
		});
	}

	slide.addText(blocks, {
		x: 0.75,
		y: 1.55,
		w: 8.5,
		h: 3.1,
		fontFace: 'Calibri',
		valign: 'top',
		margin: 0
	});

	addFooter(slide, footerLeft, `${weekLabel} · L${lesson.lessonNumber} · answers`);
}

function addCulminateSlide(
	pptx: PptxGenJS,
	weekLabel: string,
	lesson: LessonPlan,
	footerLeft: string
) {
	const slide = pptx.addSlide();
	addBg(slide);
	chip(slide, 'Culminate', 0.5, 0.35);
	chip(slide, '50–60 min', 2.1, 0.35, true);

	slide.addShape('roundRect', {
		x: 0.5,
		y: 1.0,
		w: 9,
		h: 2.2,
		fill: { color: T.card },
		shadow: { type: 'outer', color: '000000', blur: 8, opacity: 0.35, offset: 2 }
	});
	slide.addText('SMART finish', {
		x: 0.75,
		y: 1.2,
		w: 8.5,
		h: 0.3,
		fontSize: 13,
		fontFace: 'Calibri',
		bold: true,
		color: T.accentWarm,
		margin: 0
	});
	slide.addText(workbookWording(text(lesson.culminate?.smartFinish)) || '—', {
		x: 0.75,
		y: 1.6,
		w: 8.5,
		h: 1.35,
		fontSize: 16,
		fontFace: 'Calibri',
		color: T.text,
		valign: 'top',
		margin: 0
	});

	slide.addText('Next lesson', {
		x: 0.5,
		y: 3.5,
		w: 9,
		h: 0.3,
		fontSize: 12,
		fontFace: 'Calibri',
		bold: true,
		color: T.accent,
		margin: 0
	});
	slide.addText(workbookWording(text(lesson.culminate?.nextSteps)) || '—', {
		x: 0.5,
		y: 3.85,
		w: 9,
		h: 0.9,
		fontSize: 15,
		fontFace: 'Calibri',
		color: T.text,
		margin: 0
	});
	addFooter(slide, footerLeft, `${weekLabel} · L${lesson.lessonNumber}`);
}

/**
 * Build a teacher PowerPoint: cover → per lesson (divider, orientate, activity/answers pairs, culminate).
 */
export async function buildLessonPlansTeacherPptx(
	plan: UnitPlan,
	school = "St Brendan's College (Yeppoon)"
): Promise<Buffer> {
	const weeks = weeksWithLessons(plan);
	if (!weeks.length) throw new Error('No lesson plans to export');

	const pptx = new PptxGenJS();
	pptx.defineLayout({ name: 'LAYOUT_16x9', width: 10, height: 5.625 });
	pptx.layout = 'LAYOUT_16x9';
	pptx.author = school;
	pptx.title = `${text(plan.unitTitle.value) || 'Unit'} — Teacher slides`;
	pptx.subject = 'ASPIRE lesson delivery';

	const unitTitle = text(plan.unitTitle.value) || 'Unit';
	const footerLeft = `${school}  ·  ${unitTitle}`;

	addCover(pptx, {
		school,
		unitTitle,
		subtitle: unitSubtitle(plan)
	});

	for (const week of weeks) {
		const weekLabel = `Week ${week.week.value}`;
		for (const lesson of sortedLessons(week)) {
			addLessonDivider(pptx, weekLabel, lesson, footerLeft);
			addOrientateSlide(pptx, weekLabel, lesson, footerLeft);
			for (const activity of lesson.enhance?.activities ?? []) {
				addActivitySlide(pptx, weekLabel, lesson, activity, footerLeft);
				addAnswersSlide(pptx, weekLabel, lesson, activity, footerLeft);
			}
			addCulminateSlide(pptx, weekLabel, lesson, footerLeft);
		}
	}

	const output = await pptx.write({ outputType: 'nodebuffer' });
	return Buffer.from(output as ArrayBuffer);
}
