import type { LearningGuideData } from '$lib/learning-guide-data';
import { learningGuideFromUnitPlan } from '$lib/learning-guide-data';
import { buildLearningGuideVocabularyContext } from '$lib/learning-guide-vocabulary';
import type {
	SavedLearningGuides,
	SavedLearningGuideVariant,
	UnitPlan
} from '$lib/types';

export type LearningGuideDetail = 'summary' | 'detailed';

function hashString(value: string): string {
	let h1 = 2166136261;
	let h2 = 0x811c9dc5 ^ value.length;
	for (let i = 0; i < value.length; i++) {
		const c = value.charCodeAt(i);
		h1 ^= c;
		h1 = Math.imul(h1, 16777619);
		h2 = Math.imul(h2 ^ c, 0x01000193);
	}
	return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

/** Fingerprint of the unit fields that feed learning-guide generation and headers. */
export function learningGuideSourceHash(unit: UnitPlan): string {
	const guide = learningGuideFromUnitPlan(unit);
	return hashString(
		JSON.stringify({
			yearLevel: guide.yearLevel,
			subject: guide.subject,
			term: guide.term,
			context: buildLearningGuideVocabularyContext(unit, guide)
		})
	);
}

export function learningGuidesMatchUnit(unit: UnitPlan): boolean {
	return Boolean(unit.learningGuides) && unit.learningGuides?.sourceHash === learningGuideSourceHash(unit);
}

export function savedLearningGuideVariant(
	unit: UnitPlan,
	detail: LearningGuideDetail
): SavedLearningGuideVariant | undefined {
	if (!learningGuidesMatchUnit(unit)) return undefined;
	const variant = unit.learningGuides?.[detail];
	if (!variant?.vocabulary?.trim()) return undefined;
	if (detail === 'summary' && (!variant.weeks || variant.weeks.length === 0)) return undefined;
	return variant;
}

export function applySavedLearningGuide(
	unit: UnitPlan,
	detail: LearningGuideDetail
): LearningGuideData | null {
	const variant = savedLearningGuideVariant(unit, detail);
	if (!variant) return null;
	const data = learningGuideFromUnitPlan(unit);
	data.vocabulary = variant.vocabulary;
	if (detail === 'summary' && variant.weeks?.length) {
		data.weeks = variant.weeks;
	}
	return data;
}

export function storeLearningGuideVariant(
	unit: UnitPlan,
	detail: LearningGuideDetail,
	variant: SavedLearningGuideVariant
): SavedLearningGuides {
	const hash = learningGuideSourceHash(unit);
	const previous = unit.learningGuides?.sourceHash === hash ? unit.learningGuides : undefined;
	return {
		sourceHash: hash,
		summary: detail === 'summary' ? variant : previous?.summary,
		detailed: detail === 'detailed' ? variant : previous?.detailed
	};
}

export function resolveLearningGuidesForSave(
	incoming: UnitPlan,
	existing?: UnitPlan | null
): SavedLearningGuides | undefined {
	const hash = learningGuideSourceHash(incoming);
	const take = (guides: SavedLearningGuides | undefined) =>
		guides?.sourceHash === hash ? guides : undefined;
	const fromIncoming = take(incoming.learningGuides);
	const fromExisting = take(existing?.learningGuides);
	const merged: SavedLearningGuides = {
		sourceHash: hash,
		summary: fromIncoming?.summary ?? fromExisting?.summary,
		detailed: fromIncoming?.detailed ?? fromExisting?.detailed
	};
	if (!merged.summary && !merged.detailed) return undefined;
	return merged;
}

export function applyResolvedLearningGuides(
	plan: UnitPlan,
	existing?: UnitPlan | null
): UnitPlan {
	const learningGuides = resolveLearningGuidesForSave(plan, existing);
	if (learningGuides) plan.learningGuides = learningGuides;
	else delete plan.learningGuides;
	return plan;
}
