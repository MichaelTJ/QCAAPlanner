import {
	resolveWorkbookKind,
	WRITE_LINES_PER_SENTENCE,
	type WorkbookActivity,
	type WorkbookActivityKind,
	type WorkbookCell,
	type WorkbookCellMode,
	type WorkbookSitemapNode,
	type WorkbookTable
} from './types';

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

function asPositiveInt(value: unknown, fallback: number, max = 30): number {
	const n = Number(value);
	if (!Number.isFinite(n) || n <= 0) return fallback;
	return Math.min(max, Math.round(n));
}

function asStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.map((item) => asString(item)).filter(Boolean);
}

function asMode(value: unknown, fallback: WorkbookCellMode): WorkbookCellMode {
	const m = asString(value).toLowerCase();
	if (m === 'locked' || m === 'given' || m === 'fixed') return 'locked';
	if (m === 'blank' || m === 'write' || m === 'writeon' || m === 'write-on' || m === 'empty') {
		return 'blank';
	}
	if (m === 'tick' || m === 'check' || m === 'checkbox') return 'tick';
	return fallback;
}

function asCell(raw: unknown): WorkbookCell {
	if (raw == null) return { mode: 'blank', value: '' };
	if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') {
		const value = asString(raw);
		return { mode: value ? 'locked' : 'blank', value };
	}
	if (typeof raw === 'object') {
		const o = raw as Record<string, unknown>;
		const value = asString(o.value ?? o.text ?? o.label ?? '');
		const mode = asMode(o.mode ?? o.kind ?? o.role, value ? 'locked' : 'blank');
		return { mode, value };
	}
	return { mode: 'blank', value: '' };
}

function asCellRows(value: unknown, colCount: number): WorkbookCell[][] {
	if (!Array.isArray(value)) return [];
	return value.map((row) => {
		let cells: WorkbookCell[];
		if (Array.isArray(row)) {
			cells = row.map(asCell);
		} else if (row && typeof row === 'object') {
			const o = row as Record<string, unknown>;
			const keys = Object.keys(o).sort();
			cells = keys.map((k) => asCell(o[k]));
		} else {
			cells = [asCell(row)];
		}
		while (cells.length < colCount) cells.push({ mode: 'blank', value: '' });
		return cells.slice(0, Math.max(colCount, cells.length));
	});
}

function baseFields(raw: Record<string, unknown>) {
	const title = asString(raw.title);
	return {
		title: title && title.toLowerCase() !== 'workbook task' ? title : undefined,
		prompt: asString(raw.prompt) || undefined,
		stimulus: asString(raw.stimulus) || undefined,
		modelAnswer: asString(raw.modelAnswer ?? raw.teacherAnswer ?? raw.answerKey) || undefined
	};
}

const COUNT_WORDS: Record<string, number> = {
	two: 2,
	three: 3,
	four: 4,
	five: 5,
	six: 6,
	seven: 7,
	eight: 8
};

function impliedItemCount(text: string): number | null {
	const m = text
		.toLowerCase()
		.match(
			/\b(\d+|two|three|four|five|six|seven|eight)\s+(terms?|words?|definitions?|items?|concepts?)\b/
		);
	if (!m) return null;
	const n = COUNT_WORDS[m[1]] ?? Number(m[1]);
	return Number.isFinite(n) && n > 0 ? Math.min(12, n) : null;
}

function cellText(cell: WorkbookCell | undefined): string {
	return asString(cell?.value);
}

function isLockedFilled(cell: WorkbookCell | undefined): boolean {
	return Boolean(cell && cell.mode === 'locked' && cellText(cell));
}

/** True when the activity is "match the word to the definition". */
export function isMatchDefinitionTask(text: string): boolean {
	return /\bmatch\b/i.test(text) && /(\bdefin|\bterm|\bword\b)/i.test(text);
}

export function isDefineTermsTask(text: string): boolean {
	return /\bdefin/i.test(text) && !/\bmatch\b/i.test(text);
}

