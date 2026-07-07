export interface WeekRange {
	start: number | '';
	finish: number | '';
}

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

export function applyDurationToUnitWeeks(duration: string, startWeek: string, finishWeek: string): {
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
	const startNum = Number(startWeek);
	if (weekCount !== null && !Number.isNaN(startNum) && startNum > 0) {
		return {
			startWeek: String(startNum),
			finishWeek: String(startNum + weekCount - 1)
		};
	}

	return { startWeek, finishWeek };
}

export function applyUnitWeeksToDuration(startWeek: string, finishWeek: string, currentDuration: string): string {
	const start = String(startWeek).trim();
	const finish = String(finishWeek).trim();
	if (start && finish) {
		return durationFromWeekRange(start, finish);
	}
	if (start && !finish) {
		return `Week ${start}`;
	}
	return currentDuration;
}
