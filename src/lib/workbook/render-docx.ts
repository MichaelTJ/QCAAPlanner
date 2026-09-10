import {
	AlignmentType,
	BorderStyle,
	HeightRule,
	Paragraph,
	ShadingType,
	Table,
	TableCell,
	TableRow,
	TextRun,
	VerticalAlign,
	WidthType,
	convertInchesToTwip
} from 'docx';
import { WRITE_LINES_PER_SENTENCE, type WorkbookActivity, type WorkbookCell, type WorkbookSitemapNode } from './types';

type DocChild = Paragraph | Table;

const PAGE_WIDTH = 9000;
/** Narrow first column for cloze blank numbers. */
const CLOZE_NUM_WIDTH = 700;

function run(
	content: string,
	opts: {
		bold?: boolean;
		italics?: boolean;
		size?: number;
		color?: string;
		font?: string;
	} = {}
) {
	return new TextRun({
		text: content,
		font: opts.font ?? 'Arial',
		size: opts.size ?? 22,
		bold: opts.bold,
		italics: opts.italics,
		color: opts.color
	});
}

function para(
	content: string,
	opts: { bold?: boolean; italics?: boolean; after?: number; before?: number; size?: number } = {}
): Paragraph {
	return new Paragraph({
		spacing: { after: opts.after ?? 100, before: opts.before ?? 0 },
		children: content ? [run(content, opts)] : [run(' ')]
	});
}

/** Write-on line: bottom border (empty paragraphs collapse in Word). */
function writeLine(prefix = ''): Paragraph {
	return new Paragraph({
		spacing: { after: 180 },
		border: {
			bottom: { style: BorderStyle.SINGLE, size: 8, color: '666666', space: 1 }
		},
		children: [run(prefix ? `${prefix} ` : '\u00a0')]
	});
}

function writeLines(count: number, numbered = false): Paragraph[] {
	return Array.from({ length: Math.max(1, count) }, (_, i) =>
		writeLine(numbered ? `${i + 1}.` : '')
	);
}

/**
 * One sentence-length response = WRITE_LINES_PER_SENTENCE bordered lines.
 * Numbered items: label on first line, continuation lines blank.
 */
function sentenceResponseLines(count: number, numbered = false): Paragraph[] {
	const out: Paragraph[] = [];
	const items = Math.max(1, count);
	for (let i = 0; i < items; i++) {
		const prefix = numbered ? `${i + 1}.` : '';
		out.push(writeLine(prefix));
		for (let extra = 1; extra < WRITE_LINES_PER_SENTENCE; extra++) {
			out.push(writeLine());
		}
	}
	return out;
}

function thinBorders(color = '666666') {
	const edge = { style: BorderStyle.SINGLE, size: 4, color };
	return { top: edge, bottom: edge, left: edge, right: edge };
}

function faintBorders() {
	return thinBorders('BBBBBB');
}

function nilBorders() {
	const edge = { style: BorderStyle.NIL, size: 0, color: 'FFFFFF' };
	return { top: edge, bottom: edge, left: edge, right: edge };
}

function nameDateRow(): Table {
	const w = PAGE_WIDTH;
	const left = Math.floor(w * 0.55);
	const right = w - left;
	return new Table({
		width: { size: w, type: WidthType.DXA },
		columnWidths: [left, right],
		rows: [
			new TableRow({
				children: [
					new TableCell({
						borders: {
							top: { style: BorderStyle.NIL, size: 0, color: 'FFFFFF' },
							left: { style: BorderStyle.NIL, size: 0, color: 'FFFFFF' },
							right: { style: BorderStyle.NIL, size: 0, color: 'FFFFFF' },
							bottom: { style: BorderStyle.SINGLE, size: 6, color: '888888' }
						},
						width: { size: left, type: WidthType.DXA },
						margins: { top: 40, bottom: 40, left: 0, right: 80 },
						children: [new Paragraph({ children: [run('Name: ', { size: 18 })] })]
					}),
					new TableCell({
						borders: {
							top: { style: BorderStyle.NIL, size: 0, color: 'FFFFFF' },
							left: { style: BorderStyle.NIL, size: 0, color: 'FFFFFF' },
							right: { style: BorderStyle.NIL, size: 0, color: 'FFFFFF' },
							bottom: { style: BorderStyle.SINGLE, size: 6, color: '888888' }
						},
						width: { size: right, type: WidthType.DXA },
						margins: { top: 40, bottom: 40, left: 0, right: 0 },
						children: [new Paragraph({ children: [run('Date: ', { size: 18 })] })]
					})
				]
			})
		]
	});
}

