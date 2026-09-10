import {
	AlignmentType,
	BorderStyle,
	Document,
	Footer,
	Header,
	HeadingLevel,
	Packer,
	PageBreak,
	PageNumber,
	Paragraph,
	ShadingType,
	Table,
	TableCell,
	TableRow,
	TextRun,
	WidthType,
	convertInchesToTwip
} from 'docx';
import type {
	LessonActivity,
	LessonActivityStage,
	LessonEnhancePath,
	LessonPlan,
	TeachingWeek,
	UnitPlan
} from '$lib/types';
import {
	exitTicketFromSmartFinish,
	workbookActivityFromLessonFields
} from '$lib/workbook/parse';
import {
	renderWorkbookActivity,
	renderWorkbookModelAnswer
} from '$lib/workbook/render-docx';

type DocChild = Paragraph | Table;

const PATH_LABEL: Record<LessonEnhancePath, string> = {
	'skill-building': 'Skill-building (I Do / We Do / You Do)',
	'knowledge-building': 'Knowledge-building (vocabulary / guided notes / generative)'
};

const STAGE_LABEL: Record<LessonActivityStage, string> = {
	'i-do': 'I Do',
	'we-do': 'We Do',
	'you-do': 'You Do',
	vocabulary: 'Vocabulary',
	'guided-notes': 'Guided notes',
	generative: 'Generative'
};

/** Teacher-management phrases that must not appear on the student sheet. */
const TEACHER_SPEAK =
	/\b(laptops?\s+down|eyes?\s+up|observe the model(l?ing)?|observe the teacher|contribute to the class draft|move to the (back|rear)|from the (back|rear) of the room|workbookmaterials|oneNote template|teacher monitors|classroom management)\b[^.]*\.?/gi;

function text(value: unknown): string {
	if (value == null) return '';
	return String(value).trim();
}

function workbookWording(value: string): string {
	return value
		.replace(/\bdigital workbooks?\b/gi, 'workbook')
		.replace(/\bDigital Workbooks?\b/g, 'Workbook');
}

function studentSafe(value: string): string {
	return workbookWording(value)
		.replace(TEACHER_SPEAK, '')
		.replace(/\s{2,}/g, ' ')
		.replace(/\s+\./g, '.')
		.trim();
}

/** Prefer visible "I can…" goal; coerce cognitive-verb goals into that form. */
function asICanGoal(lesson: LessonPlan): string {
	const display = text(lesson.orientate?.learningGoalDisplay);
	const fallback = text(lesson.learningGoal);
	let goal = display || fallback;
	if (!goal) return '';
	goal = workbookWording(goal).replace(/\.$/, '');
	if (/^i can\b/i.test(goal)) {
		return goal.replace(/^i can/i, 'I can');
	}
	return `I can ${goal.charAt(0).toLowerCase()}${goal.slice(1)}`;
}

function run(content: string, opts: { bold?: boolean; italics?: boolean; size?: number } = {}) {
	return new TextRun({
		text: content,
		font: 'Arial',
		size: opts.size ?? 22,
		bold: opts.bold,
		italics: opts.italics
	});
}

function para(
	content: string,
	opts: { bold?: boolean; italics?: boolean; after?: number; before?: number } = {}
): Paragraph {
	return new Paragraph({
		spacing: { after: opts.after ?? 120, before: opts.before ?? 0 },
		children: [run(content, { bold: opts.bold, italics: opts.italics })]
	});
}

function heading(content: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel]): Paragraph {
	const size =
		level === HeadingLevel.HEADING_1
			? 32
			: level === HeadingLevel.HEADING_2
				? 28
				: level === HeadingLevel.HEADING_3
					? 24
					: 22;
	return new Paragraph({
		heading: level,
		spacing: { before: level === HeadingLevel.HEADING_4 ? 280 : 240, after: 120 },
		children: [run(content, { bold: true, size })]
	});
}

function thinBoxBorders() {
	const edge = { style: BorderStyle.SINGLE, size: 8, color: '666666' };
	return { top: edge, bottom: edge, left: edge, right: edge };
}

/** Label + bordered box around the student-facing workbook widget (teacher preview). */
function boxedStudentWorkbook(children: DocChild[]): DocChild[] {
	if (!children.length) return [];
	const width = 9000;
	return [
		para('Student workbook component', { bold: true, before: 140, after: 60 }),
		new Table({
			width: { size: width, type: WidthType.DXA },
			columnWidths: [width],
			rows: [
				new TableRow({
					cantSplit: true,
					children: [
						new TableCell({
							borders: thinBoxBorders(),
							width: { size: width, type: WidthType.DXA },
							shading: { fill: 'F5F5F5', type: ShadingType.CLEAR, color: 'auto' },
							margins: {
								top: convertInchesToTwip(0.12),
								bottom: convertInchesToTwip(0.12),
								left: convertInchesToTwip(0.14),
								right: convertInchesToTwip(0.14)
							},
							children
						})
					]
				})
			]
		}),
		para(' ', { after: 60 })
	];
}