/**
 * Ensure match tables print both terms and definitions, and define-n tables have n rows.
 */
export function repairTableMatchDefine(table: WorkbookTable, contextText = ''): WorkbookTable {
	const blob = [table.title, table.prompt, contextText].filter(Boolean).join('\n');
	let headers = table.headers.length ? [...table.headers] : ['Term', 'Response'];
	const rows = table.rows.map((row) => row.map((cell) => ({ ...cell })));
	let bank = [...(table.bank ?? [])].map((item) => asString(item)).filter(Boolean);

	const matchTask =
		isMatchDefinitionTask(blob) ||
		headers.some((h) => /\bmatch\b/i.test(h)) ||
		bank.length > 0;

	if (matchTask && rows.length) {
		const termsLocked = rows.every((row) => isLockedFilled(row[0]));
		const defsLocked = rows.every((row) => isLockedFilled(row[1]));
		if (termsLocked && defsLocked && bank.length === 0) {
			bank = rows.map((row) => cellText(row[1]));
			for (const row of rows) {
				row[1] = { mode: 'blank', value: '' };
			}
		}
		if (headers.length < 2) headers = ['Term', 'Match'];
		if (/defin/i.test(headers[1] ?? '')) headers[1] = 'Match';
		if (!headers[0]) headers[0] = 'Term';
		if (!headers[1]) headers[1] = 'Match';
		for (const row of rows) {
			while (row.length < 2) row.push({ mode: 'blank', value: '' });
			if (row[1]?.mode === 'locked' && !cellText(row[1]) && bank.length) {
				row[1] = { mode: 'blank', value: '' };
			}
		}
	}

	if (isDefineTermsTask(blob) && !matchTask) {
		const n = impliedItemCount(blob);
		if (n && rows.length < n) {
			if (headers.length < 2) headers = ['Term', 'Definition'];
			while (rows.length < n) {
				rows.push([
					{ mode: 'locked', value: '' },
					{ mode: 'blank', value: '' }
				]);
			}
		}
	}

	return {
		...table,
		headers,
		rows,
		...(bank.length ? { bank } : {})
	};
}

function coerceTable(raw: Record<string, unknown>): WorkbookTable {
	let headers = asStringArray(raw.headers);
	if (!headers.length && asString(raw.leftHeader) && asString(raw.rightHeader)) {
		headers = ['Criterion', asString(raw.leftHeader), asString(raw.rightHeader)];
	}
	if (!headers.length) headers = ['Item', 'Response'];

	let rows = asCellRows(raw.rows, headers.length);

	if (!rows.length && Array.isArray(raw.pairs)) {
		rows = (raw.pairs as unknown[])
			.filter((p): p is Record<string, unknown> => p != null && typeof p === 'object')
			.map((p) => [
				{ mode: 'locked' as const, value: asString(p.left ?? p.term ?? p.key ?? p.word) },
				{
					mode: 'blank' as const,
					value: ''
				}
			])
			.filter((r) => r[0].value);
		if (!asStringArray(raw.headers).length) headers = ['Term', 'Match'];
		if (!asStringArray(raw.bank).length) {
			raw.bank = (raw.pairs as unknown[])
				.filter((p): p is Record<string, unknown> => p != null && typeof p === 'object')
				.map((p) => asString(p.right ?? p.definition ?? p.value))
				.filter(Boolean);
		}
	}

	if (!rows.length && Array.isArray(raw.items) && !raw.bank) {
		const responseHeader = asString(raw.responseHeader) || 'Label / class';
		headers = ['Item', responseHeader];
		rows = asStringArray(raw.items).map((item) => [
			{ mode: 'locked', value: item },
			{ mode: 'blank', value: '' }
		]);
	}

	if (!rows.length && Array.isArray(raw.criteria)) {
		const leftH = asString(raw.leftHeader) || 'Option A';
		const rightH = asString(raw.rightHeader) || 'Option B';
		headers = ['Criterion', leftH, rightH];
		rows = asStringArray(raw.criteria).map((c) => [
			{ mode: c ? 'locked' : 'blank', value: c },
			{ mode: 'blank', value: '' },
			{ mode: 'blank', value: '' }
		]);
	}

	if (!rows.length && headers.length) {
		const columns: string[][] = [];
		for (let i = 0; i < headers.length; i++) {
			const col = raw[`column${i}`] ?? raw[`col${i}`];
			columns.push(Array.isArray(col) ? col.map((c) => asString(c)) : []);
		}
		const rowCount = Math.max(1, ...columns.map((c) => c.length), asPositiveInt(raw.blankRows, 0));
		if (columns.some((c) => c.length)) {
			rows = Array.from({ length: rowCount }, (_, r) =>
				headers.map((_, c) => {
					const v = columns[c]?.[r] ?? '';
					return { mode: (v ? 'locked' : 'blank') as WorkbookCellMode, value: v };
				})
			);
		}
	}

	const blankRows = asPositiveInt(raw.blankRows, 0);
	for (let i = 0; i < blankRows; i++) {
		rows.push(headers.map(() => ({ mode: 'blank' as const, value: '' })));
	}

	if (!rows.length) {
		rows = [headers.map(() => ({ mode: 'blank' as const, value: '' }))];
	}

	const bank = asStringArray(raw.bank ?? raw.definitions ?? raw.wordBank);
	const table: WorkbookTable = {
		type: 'table',
		...baseFields(raw),
		headers,
		rows,
		...(bank.length ? { bank } : {})
	};
	return repairTableMatchDefine(table, [table.title, table.prompt].filter(Boolean).join('\n'));
}