function padCell(
	children: Paragraph[],
	width: number,
	opts: {
		borders?: {
			top: { style: (typeof BorderStyle)[keyof typeof BorderStyle]; size: number; color: string };
			bottom: { style: (typeof BorderStyle)[keyof typeof BorderStyle]; size: number; color: string };
			left: { style: (typeof BorderStyle)[keyof typeof BorderStyle]; size: number; color: string };
			right: { style: (typeof BorderStyle)[keyof typeof BorderStyle]; size: number; color: string };
		};
		shading?: string;
	} = {}
): TableCell {
	return new TableCell({
		borders: opts.borders ?? thinBorders(),
		width: { size: width, type: WidthType.DXA },
		margins: {
			top: convertInchesToTwip(0.05),
			bottom: convertInchesToTwip(0.05),
			left: convertInchesToTwip(0.06),
			right: convertInchesToTwip(0.06)
		},
		shading: opts.shading
			? { fill: opts.shading, type: ShadingType.CLEAR, color: 'auto' }
			: undefined,
		children: children.length ? children : [para(' ')]
	});
}

function textCell(text: string, width: number, opts: { bold?: boolean; blank?: boolean } = {}): TableCell {
	return padCell(
		[
			new Paragraph({
				spacing: { after: 40 },
				children: text
					? [run(text, { bold: opts.bold })]
					: opts.blank
						? [run('\u00a0')]
						: [run(' ')]
			})
		],
		width
	);
}

/** One-character bordered tick box — more reliable than ☐ glyph. */
function tickBoxCell(width = 450): TableCell {
	return new TableCell({
		borders: thinBorders('333333'),
		width: { size: width, type: WidthType.DXA },
		verticalAlign: VerticalAlign.CENTER,
		margins: { top: 60, bottom: 60, left: 60, right: 60 },
		children: [new Paragraph({ children: [run('\u00a0', { size: 18 })] })]
	});
}

function stimulusBlock(stimulus?: string): DocChild[] {
	if (!stimulus) return [];
	return [
		new Table({
			width: { size: PAGE_WIDTH, type: WidthType.DXA },
			columnWidths: [PAGE_WIDTH],
			rows: [
				new TableRow({
					cantSplit: true,
					children: [
						new TableCell({
							borders: thinBorders('888888'),
							width: { size: PAGE_WIDTH, type: WidthType.DXA },
							shading: { fill: 'F7F7F7', type: ShadingType.CLEAR, color: 'auto' },
							margins: { top: 80, bottom: 80, left: 100, right: 100 },
							children: [
								para('Stimulus', { bold: true, size: 18, after: 40 }),
								para(stimulus, { after: 40 })
							]
						})
					]
				})
			]
		}),
		para(' ', { after: 80 })
	];
}

/** Name/date once per workbook page — not per activity. */
export function renderWorkbookNameDate(): Table {
	return nameDateRow();
}

function headingBlock(activity: WorkbookActivity): DocChild[] {
	const out: DocChild[] = [];
	if (activity.title) out.push(para(activity.title, { bold: true, before: 40, after: 60 }));
	if (activity.prompt) out.push(para(activity.prompt, { after: 80 }));
	out.push(...stimulusBlock(activity.stimulus));
	return out;
}

/**
 * Tick cell: single bordered square, optionally with a short caption under it.
 * No nested 2×1 table (that was printing “sub-boxes” inside Info/Action cells).
 */
function renderCell(c: WorkbookCell, width: number): TableCell {
	if (c.mode === 'tick') {
		const children: Paragraph[] = [
			new Paragraph({
				alignment: AlignmentType.CENTER,
				spacing: { after: c.value ? 40 : 0 },
				border: {
					top: { style: BorderStyle.SINGLE, size: 8, color: '333333', space: 4 },
					bottom: { style: BorderStyle.SINGLE, size: 8, color: '333333', space: 4 },
					left: { style: BorderStyle.SINGLE, size: 8, color: '333333', space: 4 },
					right: { style: BorderStyle.SINGLE, size: 8, color: '333333', space: 4 }
				},
				indent: { left: 200, right: 200 },
				children: [run('\u00a0\u00a0', { size: 18 })]
			})
		];
		if (c.value) {
			children.push(
				new Paragraph({
					alignment: AlignmentType.CENTER,
					spacing: { before: 40, after: 0 },
					children: [run(c.value, { size: 16 })]
				})
			);
		}
		return new TableCell({
			borders: thinBorders(),
			width: { size: width, type: WidthType.DXA },
			verticalAlign: VerticalAlign.CENTER,
			margins: { top: 60, bottom: 60, left: 80, right: 80 },
			children
		});
	}
	if (c.mode === 'blank') {
		return padCell(
			[
				new Paragraph({
					spacing: { after: 40 },
					border: {
						bottom: { style: BorderStyle.SINGLE, size: 6, color: '999999', space: 1 }
					},
					children: [run(c.value ? c.value : '\u00a0')]
				}),
				writeLine(),
				writeLine()
			],
			width
		);
	}
	return textCell(c.value ?? '', width, { bold: false });
}