function paragraphsFrom(content: string): Paragraph[] {
	const trimmed = text(content);
	if (!trimmed) return [];
	return trimmed.split(/\r?\n/).map((line) => para(line || ' '));
}

function labeled(label: string, content: string): Paragraph[] {
	const body = paragraphsFrom(content);
	if (!body.length) return [];
	return [para(label, { bold: true, after: 60, before: 80 }), ...body];
}

/** Strip Wait-Time stage directions from questioning text. */
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

/**
 * Format questioning as multiple Q + Expected pairs for the teacher doc.
 */
function questioningBlocks(raw: string): Paragraph[] {
	const cleaned = stripWaitTimeScripts(workbookWording(raw));
	if (!cleaned) return [];

	const pairs: Array<{ q: string; a: string }> = [];
	// "…? (Expected: …)" / "…? Expected: …" / "…? Sample: …"
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

	// Also pick up bare questions with no expected answer attached
	const bareRe = /([^?]+?\?)/g;
	while ((m = bareRe.exec(cleaned)) !== null) {
		const already = consumed.some((c) => m!.index >= c.start && m!.index < c.end);
		if (already) continue;
		const q = m[1].replace(/^\d+[\).:\s]+/, '').trim();
		if (q.length > 8) pairs.push({ q, a: '' });
	}

	if (!pairs.length) {
		return labeled('Questioning', cleaned);
	}

	const out: Paragraph[] = [para('Questioning', { bold: true, before: 80, after: 60 })];
	pairs.forEach((p, i) => {
		out.push(para(`Q${i + 1}. ${p.q}`, { after: 40 }));
		if (p.a) {
			out.push(para(`Expected: ${p.a}`, { italics: true, after: 100 }));
		}
	});
	return out;
}

/** Avoid printing literal "[object Object]" left by a bad stringify. */
function answerKeyText(activity: LessonActivity): string {
	const raw = text(activity.teacherAnswerKey);
	if (raw && raw !== '[object Object]') return workbookWording(raw);
	const model = activity.workbookSpec?.modelAnswer;
	if (typeof model === 'string' && model.trim()) return workbookWording(model.trim());
	// Last resort: scaffolding often holds the worked definitions
	const scaf = text(activity.scaffolding);
	if (scaf) return workbookWording(scaf);
	return '';
}

function pageBreak(): Paragraph {
	return new Paragraph({ children: [new PageBreak()] });
}

function writingLines(count: number): Paragraph[] {
	return Array.from({ length: count }, () =>
		new Paragraph({
			spacing: { after: 160 },
			border: {
				bottom: { style: BorderStyle.SINGLE, size: 6, color: '888888', space: 1 }
			},
			children: [run(' ')]
		})
	);
}

export function weeksWithLessons(plan: UnitPlan): TeachingWeek[] {
	return [...plan.teachingSequence]
		.filter((week) => (week.lessons?.length ?? 0) > 0)
		.sort((a, b) => Number(a.week.value) - Number(b.week.value));
}

function sortedLessons(week: TeachingWeek): LessonPlan[] {
	return [...(week.lessons ?? [])].sort((a, b) => a.lessonNumber - b.lessonNumber);
}

function unitSubtitle(plan: UnitPlan): string {
	const yearLevel = plan.yearLevel.value === '' ? '' : `Year ${plan.yearLevel.value}`;
	const unitNumber = plan.unitNumber.value === '' ? '' : `Unit ${plan.unitNumber.value}`;
	return [yearLevel, text(plan.subject.value), unitNumber].filter(Boolean).join('  ·  ');
}

function looksLikeClockRange(label: string): boolean {
	return /\d{1,2}\s*[:.]\s*\d{2}/.test(label);
}

/** Stage aliases wrongly stuffed into timeLabel by the model (e.g. "I Do: Modeling"). */
function looksLikeStageAlias(label: string): boolean {
	if (looksLikeClockRange(label)) return false;
	return /\b(i\s*do|we\s*do|you\s*do|vocabulary|guided[- ]?notes?|generative|model(l?ing)?|competitor study)\b/i.test(
		label
	);
}