function coerceWritten(raw: Record<string, unknown>): WorkbookActivity {
	const lines = Math.max(
		WRITE_LINES_PER_SENTENCE,
		asPositiveInt(raw.lines ?? raw.count ?? raw.linesPerSection, WRITE_LINES_PER_SENTENCE)
	);
	let sections: Array<{ label: string; lines: number }> | undefined;
	if (Array.isArray(raw.sections)) {
		sections = raw.sections
			.filter((s): s is Record<string, unknown> => s != null && typeof s === 'object')
			.map((s) => ({
				label: asString(s.label ?? s.title ?? s.prompt),
				lines: Math.max(
					1,
					asPositiveInt(s.lines ?? s.count, WRITE_LINES_PER_SENTENCE)
				)
			}))
			.filter((s) => s.label);
	}
	const numbered =
		raw.numbered === true ||
		raw.type === 'list' ||
		(Array.isArray(raw.items) && asStringArray(raw.items).length > 0);

	return {
		type: 'written',
		...baseFields(raw),
		lines: numbered
			? asPositiveInt(raw.lines ?? raw.count, 3)
			: lines,
		starter: asString(raw.starter) || undefined,
		numbered: numbered || undefined,
		sections
	};
}

function coerceRanking(raw: Record<string, unknown>): WorkbookActivity {
	const bank = asStringArray(raw.bank ?? raw.items);
	const slots = asPositiveInt(raw.slots ?? raw.count, bank.length || 4);
	return {
		type: 'ranking',
		...baseFields(raw),
		bank,
		slots,
		directionLabel: asString(raw.directionLabel) || 'Most important → least'
	};
}

function coerceCloze(raw: Record<string, unknown>): WorkbookActivity {
	let text = asString(raw.text);
	if (text && !/\{\{\d+\}\}/.test(text) && /_{3,}/.test(text)) {
		let n = 0;
		text = text.replace(/_{3,}/g, () => {
			n += 1;
			return `{{${n}}}`;
		});
	}
	return {
		type: 'cloze',
		...baseFields(raw),
		text: text || 'Complete: {{1}} and {{2}}.',
		wordBank: asStringArray(raw.wordBank).length ? asStringArray(raw.wordBank) : undefined
	};
}

