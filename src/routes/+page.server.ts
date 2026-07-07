import { getFacultyOverview, listAllUnitPlans } from '$lib/server/data';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const [overview, allUnits] = await Promise.all([getFacultyOverview(), listAllUnitPlans()]);
	return { overview, allUnits };
};