function activityMeta(activity: LessonActivity): string {
	const stage = STAGE_LABEL[activity.stage] ?? activity.stage;
	const rawLabel = text(activity.timeLabel);
	// Prefer a real clock range; otherwise minutes. Never reprint stage text from timeLabel.
	const timing = looksLikeClockRange(rawLabel)
		? rawLabel
		: activity.minutes
			? `${activity.minutes} min`
			: rawLabel && !looksLikeStageAlias(rawLabel)
				? rawLabel
				: '';
	return [timing, stage].filter(Boolean).join('  ·  ');
}

function resolveActivityWidget(activity: LessonActivity) {
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

function pageNumberFooter(label: string): Footer {
	return new Footer({
		children: [
			new Paragraph({
				alignment: AlignmentType.RIGHT,
				children: [
					run(`${label}  ·  Page `, { size: 16, italics: true }),
					new TextRun({
						children: [PageNumber.CURRENT],
						font: 'Arial',
						size: 16
					})
				]
			})
		]
	});
}

function coverPage(opts: {
	school: string;
	eyebrow: string;
	title: string;
	subtitle: string;
	extra?: string[];
}): Paragraph[] {
	return [
		para(opts.school, { bold: true, after: 80 }),
		para(opts.eyebrow, { after: 200 }),
		new Paragraph({
			spacing: { after: 200 },
			children: [run(opts.title, { bold: true, size: 40 })]
		}),
		para(opts.subtitle, { after: 200 }),
		...((opts.extra ?? []).map((line) => para(line)))
	];
}

/**
 * Teacher activity block.
 * teacherDoes is generated but intentionally not printed for now (kept in JSON for later).
 */
function teacherActivity(activity: LessonActivity): DocChild[] {
	const title = activity.title || 'Activity';
	const meta = activityMeta(activity);
	const workbookSpec = resolveActivityWidget(activity);
	const headingText = meta ? `${title}  (${meta})` : title;

	const blocks: DocChild[] = [
		heading(headingText, HeadingLevel.HEADING_4),
		// Questioning first — teacher leads with planned Q&A
		...questioningBlocks(activity.questioning),
		// teacherDoes deliberately omitted from Word (still stored on the lesson JSON)
		...labeled('Students do', workbookWording(activity.studentsDo)),
		...labeled('Visible instructions', workbookWording(activity.visibleInstructions)),
		...labeled('Scaffolding / definitions', workbookWording(activity.scaffolding))
	];

	if (workbookSpec) {
		const kindLabel = activity.workbookKind || workbookSpec.type;
		blocks.push(
			...boxedStudentWorkbook([
				para(`Kind: ${kindLabel}`, { italics: true, after: 80 }),
				...renderWorkbookActivity(workbookSpec)
			])
		);
		blocks.push(...renderWorkbookModelAnswer(workbookSpec));
	} else if (text(activity.workbookMaterials)) {
		blocks.push(
			...boxedStudentWorkbook([
				...paragraphsFrom(workbookWording(activity.workbookMaterials ?? ''))
			])
		);
	}

	blocks.push(
		...labeled('Teacher answer key', answerKeyText(activity)),
		...labeled('Transition', workbookWording(activity.transition))
	);
	return blocks;
}

function teacherLesson(weekLabel: string, lesson: LessonPlan): DocChild[] {
	const path = PATH_LABEL[lesson.enhancePath] ?? lesson.enhancePath;
	const duration = lesson.durationMinutes || 60;
	const goal = asICanGoal(lesson);
	return [
		heading(
			`${weekLabel}  ·  Lesson ${lesson.lessonNumber}: ${lesson.title || 'Untitled'}`,
			HeadingLevel.HEADING_2
		),
		para(`${duration} minutes  ·  ${path}`),
		...(goal ? labeled('Learning goal', goal) : []),
		heading('Orientate (0–10 min)', HeadingLevel.HEADING_3),
		...labeled('SMART start', workbookWording(lesson.orientate?.smartStart ?? '')),
		heading('Enhance (10–50 min)', HeadingLevel.HEADING_3),
		...(lesson.enhance?.activities ?? []).flatMap(teacherActivity),
		heading('Culminate (50–60 min)', HeadingLevel.HEADING_3),
		...labeled('SMART finish', workbookWording(lesson.culminate?.smartFinish ?? '')),
		...labeled('Summarise', workbookWording(lesson.culminate?.summarise ?? '')),
		...labeled('Next steps', workbookWording(lesson.culminate?.nextSteps ?? '')),
		...labeled('Resources', workbookWording(lesson.resources))
	];
}

/** Drop instructions that only tell students to add headers already printed on the widget. */
function stripRedundantWidgetInstructions(prompt: string, spec: NonNullable<ReturnType<typeof resolveActivityWidget>>): string {
	let next = prompt;
	if (spec.type === 'table' && spec.headers.length) {
		next = next
			.replace(/\b(label|add|write|fill in|complete)\s+(the\s+)?headers?\b[^.?!]*[.?!]/gi, '')
			.replace(/\bheaders?\s+(of\s+your\s+)?(matrix|table)\s+(as|with|should be)\b[^.?!]*[.?!]/gi, '')
			.replace(/\blabel\s+[^.]{0,80}\bas\s+['"][^'"]+['"][^.?!]*[.?!]/gi, '');
		// If every named header is already in the table and the sentence is only about labelling them, drop leftover fragments
		const lower = next.toLowerCase();
		const onlyHeadersLeft = spec.headers.every((h) => lower.includes(h.toLowerCase()))
			&& !/\b(tick|compare|rate|justify|complete the|fill|write about|explain)\b/i.test(next);
		if (onlyHeadersLeft && /['"]/.test(next)) {
			next = '';
		}
	}
	if (spec.type === 'checklist' && spec.items.length) {
		next = next.replace(/\b(copy|write|add)\s+(the\s+)?(checklist|criteria)\b[^.?!]*[.?!]/gi, '');
	}
	return next.replace(/\s{2,}/g, ' ').replace(/\s+([,.;])/g, '$1').trim();
}

/** Student payload: goal, task prompt, rendered component only — no teacher scripts. */
function studentActivity(activity: LessonActivity): DocChild[] {
	const title = activity.title || 'Activity';
	const workbookSpec = resolveActivityWidget(activity);
	let prompt =
		studentSafe(activity.visibleInstructions) ||
		studentSafe(activity.studentsDo);
	if (prompt && workbookSpec) {
		prompt = stripRedundantWidgetInstructions(prompt, workbookSpec);
	}
	// Prefer the widget's own prompt if the activity instruction was only redundant setup
	if (!prompt && workbookSpec?.prompt) {
		prompt = studentSafe(workbookSpec.prompt);
	}

	const blocks: DocChild[] = [
		para(title, { bold: true, before: 160, after: 80 })
	];

	// Don't reprint prompt if the widget will print the same (or near-same) prompt
	const widgetPrompt = workbookSpec?.prompt ? studentSafe(workbookSpec.prompt) : '';
	const shouldPrintPrompt =
		Boolean(prompt) &&
		(!widgetPrompt || prompt.toLowerCase() !== widgetPrompt.toLowerCase());

	if (shouldPrintPrompt) {
		blocks.push(...paragraphsFrom(prompt));
	}

	if (workbookSpec) {
		blocks.push(...renderWorkbookActivity(workbookSpec));
	} else {
		blocks.push(
			para(
				'(No workbook component — regenerate with Enrich materials so this activity gets a catalog kind.)',
				{ italics: true, after: 60 }
			)
		);
		blocks.push(...writingLines(3));
	}
	return blocks;
}

function studentSmartStart(lesson: LessonPlan): DocChild[] {
	const start = studentSafe(lesson.orientate?.smartStart ?? '');
	const rankingHint = /rank/i.test(start);
	const blocks: DocChild[] = [
		para('SMART start', { bold: true, before: 80, after: 60 }),
		...paragraphsFrom(start)
	];
	if (rankingHint) {
		// Prefer a ranking widget if the start describes ranking without a bank — still give lines
		blocks.push(...writingLines(6));
	} else {
		blocks.push(...writingLines(4));
	}
	return blocks;
}

function studentLesson(weekLabel: string, lesson: LessonPlan): DocChild[] {
	const goal = asICanGoal(lesson);
	const exit = exitTicketFromSmartFinish(lesson.culminate?.smartFinish ?? '');
	return [
		heading(
			`${weekLabel}  ·  Lesson ${lesson.lessonNumber}: ${lesson.title || 'Untitled'}`,
			HeadingLevel.HEADING_2
		),
		...(goal ? labeled('Learning goal', goal) : []),
		...studentSmartStart(lesson),
		...(lesson.enhance?.activities ?? []).flatMap(studentActivity),
		para('SMART finish', { bold: true, before: 160, after: 60 }),
		...(exit
			? renderWorkbookActivity(exit)
			: [
					...paragraphsFrom(studentSafe(lesson.culminate?.smartFinish ?? '')),
					...writingLines(4)
				]),
		...labeled('Next lesson', studentSafe(lesson.culminate?.nextSteps ?? ''))
	];
}

async function pack(children: DocChild[], opts: { header: string; footer: string }): Promise<Buffer> {
	const doc = new Document({
		styles: {
			default: {
				document: {
					run: { font: 'Arial', size: 22 }
				}
			},
			paragraphStyles: [
				{
					id: 'Heading1',
					name: 'Heading 1',
					basedOn: 'Normal',
					next: 'Normal',
					run: { font: 'Arial', size: 32, bold: true },
					paragraph: { spacing: { before: 240, after: 120 } }
				},
				{
					id: 'Heading2',
					name: 'Heading 2',
					basedOn: 'Normal',
					next: 'Normal',
					run: { font: 'Arial', size: 28, bold: true },
					paragraph: { spacing: { before: 240, after: 120 } }
				},
				{
					id: 'Heading3',
					name: 'Heading 3',
					basedOn: 'Normal',
					next: 'Normal',
					run: { font: 'Arial', size: 24, bold: true },
					paragraph: { spacing: { before: 200, after: 100 } }
				},
				{
					id: 'Heading4',
					name: 'Heading 4',
					basedOn: 'Normal',
					next: 'Normal',
					run: { font: 'Arial', size: 22, bold: true },
					paragraph: { spacing: { before: 280, after: 120 } }
				}
			]
		},
		sections: [
			{
				properties: {
					page: {
						margin: {
							top: convertInchesToTwip(0.7),
							bottom: convertInchesToTwip(0.7),
							left: convertInchesToTwip(0.75),
							right: convertInchesToTwip(0.75)
						}
					}
				},
				headers: {
					default: new Header({
						children: [
							new Paragraph({
								border: {
									bottom: {
										style: BorderStyle.SINGLE,
										size: 6,
										color: 'CCCCCC',
										space: 4
									}
								},
								children: [run(opts.header, { size: 16, italics: true })]
							})
						]
					})
				},
				footers: { default: pageNumberFooter(opts.footer) },
				children
			}
		]
	});
	return Packer.toBuffer(doc);
}

export async function buildLessonPlansTeacherDocx(
	plan: UnitPlan,
	school = "St Brendan's College (Yeppoon)"
): Promise<Buffer> {
	const weeks = weeksWithLessons(plan);
	if (!weeks.length) throw new Error('No lesson plans to export');

	const children: DocChild[] = [
		...coverPage({
			school,
			eyebrow: 'Teacher document  ·  ASPIRE (Orientate → Enhance → Culminate)',
			title: text(plan.unitTitle.value) || 'Unit',
			subtitle: unitSubtitle(plan),
			extra: [
				'60-minute lessons using Orientate / Enhance / Culminate (SMART start & finish).',
				'Includes questioning, scaffolding/definitions, rendered workbook artefacts, and answer keys.',
				'Teacher delivery scripts (teacherDoes) are stored in the app but not printed in this export.'
			]
		}),
		pageBreak()
	];

	for (const [index, week] of weeks.entries()) {
		if (index > 0) children.push(pageBreak());
		const weekLabel = `Week ${week.week.value}`;
		children.push(heading(weekLabel, HeadingLevel.HEADING_1));
		const theme = text(week.outlineTheme?.value);
		if (theme) children.push(...labeled('Week outline', theme));
		for (const lesson of sortedLessons(week)) {
			children.push(...teacherLesson(weekLabel, lesson));
		}
	}

	return pack(children, {
		header: `${school}  ·  ${text(plan.unitTitle.value) || 'Unit'}  ·  Teacher lesson plans`,
		footer: 'Teacher'
	});
}

export async function buildLessonPlansStudentDocx(
	plan: UnitPlan,
	school = "St Brendan's College (Yeppoon)"
): Promise<Buffer> {
	const weeks = weeksWithLessons(plan);
	if (!weeks.length) throw new Error('No lesson plans to export');

	const children: DocChild[] = [
		...coverPage({
			school,
			eyebrow: 'Student workbook',
			title: text(plan.unitTitle.value) || 'Unit',
			subtitle: unitSubtitle(plan),
			extra: [
				'Name: ________________________________    Class: ________',
				'Write in pencil. Keep this workbook for the whole unit.'
			]
		})
	];

	for (const week of weeks) {
		const weekLabel = `Week ${week.week.value}`;
		for (const lesson of sortedLessons(week)) {
			children.push(pageBreak());
			children.push(...studentLesson(weekLabel, lesson));
		}
	}

	return pack(children, {
		header: `${text(plan.unitTitle.value) || 'Unit'}  ·  Student workbook`,
		footer: 'Student'
	});
}
