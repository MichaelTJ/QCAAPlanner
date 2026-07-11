import type { TeachingWeek, UnitPlan } from '$lib/types';

export interface LearningGuideWeek {
	week: number | '';
	title: string;
	bullets: string[];
}

export interface LearningGuideData {
	yearLevel: number | '';
	subject: string;
	term: number | '';
	weeks: LearningGuideWeek[];
	vocabulary?: string;
}

function parseTermFromWeekLabel(label: string): number | '' {
	const match = label.match(/term\s*(\d+)/i);
	if (!match) return '';
	return Number(match[1]);
}

/** Periods in these abbreviations must not count as sentence boundaries (e.g. Scope bullets). */
const ABBREVIATION_PERIOD = /\b(e\.g|i\.e|vs|Mr|Mrs|Ms|Dr|Prof)\./gi;

function withProtectedAbbreviations(text: string, map: (safeText: string) => string): string;
function withProtectedAbbreviations(text: string, map: (safeText: string) => string[]): string[];
function withProtectedAbbreviations(
	text: string,
	map: (safeText: string) => string | string[]
): string | string[] {
	const saved: string[] = [];
	const safeText = text.replace(ABBREVIATION_PERIOD, (match) => {
		const token = `\u0000ABBR${saved.length}\u0000`;
		saved.push(match);
		return token;
	});
	const restore = (value: string) =>
		value.replace(/\u0000ABBR(\d+)\u0000/g, (_, index) => saved[Number(index)] ?? '');
	const result = map(safeText);
	return Array.isArray(result) ? result.map(restore) : restore(result);
}

function firstSentence(text: string): string {
	const trimmed = text.trim();
	if (!trimmed) return '';
	return withProtectedAbbreviations(trimmed, (safeText) => {
		const match = safeText.match(/^(.+?[.!?])(?:\s|$)/);
		return (match?.[1] ?? safeText.split(/\n/)[0] ?? safeText).trim();
	});
}

function splitIntoBullets(text: string, max = 4): string[] {
	const trimmed = text.trim();
	if (!trimmed) return [];

	const lines = trimmed
		.split(/\r?\n/)
		.map((line) => line.replace(/^[\s•■\-–—*]+\s*/, '').trim())
		.filter(Boolean);
	if (lines.length > 1) return lines.slice(0, max);

	return withProtectedAbbreviations(trimmed, (safeText) =>
		safeText
			.split(/(?<=[.!?])\s+/)
			.map((sentence) => sentence.trim())
			.filter(Boolean)
			.slice(0, max)
	);
}

function stripSectionPrefix(text: string, prefix: string): string {
	return text.replace(new RegExp(`^${prefix}\\s*:?\\s*`, 'i'), '').trim();
}

export function weekContentFromTeachingWeek(week: TeachingWeek): {
	title: string;
	bullets: string[];
} {
	const theme = week.outlineTheme?.value?.trim() ?? '';
	const theory = week.theory.value.trim();
	const prac = week.prac.value.trim();
	const keyExperiences = week.keyTeachingExperiences.value.trim();

	if (theme) {
		const bullets = [
			...splitIntoBullets(stripSectionPrefix(theory, 'Theory'), 3),
			...splitIntoBullets(stripSectionPrefix(prac, 'Prac'), 2)
		].slice(0, 4);
		return { title: theme, bullets };
	}

	if (keyExperiences) {
		const theoryMatch = keyExperiences.match(/theory:\s*([\s\S]*?)(?:\n\s*prac:|$)/i);
		const pracMatch = keyExperiences.match(/prac:\s*([\s\S]*)$/i);
		if (theoryMatch) {
			const theoryText = theoryMatch[1].trim();
			const title = firstSentence(theoryText) || `Week ${week.week.value}`;
			const bullets = [
				...splitIntoBullets(theoryText.slice(title.length).trim(), 3),
				...splitIntoBullets(pracMatch?.[1]?.trim() ?? '', 2)
			]
				.filter(Boolean)
				.slice(0, 4);
			return { title, bullets };
		}
	}

	if (theory || prac) {
		const theoryBody = stripSectionPrefix(theory, 'Theory');
		const title = firstSentence(theoryBody) || `Week ${week.week.value}`;
		const bullets = [
			...splitIntoBullets(theoryBody.slice(title.length).trim(), 3),
			...splitIntoBullets(stripSectionPrefix(prac, 'Prac'), 2)
		]
			.filter(Boolean)
			.slice(0, 4);
		return { title, bullets };
	}

	return {
		title: week.week.value === '' ? '' : `Week ${week.week.value}`,
		bullets: []
	};
}

export function learningGuideSubject(unit: UnitPlan): string {
	const title = unit.unitTitle.value.trim();
	const suffix = title.match(/[—–-]\s*(.+)$/)?.[1]?.trim();
	if (suffix) return suffix.toUpperCase();
	return unit.subject.value.toUpperCase();
}

export function learningGuideFromUnitPlan(unit: UnitPlan): LearningGuideData {
	const term =
		parseTermFromWeekLabel(unit.startWeek.value) ||
		parseTermFromWeekLabel(unit.finishWeek.value) ||
		'';

	const weeks = [...unit.teachingSequence]
		.sort((a, b) => Number(a.week.value) - Number(b.week.value))
		.map((week) => {
			const content = weekContentFromTeachingWeek(week);
			return {
				week: week.week.value,
				title: content.title,
				bullets: content.bullets
			};
		});

	return {
		yearLevel: unit.yearLevel.value,
		subject: learningGuideSubject(unit),
		term,
		weeks
	};
}

export function learningGuideTitle(data: LearningGuideData): string {
	const year = data.yearLevel === '' ? '—' : String(data.yearLevel);
	const term = data.term === '' ? '—' : String(data.term);
	return `YR ${year} ${data.subject}, TERM ${term}`;
}
