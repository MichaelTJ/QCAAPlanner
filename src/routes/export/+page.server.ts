import { getFacultyOverview, listAllAssessmentItems, listAllUnitPlans } from '$lib/server/data';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [overview, allUnits, allAssessments] = await Promise.all([
		getFacultyOverview(),
		listAllUnitPlans(),
		listAllAssessmentItems()
	]);
	return { overview, allUnits, allAssessments };
};
