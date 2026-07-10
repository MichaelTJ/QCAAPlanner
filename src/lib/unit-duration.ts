export interface WeekRange {
	start: number | '';
	finish: number | '';
}

export interface TermWeek {
	term: number;
	week: number;
}

const WEEKS_PER_TERM = 10;

/** Parse level-plan duration text into a week range where possible. */
export function weekRangeFromDuration(duration: string): WeekRange {
	const text = duration.trim();
	if (!text) return { start: '', finish: '' };

	const rangePatterns = [
		/week\s*(\d+)\s*(?:to|–|-)\s*week\s*(\d+)/i,
		/week\s*(\d+)\s*(?:to|–|-)\s*(\d+)/i,
		/^(\d+)\s*(?:to|–|-)\s*(\d+)(?:\s*weeks?)?$/i,
		/^(\d+)\s*-\s*(\d+)$/
	];
	for (const pattern of rangePatterns) {
		const match = text.match(pattern);
		if (match) {
			return { start: Number(match[1]), finish: Number(match[2]) };
		}
	}

	const singleWeek = text.match(/^week\s*(\d+)$/i);
	if (singleWeek) {
		const week = Number(singleWeek[1]);
		return { start: week, finish: week };
	}

	return { start: '', finish: '' };
}

export function weekCountFromDuration(duration: string): number | null {
	const match = duration.trim().match(/^(\d+)\s*weeks?$/i);
	return match ? Number(match[1]) : null;
}

export function parseTermWeekLabel(text: string): TermWeek | null {
	const match = String(text).trim().match(/term\s*(\d+).*?week\s*(\d+)/i);
	if (!match) return null;
	const term = Number(match[1]);
	const week = Number(match[2]);
	if (Number.isNaN(term) || Number.isNaN(week) || term < 1 || week < 1) return null;
	return { term, week };
}

function absoluteWeekNumber(termWeek: TermWeek): number {
	return (termWeek.term - 1) * WEEKS_PER_TERM + termWeek.week;
}

export function formatTermWeekLabel(term: number, week: number): string {
	return `Term ${term} Week ${week}`;
}

/** Shift a term/week or plain week label by `delta` weeks (negative = earlier). */
export function offsetWeekLabel(label: string, delta: number): string {
	const text = String(label).trim();
	if (!text || delta === 0) return text;

	const termWeek = parseTermWeekLabel(text);
	if (termWeek) {
		const absolute = Math.max(1, absoluteWeekNumber(termWeek) + delta);
		return formatTermWeekLabel(
			Math.floor((absolute - 1) / WEEKS_PER_TERM) + 1,
			((absolute - 1) % WEEKS_PER_TERM) + 1
		);
	}

	const plain = text.match(/^(?:week\s*)?(\d+)$/i);
	if (plain) {
		return `Week ${Math.max(1, Number(plain[1]) + delta)}`;
	}

	return text;
}

export function durationFromTermWeekLabels(start: string, finish: string): string {
	const startTw = parseTermWeekLabel(start);
	const finishTw = parseTermWeekLabel(finish);
	if (!startTw || !finishTw) return '';
	const span = absoluteWeekNumber(finishTw) - absoluteWeekNumber(startTw) + 1;
	if (span <= 0) return '';
	return durationFromWeekCount(span);
}

export function durationFromWeekRange(start: string | number, finish: string | number): string {
	const startNum = Number(start);
	const finishNum = Number(finish);
	if (!start || !finish || Number.isNaN(startNum) || Number.isNaN(finishNum)) return '';
	if (startNum === finishNum) return `Week ${startNum}`;
	return `Week ${startNum} to ${finishNum}`;
}

export function durationFromWeekCount(count: number): string {
	if (count <= 0) return '';
	return count === 1 ? '1 week' : `${count} weeks`;
}

function finishTermWeekFromStart(startTw: TermWeek, weekCount: number): TermWeek {
	const finishAbsolute = absoluteWeekNumber(startTw) + weekCount - 1;
	return {
		term: Math.floor((finishAbsolute - 1) / WEEKS_PER_TERM) + 1,
		week: ((finishAbsolute - 1) % WEEKS_PER_TERM) + 1
	};
}

export function applyDurationToTermWeekStart(
	duration: string,
	startWeek: string
): { startWeek: string; finishWeek: string } {
	const startTw = parseTermWeekLabel(startWeek);
	const weekCount = weekCountFromDuration(duration);
	if (!startTw || weekCount === null) {
		return { startWeek, finishWeek: '' };
	}
	const finishTw = finishTermWeekFromStart(startTw, weekCount);
	return {
		startWeek: formatTermWeekLabel(startTw.term, startTw.week),
		finishWeek: formatTermWeekLabel(finishTw.term, finishTw.week)
	};
}

export function applyDurationToUnitWeeks(
	duration: string,
	startWeek: string,
	finishWeek: string
): {
	startWeek: string;
	finishWeek: string;
} {
	const range = weekRangeFromDuration(duration);
	if (range.start !== '' && range.finish !== '') {
		return {
			startWeek: String(range.start),
			finishWeek: String(range.finish)
		};
	}

	const weekCount = weekCountFromDuration(duration);
	if (weekCount !== null) {
		const startNum = Number(startWeek);
		if (!Number.isNaN(startNum) && startNum > 0) {
			return {
				startWeek: String(startNum),
				finishWeek: String(startNum + weekCount - 1)
			};
		}

		const termWeeks = applyDurationToTermWeekStart(duration, startWeek);
		if (termWeeks.finishWeek) {
			return termWeeks;
		}
	}

	return { startWeek, finishWeek };
}

export function applyUnitWeeksToDuration(
	startWeek: string,
	finishWeek: string,
	currentDuration: string
): string {
	const start = String(startWeek).trim();
	const finish = String(finishWeek).trim();
	if (start && finish) {
		const numeric = durationFromWeekRange(start, finish);
		if (numeric) return numeric;
		const termBased = durationFromTermWeekLabels(start, finish);
		if (termBased) return termBased;
		return currentDuration;
	}
	if (start && !finish) {
		if (parseTermWeekLabel(start)) return currentDuration;
		return `Week ${start}`;
	}
	return currentDuration;
}

/** Best display value for overview and read-only surfaces. */
export function resolveUnitDuration(
	levelDuration: string,
	options?: { unitPlanDuration?: string; startWeek?: string; finishWeek?: string }
): string {
	const level = String(levelDuration || '').trim();
	if (level) return level;

	const unitPlanDuration = String(options?.unitPlanDuration || '').trim();
	if (unitPlanDuration) return unitPlanDuration;

	const start = String(options?.startWeek || '').trim();
	const finish = String(options?.finishWeek || '').trim();
	if (start || finish) {
		return applyUnitWeeksToDuration(start, finish, '');
	}

	return '';
}

/** Duration written back to the level plan when a unit plan is saved. */
export function resolveDurationForLevelPlanSync(
	unitPlanDuration: string,
	startWeek: string,
	finishWeek: string,
	currentLevelDuration: string
): string {
	const explicit = String(unitPlanDuration || '').trim();
	if (explicit) return explicit;
	return applyUnitWeeksToDuration(startWeek, finishWeek, currentLevelDuration);
}