function columnWidthsForHeaders(headers: string[], total = PAGE_WIDTH): number[] {
	const colCount = Math.max(headers.length, 1);
	const lower = headers.map((h) => h.toLowerCase());
	// Cloze-style Blank | Answer
	if (colCount === 2 && (lower[0] === 'blank' || lower[0] === '#' || lower[0] === 'no.')) {
		return [CLOZE_NUM_WIDTH, total - CLOZE_NUM_WIDTH];
	}
	// Classify: Item | tick | tick — give locked column more space
	const tickish = lower.filter((h) =>
		['info', 'action', 'yes', 'no', 'tick', '✓', 'check'].includes(h)
	).length;
	if (tickish >= 2 && colCount >= 3) {
		const tickW = 900;
		const rest = total - tickW * tickish;
		const otherCount = colCount - tickish;
		const otherW = Math.floor(rest / Math.max(1, otherCount));
		return headers.map((h) =>
			['info', 'action', 'yes', 'no', 'tick', '✓', 'check'].includes(h.toLowerCase())
				? tickW
				: otherW
		);
	}
	const colWidth = Math.floor(total / colCount);
	return Array.from({ length: colCount }, () => colWidth);
}

function renderTableWidget(headers: string[], rows: WorkbookCell[][]): Table {
	const colCount = Math.max(headers.length, 1);
	const total = PAGE_WIDTH;
	const widths = columnWidthsForHeaders(headers, total);

	const headerRow = new TableRow({
		tableHeader: true,
		children: headers.map((h, i) =>
			padCell(
				[new Paragraph({ children: [run(h, { bold: true })] })],
				widths[i] ?? Math.floor(total / colCount),
				{ shading: 'F0F0F0' }
			)
		)
	});

	const bodyRows = rows.map(
		(row) =>
			new TableRow({
				cantSplit: true,
				children: Array.from({ length: colCount }, (_, i) =>
					renderCell(row[i] ?? { mode: 'blank', value: '' }, widths[i] ?? Math.floor(total / colCount))
				)
			})
	);

	return new Table({
		width: { size: total, type: WidthType.DXA },
		columnWidths: widths,
		rows: [headerRow, ...bodyRows]
	});
}

function clozeAnswerKey(blanks: string[]): Table {
	const numW = CLOZE_NUM_WIDTH;
	const ansW = PAGE_WIDTH - numW;
	const headerRow = new TableRow({
		tableHeader: true,
		children: [
			padCell([new Paragraph({ children: [run('#', { bold: true })] })], numW, {
				shading: 'F0F0F0'
			}),
			padCell([new Paragraph({ children: [run('Answer', { bold: true })] })], ansW, {
				shading: 'F0F0F0'
			})
		]
	});
	const body = blanks.map(
		(n) =>
			new TableRow({
				cantSplit: true,
				children: [
					padCell(
						[new Paragraph({ alignment: AlignmentType.CENTER, children: [run(n)] })],
						numW
					),
					padCell([writeLine(), writeLine()], ansW)
				]
			})
	);
	return new Table({
		width: { size: PAGE_WIDTH, type: WidthType.DXA },
		columnWidths: [numW, ansW],
		rows: [headerRow, ...body]
	});
}