function coerceActivity(kind: WorkbookActivityKind, raw: Record<string, unknown>): WorkbookActivity {
	const base = baseFields(raw);
	switch (kind) {
		case 'table':
			return coerceTable(raw);
		case 'written':
			return coerceWritten(raw);
		case 'ranking':
			return coerceRanking(raw);
		case 'sort': {
			const bank = asStringArray(raw.bank ?? raw.items);
			const buckets = asStringArray(raw.buckets);
			return {
				type: 'sort',
				...base,
				bank: bank.length ? bank : ['Item A', 'Item B', 'Item C', 'Item D'],
				buckets: buckets.length ? buckets : ['Bucket 1', 'Bucket 2', 'Bucket 3'],
				linesPerBucket: asPositiveInt(raw.linesPerBucket, 4)
			};
		}
		case 'checklist':
			return {
				type: 'checklist',
				...base,
				items: asStringArray(raw.items).length
					? asStringArray(raw.items)
					: ['Criterion 1', 'Criterion 2', 'Criterion 3']
			};
		case 'cloze':
			return coerceCloze(raw);
		case 'continuum':
			return {
				type: 'continuum',
				...base,
				left: asString(raw.left) || 'Low',
				right: asString(raw.right) || 'High',
				scale: asPositiveInt(raw.scale ?? raw.points, 5, 10),
				lines: asPositiveInt(raw.lines ?? raw.justifyLines, WRITE_LINES_PER_SENTENCE)
			};
		case 'overlap':
			return {
				type: 'overlap',
				...base,
				leftLabel: asString(raw.leftLabel) || 'A only',
				rightLabel: asString(raw.rightLabel) || 'B only',
				lines: asPositiveInt(raw.lines ?? raw.linesPerSection, WRITE_LINES_PER_SENTENCE)
			};
		case 'graphic':
			return {
				type: 'graphic',
				...base,
				mustInclude: asStringArray(raw.mustInclude ?? raw.labels).length
					? asStringArray(raw.mustInclude ?? raw.labels)
					: ['Label the key parts'],
				heightInches: Number(raw.heightInches) > 0 ? Number(raw.heightInches) : 3.2
			};
		case 'wireframe': {
			const regions = Array.isArray(raw.regions)
				? (raw.regions as unknown[])
						.filter((r): r is Record<string, unknown> => r != null && typeof r === 'object')
						.map((r) => ({ label: asString(r.label ?? r.name) }))
						.filter((r) => r.label)
				: [
						{ label: 'Header / nav' },
						{ label: 'Main content' },
						{ label: 'Sidebar / aside' },
						{ label: 'Footer' }
					];
			return {
				type: 'wireframe',
				...base,
				mustInclude: asStringArray(raw.mustInclude ?? raw.labels).length
					? asStringArray(raw.mustInclude ?? raw.labels)
					: ['Navigation', 'Primary action', 'Content area'],
				regions,
				heightInches: Number(raw.heightInches) > 0 ? Number(raw.heightInches) : 4
			};
		}
		case 'storyboard': {
			let frames: Array<{ label?: string }> = [];
			if (Array.isArray(raw.frames)) {
				frames = raw.frames.map((f) => {
					if (typeof f === 'string') return { label: asString(f) };
					if (f && typeof f === 'object') {
						return { label: asString((f as Record<string, unknown>).label) || undefined };
					}
					return {};
				});
			}
			const count = asPositiveInt(raw.frameCount ?? raw.count, 0, 8);
			if (!frames.length && count) {
				frames = Array.from({ length: count }, (_, i) => ({ label: `Frame ${i + 1}` }));
			}
			if (!frames.length) {
				frames = [
					{ label: 'Before' },
					{ label: 'During' },
					{ label: 'After' },
					{ label: 'Outcome' }
				];
			}
			return {
				type: 'storyboard',
				...base,
				frames: frames.slice(0, 8),
				linesPerFrame: asPositiveInt(raw.linesPerFrame, 2)
			};
		}
		case 'flow': {
			let stages: Array<{ label?: string; blank?: boolean }> = [];
			if (Array.isArray(raw.stages)) {
				stages = raw.stages.map((s) => {
					if (typeof s === 'string') return { label: asString(s) };
					if (s && typeof s === 'object') {
						const o = s as Record<string, unknown>;
						return {
							label: asString(o.label ?? o.text) || undefined,
							blank: o.blank === true || !asString(o.label ?? o.text)
						};
					}
					return { blank: true };
				});
			}
			if (!stages.length) {
				stages = [{ label: 'Start' }, { label: 'Action' }, { label: 'End' }];
			}
			const branchAfter =
				raw.branchAfter != null && Number.isFinite(Number(raw.branchAfter))
					? Math.max(0, Math.round(Number(raw.branchAfter)))
					: undefined;

			const pathFrom = (value: unknown, fallbackBlank: boolean) => {
				if (value && typeof value === 'object') {
					const o = value as Record<string, unknown>;
					const label = asString(o.label ?? o.text) || undefined;
					return { label, blank: o.blank === true || !label };
				}
				if (typeof value === 'string' && asString(value)) {
					return { label: asString(value) };
				}
				return fallbackBlank ? { blank: true as const } : undefined;
			};

			const hasBranch = branchAfter != null;
			return {
				type: 'flow',
				...base,
				stages: hasBranch ? stages.slice(0, (branchAfter as number) + 1) : stages,
				branchAfter,
				yesLabel: asString(raw.yesLabel) || 'Yes',
				noLabel: asString(raw.noLabel) || 'No',
				yesPath: hasBranch
					? pathFrom(raw.yesPath, true) ?? { blank: true }
					: undefined,
				noPath: hasBranch ? pathFrom(raw.noPath, true) ?? { blank: true } : undefined,
				rejoin: pathFrom(raw.rejoin, false)
			};
		}
		case 'code': {
			const lines = Array.isArray(raw.lines)
				? raw.lines.map((l) => asString(l, ' '))
				: asString(raw.code)
					? asString(raw.code).split(/\r?\n/)
					: [
							'<button id="book">Book Now</button>',
							'<script>',
							'  document.getElementById("book").onclick = () => {',
							'    alrt("Booked");',
							'  }',
							'</script>'
						];
			const modeRaw = asString(raw.mode).toLowerCase();
			return {
				type: 'code',
				...base,
				lines,
				mode: modeRaw === 'fill_holes' ? 'fill_holes' : modeRaw === 'circle_bug' ? 'circle_bug' : 'fill_holes',
				language: asString(raw.language) || undefined
			};
		}
		case 'annotate':
			return {
				type: 'annotate',
				...base,
				callouts: asPositiveInt(raw.callouts ?? raw.count, 4, 10),
				figureHint:
					asString(raw.figureHint) ||
					'Figure: live site on the projector / paste screenshot above.',
				linesPerCallout: asPositiveInt(raw.linesPerCallout, WRITE_LINES_PER_SENTENCE)
			};
		case 'user_story':
			return {
				type: 'user_story',
				...base,
				role: asString(raw.role) || undefined,
				want: asString(raw.want) || undefined,
				soThat: asString(raw.soThat) || undefined
			};
		case 'sitemap': {
			const parseNode = (value: unknown): WorkbookSitemapNode => {
				if (typeof value === 'number') {
					return { children: asPositiveInt(value, 2, 8) };
				}
				if (typeof value === 'string') {
					return { label: asString(value) };
				}
				if (value && typeof value === 'object') {
					const o = value as Record<string, unknown>;
					const label = asString(o.label ?? o.name) || undefined;
					if (typeof o.children === 'number') {
						return { label, children: asPositiveInt(o.children, 2, 8) };
					}
					if (Array.isArray(o.children)) {
						return { label, children: o.children.map(parseNode) };
					}
					if (typeof o.slots === 'number') {
						return { label, children: asPositiveInt(o.slots, 2, 8) };
					}
					return { label };
				}
				return { label: '' };
			};

			if (raw.root && typeof raw.root === 'object') {
				return { type: 'sitemap', ...base, root: parseNode(raw.root) };
			}

			// Legacy levels × nodesPerLevel → nested under Home (not flat siblings)
			const rootLabel = asString(raw.rootLabel) || 'Home';
			const levels = asPositiveInt(raw.levels, 2, 4);
			const per = asPositiveInt(raw.nodesPerLevel, 2, 4);
			const buildDepth = (depth: number): WorkbookSitemapNode[] => {
				if (depth <= 0) return [];
				return Array.from({ length: per }, () => ({
					label: '',
					children: depth > 1 ? buildDepth(depth - 1) : undefined
				}));
			};
			return {
				type: 'sitemap',
				...base,
				root: { label: rootLabel, children: buildDepth(levels) }
			};
		}
		case 'ai_prompt_log':
			return {
				type: 'ai_prompt_log',
				...base,
				rounds: asPositiveInt(raw.rounds ?? raw.count, 2, 5)
			};
		case 'media': {
			const mediumRaw = asString(raw.medium ?? raw.source).toLowerCase();
			const medium: 'youtube' | 'website' =
				mediumRaw === 'website' || mediumRaw === 'web' || mediumRaw === 'site'
					? 'website'
					: 'youtube';
			const name =
				asString(raw.name ?? raw.videoTitle ?? raw.pageTitle ?? raw.resourceTitle) ||
				(medium === 'youtube' ? 'topic video' : 'local website');
			const creator = asString(raw.creator ?? raw.channel ?? raw.author) || undefined;
			const searchTerms =
				asString(raw.searchTerms ?? raw.search) ||
				(medium === 'youtube' ? [name, creator].filter(Boolean).join(' — ') : name);
			let url = asString(raw.url ?? raw.link) || undefined;
			// Never keep invented YouTube links — search terms only
			if (medium === 'youtube' || (url && /youtube\.com|youtu\.be/i.test(url))) {
				url = undefined;
			}
			if (url === 'https://' || url === 'http://') url = undefined;
			return {
				type: 'media',
				...base,
				medium,
				name,
				creator,
				url,
				searchTerms,
				lines: asPositiveInt(raw.lines, WRITE_LINES_PER_SENTENCE)
			};
		}
		case 'prose':
		default:
			return {
				type: 'prose',
				...base,
				text: asString(raw.text) || asString(raw.prompt) || 'Complete the task in the space below.',
				lines: asPositiveInt(raw.lines, 4)
			};
	}
}

