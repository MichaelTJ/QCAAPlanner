import { error } from '@sveltejs/kit';
import { getAssessmentItem } from '$lib/server/data';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const item = await getAssessmentItem(params.id);
	if (!item) error(404, 'Assessment item not found');
	return { item };
};