/** Stable scramble for deterministic Word exports. */
function stableScramble(items: string[]): string[] {
	const out = [...items];
	let seed = items.reduce((a, s) => a + s.length * 17 + s.charCodeAt(0), 7);
	const rand = () => {
		seed = (seed * 1103515245 + 12345) & 0x7fffffff;
		return seed / 0x7fffffff;
	};
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(rand() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}

function clozeRuns(text: string): TextRun[] {
	const parts = text.split(/(\{\{\d+\}\})/g);
	const runs: TextRun[] = [];
	for (const part of parts) {
		const m = part.match(/^\{\{(\d+)\}\}$/);
		if (m) {
			runs.push(run(`(${m[1]}) `, { size: 20, bold: true }));
			runs.push(
				new TextRun({
					text: '_______________',
					font: 'Arial',
					size: 22,
					underline: {}
				})
			);
		} else if (part) {
			runs.push(run(part));
		}
	}
	return runs.length ? runs : [run(text || ' ')];
}

function codeLineRuns(line: string): TextRun[] {
	const parts = line.split(/(\{\{\d+\}\})/g);
	const runs: TextRun[] = [];
	for (const part of parts) {
		const m = part.match(/^\{\{(\d+)\}\}$/);
		if (m) {
			runs.push(
				new TextRun({
					text: `___${m[1]}___`,
					font: 'Consolas',
					size: 18,
					underline: {},
					bold: true
				})
			);
		} else if (part) {
			runs.push(run(part.replace(/ /g, '\u00a0') || ' ', { font: 'Consolas', size: 18 }));
		}
	}
	return runs.length ? runs : [run(' ', { font: 'Consolas', size: 18 })];
}

function scaleRow(left: string, right: string, scale: number): Table {
	const n = Math.max(2, Math.min(10, scale));
	const labelW = 1600;
	const tickW = Math.floor((PAGE_WIDTH - labelW * 2) / n);
	const children: TableCell[] = [
		padCell([para(left, { size: 18, after: 0 })], labelW, { borders: faintBorders() })
	];
	for (let i = 1; i <= n; i++) {
		children.push(
			new TableCell({
				borders: thinBorders('333333'),
				width: { size: tickW, type: WidthType.DXA },
				verticalAlign: VerticalAlign.CENTER,
				margins: { top: 40, bottom: 40, left: 20, right: 20 },
				children: [
					new Paragraph({
						alignment: AlignmentType.CENTER,
						children: [run(String(i), { bold: true, size: 18 })]
					}),
					new Paragraph({
						alignment: AlignmentType.CENTER,
						children: [run('\u00a0', { size: 16 })]
					})
				]
			})
		);
	}
	children.push(padCell([para(right, { size: 18, after: 0 })], labelW, { borders: faintBorders() }));
	return new Table({
		width: { size: PAGE_WIDTH, type: WidthType.DXA },
		columnWidths: [labelW, ...Array.from({ length: n }, () => tickW), labelW],
		rows: [new TableRow({ cantSplit: true, children })]
	});
}

function wireframeStencil(regions: Array<{ label: string }>, heightInches: number): Table {
	const w = PAGE_WIDTH;
	const bodyH = convertInchesToTwip(Math.max(2.5, heightInches));
	const regionRows =
		regions.length >= 3
			? regions
			: [{ label: 'Header / nav' }, { label: 'Main content' }, { label: 'Footer' }];

	const topChrome = new TableRow({
		cantSplit: true,
		children: [
			new TableCell({
				borders: thinBorders('999999'),
				width: { size: w, type: WidthType.DXA },
				shading: { fill: 'EEEEEE', type: ShadingType.CLEAR, color: 'auto' },
				margins: { top: 40, bottom: 40, left: 80, right: 80 },
				children: [
					new Paragraph({
						children: [
							run('● ● ●   ', { size: 16, color: '999999' }),
							run('browser / app chrome', { size: 16, italics: true, color: '666666' })
						]
					})
				]
			})
		]
	});

	const body = regionRows.map(
		(region, idx) =>
			new TableRow({
				cantSplit: true,
				height: {
					value: Math.floor(bodyH / regionRows.length),
					rule: HeightRule.ATLEAST
				},
				children: [
					new TableCell({
						borders: faintBorders(),
						width: { size: w, type: WidthType.DXA },
						margins: { top: 80, bottom: 80, left: 100, right: 100 },
						children: [
							new Paragraph({
								children: [run(`[ ${region.label} ]`, { italics: true, size: 18, color: '888888' })]
							}),
							...(idx === 1 ? writeLines(2) : [para('\u00a0', { after: 40 })])
						]
					})
				]
			})
	);

	return new Table({
		width: { size: w, type: WidthType.DXA },
		columnWidths: [w],
		rows: [topChrome, ...body]
	});
}

function arrowPara(): Paragraph {
	return new Paragraph({
		alignment: AlignmentType.CENTER,
		spacing: { after: 40, before: 40 },
		children: [run('↓', { size: 28, bold: true, color: '555555' })]
	});
}

function renderBody(activity: WorkbookActivity): DocChild[] {
	switch (activity.type) {
		case 'table': {
			const out: DocChild[] = [];
			if (activity.bank?.length) {
				const bank = stableScramble(activity.bank);
				out.push(
					para('Definitions (scrambled — write the matching letter beside each term):', {
						bold: true,
						after: 40
					})
				);
				out.push(
					para(bank.map((item, i) => `${String.fromCharCode(65 + i)}. ${item}`).join('\n'), {
						after: 120
					})
				);
			}
			out.push(renderTableWidget(activity.headers, activity.rows));
			return out;
		}

		case 'written': {
			const out: DocChild[] = [];
			if (activity.starter) out.push(para(activity.starter, { italics: true, after: 60 }));
			if (activity.sections?.length) {
				for (const section of activity.sections) {
					out.push(para(section.label, { bold: true, before: 80, after: 40 }));
					out.push(...sentenceResponseLines(section.lines, true));
				}
			} else if (activity.numbered) {
				out.push(...sentenceResponseLines(activity.lines ?? 3, true));
			} else {
				// Free written: at least 3 lines for a sentence; honour larger line counts as total lines
				const total = Math.max(WRITE_LINES_PER_SENTENCE, activity.lines ?? WRITE_LINES_PER_SENTENCE);
				out.push(...writeLines(total));
			}
			return out;
		}

		case 'ranking': {
			const bank = stableScramble(
				activity.bank.length ? activity.bank : ['Item A', 'Item B', 'Item C']
			);
			const out: DocChild[] = [
				para(activity.directionLabel || 'Most important → least', { italics: true, after: 60 }),
				para('Item bank (scramble — write each once into the slots below):', {
					bold: true,
					after: 40
				}),
				para(bank.map((b, i) => `${String.fromCharCode(65 + i)}. ${b}`).join('    '), {
					after: 120
				})
			];
			out.push(para('Your ranking:', { bold: true, after: 40 }));
			for (let i = 0; i < activity.slots; i++) {
				out.push(writeLine(`${i + 1}.`));
				for (let extra = 1; extra < WRITE_LINES_PER_SENTENCE; extra++) {
					out.push(writeLine());
				}
			}
			return out;
		}

		case 'sort': {
			const bank = stableScramble(activity.bank);
			const lines = activity.linesPerBucket ?? 4;
			const out: DocChild[] = [
				para('Item bank (use each once):', { bold: true, after: 40 }),
				para(bank.map((b, i) => `${String.fromCharCode(65 + i)}. ${b}`).join('    '), {
					after: 120
				})
			];
			const colCount = Math.min(3, Math.max(1, activity.buckets.length));
			const colW = Math.floor(PAGE_WIDTH / colCount);
			// Render buckets in rows of up to 3
			for (let i = 0; i < activity.buckets.length; i += colCount) {
				const slice = activity.buckets.slice(i, i + colCount);
				while (slice.length < colCount) slice.push('');
				out.push(
					new Table({
						width: { size: PAGE_WIDTH, type: WidthType.DXA },
						columnWidths: Array.from({ length: colCount }, () => colW),
						rows: [
							new TableRow({
								cantSplit: true,
								children: slice.map((bucket) =>
									bucket
										? padCell(
												[para(bucket, { bold: true, after: 40 }), ...writeLines(lines)],
												colW
											)
										: padCell([para(' ')], colW, { borders: nilBorders() })
								)
							})
						]
					})
				);
				out.push(para(' ', { after: 80 }));
			}
			return out;
		}

		case 'checklist': {
			const labelW = PAGE_WIDTH - 500;
			return [
				new Table({
					width: { size: PAGE_WIDTH, type: WidthType.DXA },
					columnWidths: [500, labelW],
					rows: activity.items.map(
						(item) =>
							new TableRow({
								cantSplit: true,
								children: [tickBoxCell(500), textCell(item, labelW)]
							})
					)
				})
			];
		}

		case 'cloze': {
			const out: DocChild[] = [
				new Paragraph({
					spacing: { after: 120 },
					children: clozeRuns(activity.text)
				})
			];
			if (activity.wordBank?.length) {
				const bank = stableScramble(activity.wordBank);
				out.push(para(`Word bank: ${bank.join(' · ')}`, { italics: true, after: 60 }));
			}
			const blanks = [...activity.text.matchAll(/\{\{(\d+)\}\}/g)].map((m) => m[1]);
			if (blanks.length) {
				out.push(
					para('Overflow only (if handwriting won’t fit in the sentence):', {
						size: 16,
						italics: true,
						after: 40
					})
				);
				out.push(clozeAnswerKey(blanks));
			}
			return out;
		}

		case 'continuum': {
			return [
				scaleRow(activity.left, activity.right, activity.scale),
				para('Circle one number above, then justify:', { italics: true, before: 120, after: 60 }),
				...writeLines(Math.max(WRITE_LINES_PER_SENTENCE, activity.lines ?? WRITE_LINES_PER_SENTENCE))
			];
		}

		case 'overlap': {
			const lines = Math.max(WRITE_LINES_PER_SENTENCE, activity.lines);
			const colW = Math.floor(PAGE_WIDTH / 3);
			const section = (title: string) =>
				padCell(
					[para(title, { bold: true, after: 40, size: 18 }), ...writeLines(lines)],
					colW,
					{ borders: thinBorders() }
				);
			return [
				new Table({
					width: { size: PAGE_WIDTH, type: WidthType.DXA },
					columnWidths: [colW, colW, colW],
					rows: [
						new TableRow({
							cantSplit: true,
							children: [
								section(`Only ${activity.leftLabel}`),
								section('Both'),
								section(`Only ${activity.rightLabel}`)
							]
						})
					]
				})
			];
		}

		case 'graphic': {
			const h = activity.heightInches ?? 3.2;
			return [
				para(`Must include: ${activity.mustInclude.join(' · ')}`, { italics: true, after: 60 }),
				new Table({
					width: { size: PAGE_WIDTH, type: WidthType.DXA },
					columnWidths: [PAGE_WIDTH],
					rows: [
						new TableRow({
							cantSplit: true,
							height: {
								value: convertInchesToTwip(h),
								rule: HeightRule.ATLEAST
							},
							children: [
								new TableCell({
									borders: thinBorders(),
									width: { size: PAGE_WIDTH, type: WidthType.DXA },
									margins: { top: 80, bottom: 80, left: 100, right: 100 },
									children: [
										para('(Sketch here)', { italics: true, size: 18 }),
										...activity.mustInclude.map((label) =>
											para(`• ${label}`, { size: 16, after: 40 })
										)
									]
								})
							]
						})
					]
				})
			];
		}

		case 'wireframe':
			return [
				para(`Must include: ${activity.mustInclude.join(' · ')}`, { italics: true, after: 60 }),
				wireframeStencil(activity.regions ?? [], activity.heightInches ?? 4)
			];

		case 'storyboard': {
			const frames = activity.frames;
			const linesPer = activity.linesPerFrame ?? 2;
			// Always a 2-column grid (2×2 / 3×2) — never a tall stack of full-width frames
			const cols = 2;
			const out: DocChild[] = [];
			for (let i = 0; i < frames.length; i += cols) {
				const display = frames.slice(i, i + cols);
				const colW = Math.floor(PAGE_WIDTH / cols);
				const cells = Array.from({ length: cols }, (_, ci) => {
					const frame = display[ci];
					if (!frame) {
						return padCell([para(' ')], colW, { borders: nilBorders() });
					}
					return padCell(
						[
							para(frame.label || `Frame ${i + ci + 1}`, { bold: true, size: 18, after: 40 }),
							para('(sketch)', { italics: true, size: 16, after: 40 }),
							...writeLines(linesPer)
						],
						colW
					);
				});
				out.push(
					new Table({
						width: { size: PAGE_WIDTH, type: WidthType.DXA },
						columnWidths: Array.from({ length: cols }, () => colW),
						rows: [
							new TableRow({
								cantSplit: true,
								height: {
									value: convertInchesToTwip(1.45),
									rule: HeightRule.ATLEAST
								},
								children: cells
							})
						]
					})
				);
				out.push(para(' ', { after: 40 }));
			}
			return out;
		}

		case 'flow': {
			const out: DocChild[] = [];
			const stageBox = (num: number | null, stage: { label?: string; blank?: boolean }) => {
				const label = stage.blank || !stage.label ? '' : stage.label;
				const numW = 900;
				const bodyW = PAGE_WIDTH - numW;
				return new Table({
					width: { size: PAGE_WIDTH, type: WidthType.DXA },
					columnWidths: [numW, bodyW],
					rows: [
						new TableRow({
							cantSplit: true,
							children: [
								padCell(
									[
										new Paragraph({
											alignment: AlignmentType.CENTER,
											children: [run(num == null ? '·' : String(num), { bold: true })]
										})
									],
									numW,
									{ shading: 'F0F0F0' }
								),
								padCell(label ? [para(label, { after: 40 })] : [writeLine(), writeLine()], bodyW)
							]
						})
					]
				});
			};

			activity.stages.forEach((stage, idx) => {
				out.push(stageBox(idx + 1, stage));
				const isLastPreBranch =
					activity.branchAfter != null && idx === activity.branchAfter;
				const isLast = idx === activity.stages.length - 1;
				if (isLastPreBranch) {
					out.push(arrowPara());
					const half = Math.floor(PAGE_WIDTH / 2);
					const pathCell = (
						branchTitle: string,
						path?: { label?: string; blank?: boolean }
					) => {
						const body =
							path && !path.blank && path.label
								? [para(path.label, { after: 40 })]
								: [writeLine(), writeLine()];
						return padCell(
							[para(branchTitle, { bold: true, size: 18, after: 40 }), ...body],
							half
						);
					};
					out.push(
						new Table({
							width: { size: PAGE_WIDTH, type: WidthType.DXA },
							columnWidths: [half, half],
							rows: [
								new TableRow({
									cantSplit: true,
									children: [
										pathCell(`${activity.yesLabel || 'Yes'} →`, activity.yesPath),
										pathCell(`${activity.noLabel || 'No'} →`, activity.noPath)
									]
								})
							]
						})
					);
					if (activity.rejoin) {
						out.push(
							new Paragraph({
								alignment: AlignmentType.CENTER,
								spacing: { after: 40, before: 60 },
								children: [run('↘  rejoin  ↙', { size: 20, color: '555555' })]
							})
						);
						out.push(stageBox(null, activity.rejoin));
					}
				} else if (!isLast) {
					out.push(arrowPara());
				}
			});
			return out;
		}

		case 'code': {
			const lineNoW = 600;
			const codeW = PAGE_WIDTH - lineNoW;
			const out: DocChild[] = [];
			if (activity.mode === 'circle_bug') {
				out.push(para('Circle the bug, then explain below.', { italics: true, after: 60 }));
			} else {
				out.push(para('Fill each numbered hole in the code.', { italics: true, after: 60 }));
			}
			out.push(
				new Table({
					width: { size: PAGE_WIDTH, type: WidthType.DXA },
					columnWidths: [lineNoW, codeW],
					rows: activity.lines.map(
						(line, i) =>
							new TableRow({
								cantSplit: true,
								children: [
									new TableCell({
										borders: faintBorders(),
										width: { size: lineNoW, type: WidthType.DXA },
										shading: { fill: 'F5F5F5', type: ShadingType.CLEAR, color: 'auto' },
										margins: { top: 20, bottom: 20, left: 40, right: 40 },
										children: [
											new Paragraph({
												alignment: AlignmentType.RIGHT,
												children: [
													run(String(i + 1), {
														font: 'Consolas',
														size: 16,
														color: '666666'
													})
												]
											})
										]
									}),
									new TableCell({
										borders: faintBorders(),
										width: { size: codeW, type: WidthType.DXA },
										margins: { top: 20, bottom: 20, left: 60, right: 60 },
										children: [
											new Paragraph({
												spacing: { after: 0 },
												children: codeLineRuns(line)
											})
										]
									})
								]
							})
					)
				})
			);
			out.push(
				para(
					activity.mode === 'circle_bug' ? 'What is wrong, and how do you fix it?' : 'Notes / what you filled:',
					{ bold: true, before: 120, after: 40 }
				)
			);
			out.push(...writeLines(WRITE_LINES_PER_SENTENCE));
			return out;
		}

		case 'annotate': {
			const out: DocChild[] = [
				para(activity.figureHint || 'Figure on the projector / paste screenshot above.', {
					italics: true,
					after: 60
				}),
				new Table({
					width: { size: PAGE_WIDTH, type: WidthType.DXA },
					columnWidths: [PAGE_WIDTH],
					rows: [
						new TableRow({
							cantSplit: true,
							height: {
								value: convertInchesToTwip(2.2),
								rule: HeightRule.ATLEAST
							},
							children: [
								new TableCell({
									borders: faintBorders(),
									width: { size: PAGE_WIDTH, type: WidthType.DXA },
									margins: { top: 80, bottom: 80, left: 100, right: 100 },
									children: [
										para('(Figure / screenshot space — mark callouts ① ② ③…)', {
											italics: true,
											size: 18,
											after: 40
										})
									]
								})
							]
						})
					]
				}),
				para('Legend', { bold: true, before: 120, after: 60 })
			];
			const lines = activity.linesPerCallout ?? WRITE_LINES_PER_SENTENCE;
			for (let i = 1; i <= activity.callouts; i++) {
				out.push(para(`${i}.`, { bold: true, after: 20 }));
				out.push(...writeLines(lines));
			}
			return out;
		}

		case 'user_story': {
			const stem = (label: string, value?: string): DocChild[] => [
				para(label, { bold: true, after: 40 }),
				value ? para(value, { italics: true, after: 40 }) : para(' ', { after: 0 }),
				...writeLines(WRITE_LINES_PER_SENTENCE)
			];
			return [
				...stem('As a… (role / user)', activity.role),
				...stem('I want… (feature / need)', activity.want),
				...stem('so that… (benefit / outcome)', activity.soThat)
			];
		}

		case 'sitemap': {
			const out: DocChild[] = [];
			const renderNode = (node: WorkbookSitemapNode, depth: number) => {
				const indent = '    '.repeat(depth);
				const marker = depth === 0 ? '●' : '└─';
				const label = node.label?.trim();
				if (label) {
					out.push(para(`${indent}${marker} ${label}`, { bold: depth === 0, after: 40 }));
				} else {
					out.push(writeLine(`${indent}${marker}`));
				}
				let kids: WorkbookSitemapNode[] = [];
				if (typeof node.children === 'number') {
					kids = Array.from({ length: Math.max(0, node.children) }, () => ({ label: '' }));
				} else if (Array.isArray(node.children)) {
					kids = node.children;
				}
				for (const child of kids) {
					renderNode(child, depth + 1);
				}
			};
			renderNode(activity.root, 0);
			return out;
		}

		case 'ai_prompt_log': {
			const rounds = activity.rounds;
			const out: DocChild[] = [];
			for (let r = 1; r <= rounds; r++) {
				out.push(para(`Round ${r}`, { bold: true, before: 100, after: 40 }));
				out.push(para('Prompt I used:', { size: 18, after: 20 }));
				out.push(...writeLines(WRITE_LINES_PER_SENTENCE));
				out.push(para('AI output (summary):', { size: 18, after: 20 }));
				out.push(...writeLines(WRITE_LINES_PER_SENTENCE));
				out.push(para('Critique / what I will change next:', { size: 18, after: 20 }));
				out.push(...writeLines(WRITE_LINES_PER_SENTENCE));
			}
			return out;
		}

		case 'media': {
			const isYt = activity.medium === 'youtube';
			const search =
				activity.searchTerms?.trim() ||
				(isYt
					? [activity.name, activity.creator].filter(Boolean).join(' — ')
					: activity.name);
			const out: DocChild[] = [
				para(isYt ? 'Find a YouTube video' : 'Find a website', { bold: true, after: 60 })
			];
			if (isYt) {
				out.push(para(`Search for: ${search}`, { after: 40 }));
				if (activity.creator) {
					out.push(para(`Creator hint (optional): ${activity.creator}`, { italics: true, after: 40 }));
				}
				out.push(
					para('Do not invent or guess a URL — search YouTube using the terms above.', {
						italics: true,
						size: 18,
						after: 80
					})
				);
			} else {
				out.push(para(`Search for: ${search}`, { after: 40 }));
				const url = activity.url?.trim();
				if (url && !/youtube\.com|youtu\.be/i.test(url) && url !== 'https://') {
					out.push(para(`URL: ${url}`, { after: 80 }));
				} else {
					out.push(
						para('Use a trusted search result for this organisation/page.', {
							italics: true,
							size: 18,
							after: 80
						})
					);
				}
			}
			out.push(para('Notes while watching / browsing:', { bold: true, after: 40 }));
			out.push(
				...writeLines(Math.max(WRITE_LINES_PER_SENTENCE, activity.lines ?? WRITE_LINES_PER_SENTENCE))
			);
			return out;
		}

		case 'prose':
			return [
				para(activity.text),
				...writeLines(Math.max(WRITE_LINES_PER_SENTENCE, activity.lines ?? 4))
			];

		default:
			return [para('Unsupported workbook activity.')];
	}
}

/** Render a workbook activity for the student sheet (never prints modelAnswer). */
export function renderWorkbookActivity(activity: WorkbookActivity): DocChild[] {
	return [...headingBlock(activity), ...renderBody(activity)];
}

export function renderWorkbookActivityLabeled(label: string, activity: WorkbookActivity): DocChild[] {
	return [para(label, { bold: true, before: 80, after: 40 }), ...renderWorkbookActivity(activity)];
}

/** Teacher-only model answer block (if present on the JSON). */
export function renderWorkbookModelAnswer(activity: WorkbookActivity): DocChild[] {
	if (!activity.modelAnswer) return [];
	const answer =
		typeof activity.modelAnswer === 'string'
			? activity.modelAnswer
			: JSON.stringify(activity.modelAnswer, null, 2);
	return [
		para('Model answer (teacher only)', { bold: true, before: 80, after: 40 }),
		para(answer, { after: 80 })
	];
}