/**
 * Parse unknown JSON into a WorkbookActivity. Accepts legacy kinds and cell shapes.
 */
export function parseWorkbookActivity(raw: unknown): WorkbookActivity | undefined {
	if (raw == null) return undefined;
	if (typeof raw === 'string') {
		const trimmed = raw.trim();
		if (!trimmed) return undefined;
		try {
			return parseWorkbookActivity(JSON.parse(trimmed));
		} catch {
			return { type: 'prose', text: trimmed, lines: WRITE_LINES_PER_SENTENCE };
		}
	}
	if (typeof raw !== 'object') return undefined;
	const obj = raw as Record<string, unknown>;
	const kind = resolveWorkbookKind(obj.type ?? obj.kind ?? obj.workbookKind);
	if (!kind) return undefined;
	return coerceActivity(kind, obj);
}

export function placeholderForKind(kind: WorkbookActivityKind): WorkbookActivity {
	return coerceActivity(kind, { type: kind });
}

/** Convert markdown pipe tables (common AI fallback) into a workbook table. */
export function parseMarkdownTableToWorkbook(text: string): WorkbookActivity | undefined {
	const lines = text
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter((l) => l.includes('|'));
	if (lines.length < 2) return undefined;

	const splitRow = (line: string) =>
		line
			.replace(/^\|/, '')
			.replace(/\|$/, '')
			.split('|')
			.map((c) => c.trim());

	const isSep = (line: string) => /^\|?[\s:-]+\|[\s|:-]*\|?$/.test(line) || /^[\s|:-]+$/.test(line);

	let headerLine = lines[0];
	let start = 1;
	if (isSep(lines[1])) start = 2;
	else if (lines[0].toLowerCase().startsWith('table') || lines[0].toLowerCase().startsWith('matrix')) {
		// "Table: | headers |" on same or next — try next line as header
		const maybe = lines.find((l, i) => i > 0 && !isSep(l) && splitRow(l).length >= 2);
		if (maybe) {
			headerLine = maybe;
			start = lines.indexOf(maybe) + 1;
			if (lines[start] && isSep(lines[start])) start += 1;
		}
	}

	// Strip leading labels like "Table:" before first pipe on header line
	const pipeIdx = headerLine.indexOf('|');
	if (pipeIdx > 0 && !headerLine.trim().startsWith('|')) {
		headerLine = headerLine.slice(pipeIdx);
	}

	const headers = splitRow(headerLine).filter((h) => h && !/^-+$/.test(h));
	if (headers.length < 2) return undefined;

	const rows: WorkbookCell[][] = [];
	for (let i = start; i < lines.length; i++) {
		if (isSep(lines[i])) continue;
		let line = lines[i];
		const p = line.indexOf('|');
		if (p > 0 && !line.trim().startsWith('|')) line = line.slice(p);
		const cells = splitRow(line);
		if (cells.every((c) => !c || /^-+$/.test(c))) continue;
		while (cells.length < headers.length) cells.push('');
		rows.push(
			cells.slice(0, headers.length).map((value) => ({
				mode: value ? ('locked' as const) : ('blank' as const),
				value
			}))
		);
	}

	if (!rows.length) {
		rows.push(headers.map(() => ({ mode: 'blank' as const, value: '' })));
	}

	return {
		type: 'table',
		title: undefined,
		prompt: undefined,
		headers,
		rows
	};
}

