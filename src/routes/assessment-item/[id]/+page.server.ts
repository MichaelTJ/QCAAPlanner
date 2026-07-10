import { error } from '@sveltejs/kit';
import { ensureInstrumentCatalogue } from '$lib/assessment/digitech-instruments';
import { getAssessmentItem } from '$lib/server/data';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const raw = await getAssessmentItem(params.id);
	if (!raw) error(404, 'Assessment item not found');
	const item = ensureInstrumentCatalogue(structuredClone(raw));
	return { item };
};