/** Infer a catalog kind from free text (scaffolding / materials / title). */
export function inferWorkbookKindFromText(...parts: Array<string | undefined>): WorkbookActivityKind | undefined {
	const blob = parts.filter(Boolean).join('\n').toLowerCase();
	if (!blob.trim()) return undefined;
	if (/\buser[- ]?stor/.test(blob)) return 'user_story';
	if (/\bsite[- ]?map|\bhierarch/.test(blob)) return 'sitemap';
	if (/\bwireframe/.test(blob)) return 'wireframe';
	if (/\bstoryboard/.test(blob)) return 'storyboard';
	if (/\bvenn|\boverlap\b|only[- ]a\b/.test(blob)) return 'overlap';
	if (/\bchecklist\b|\btick (each|the|if)\b/.test(blob)) return 'checklist';
	if (/\brank(ing|ed)?\b|\bprioritis/.test(blob)) return 'ranking';
	if (/\bsort(ing)?\b|\bbucket/.test(blob)) return 'sort';
	if (/\bcloze\b|\bfill[- ]?in[- ]?the[- ]?blank|\bguided notes?\b/.test(blob)) return 'cloze';
	if (/\bcontinuum\b|\bscale\b|\brate (the|this)\b/.test(blob)) return 'continuum';
	if (/\bannotate\b|\bcallout/.test(blob)) return 'annotate';
	if (/\byoutube\b|\bwatch (this|the) video\b/.test(blob)) return 'media';
	if (/\bflow(chart)?\b|\bjourney\b|\balgorithm\b/.test(blob)) return 'flow';
	if (/\bgraphic\b|\bmind[- ]?map\b|\bsketch\b/.test(blob)) return 'graphic';
	if (/\b3\s*[-–]\s*2\s*[-–]\s*1\b|\bexit ticket\b/.test(blob)) return 'written';
	if (/\bmatrix\b|\btable\b|\|/.test(blob)) return 'table';
	if (/\bt[- ]?chart\b|\bcompare\b/.test(blob)) return 'table';
	return undefined;
}

function checklistFromScaffolding(scaffolding: string): WorkbookActivity | undefined {
	const items = scaffolding
		.split(/\r?\n|;/)
		.map((l) => l.replace(/^[-*•\d.)\s]+/, '').trim())
		.filter((l) => l.length > 3 && !/provide a|checklist for|sentence/i.test(l));
	if (items.length < 2) return undefined;
	return { type: 'checklist', items: items.slice(0, 10) };
}

/**
 * Resolve printable workbook widget from lesson activity fields.
 * Prefer workbookSpec; coerce markdown tables; infer kind from scaffolding text.
 */
export function workbookActivityFromLessonFields(fields: {
	workbookSpec?: unknown;
	workbookMaterials?: unknown;
	workbookKind?: string;
	scaffolding?: string;
	title?: string;
	visibleInstructions?: string;
	studentsDo?: string;
}): WorkbookActivity | undefined {
	const fromSpec = parseWorkbookActivity(fields.workbookSpec);
	if (fromSpec && fromSpec.type !== 'prose') return fromSpec;
	if (fromSpec?.type === 'prose' && fromSpec.text.includes('|')) {
		const table = parseMarkdownTableToWorkbook(fromSpec.text);
		if (table) return table;
	}

	const materials = asString(fields.workbookMaterials);
	if (materials) {
		const asJson = parseWorkbookActivity(materials);
		if (asJson && asJson.type !== 'prose') return asJson;
		const table = parseMarkdownTableToWorkbook(materials);
		if (table) {
			const kind = resolveWorkbookKind(fields.workbookKind);
			if (kind === 'table' || !kind) return table;
		}
		// Strip "Table:" prefix noise then retry
		const stripped = materials.replace(/^(table|matrix|organiser)\s*:?\s*/i, '');
		if (stripped !== materials) {
			const t2 = parseMarkdownTableToWorkbook(stripped);
			if (t2) return t2;
		}
	}

	const kind =
		resolveWorkbookKind(fields.workbookKind) ??
		inferWorkbookKindFromText(
			fields.scaffolding,
			fields.title,
			fields.visibleInstructions,
			fields.studentsDo,
			materials
		);

	if (kind === 'checklist') {
		const fromScaf = checklistFromScaffolding(asString(fields.scaffolding));
		if (fromScaf) return fromScaf;
	}

	if (kind === 'overlap') {
		return {
			type: 'overlap',
			leftLabel: 'Physical store',
			rightLabel: 'Website',
			lines: WRITE_LINES_PER_SENTENCE
		};
	}

	if (kind === 'written' && /\b3\s*[-–]\s*2\s*[-–]\s*1\b/i.test(asString(fields.visibleInstructions) + asString(fields.studentsDo) + materials)) {
		return {
			type: 'written',
			sections: [
				{ label: '3 things I learned', lines: 3 },
				{ label: '2 questions I still have', lines: 2 },
				{ label: '1 next step', lines: 1 }
			]
		};
	}

	if (kind) return placeholderForKind(kind);

	if (materials && materials.length > 20) {
		return { type: 'prose', text: materials, lines: WRITE_LINES_PER_SENTENCE };
	}
	return undefined;
}

/** Parse 3-2-1 exit ticket text into a written sections widget. */
export function exitTicketFromSmartFinish(smartFinish: string): WorkbookActivity | undefined {
	const t = asString(smartFinish);
	if (!/\b3\s*[-–]\s*2\s*[-–]\s*1\b/i.test(t) && !/exit ticket/i.test(t)) return undefined;

	const afterLabel = t.replace(/^.*?exit ticket:\s*/i, '').replace(/^.*?3\s*[-–]\s*2\s*[-–]\s*1[:\s]*/i, '');
	const parts = afterLabel.split(/\s*,\s*/).map((p) => p.trim()).filter(Boolean);

	const label3 = parts.find((p) => /^3\b/i.test(p)) ?? '3 things I can explain';
	const label2 = parts.find((p) => /^2\b/i.test(p)) ?? '2 examples';
	const label1 = parts.find((p) => /^1\b/i.test(p)) ?? '1 next step';

	return {
		type: 'written',
		title: 'Exit ticket',
		sections: [
			{ label: label3, lines: 3 },
			{ label: label2, lines: 2 },
			{ label: label1, lines: 1 }
		]
	};
}
