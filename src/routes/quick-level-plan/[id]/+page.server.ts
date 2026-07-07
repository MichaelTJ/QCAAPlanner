import { error } from '@sveltejs/kit';
import { getLevelPlan, getQuickLevelPlan, refreshQuickLevelPlanFromSource } from '$lib/server/data';
import { getCurriculumForPlanType } from '$lib/curriculum/quick-plan-data';
import { contentDescriptorsFromLevelPlan } from '$lib/quick-plan';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const raw = await getQuickLevelPlan(params.id);
	if (!raw) error(404, 'Plan not found');
	const plan = await refreshQuickLevelPlanFromSource(raw);
	const curriculum = getCurriculumForPlanType(plan.planType);

	let levelDescription = curriculum.levelDescription;
	let contentDescriptors = curriculum.contentDescriptors;

	if (plan.sourceLevelPlanId) {
		const source = await getLevelPlan(plan.sourceLevelPlanId);
		if (source) {
			if (!levelDescription && source.levelDescription.value) {
				levelDescription = source.levelDescription.value;
			}
			if (!contentDescriptors.length && source.contentDescriptions.length) {
				contentDescriptors = contentDescriptorsFromLevelPlan(source);
			}
		}
	}

	// Fall back to inclusion rows when a saved quick plan has descriptors not in curriculum data.
	if (!contentDescriptors.length && plan.contentInclusions.length) {
		contentDescriptors = plan.contentInclusions.map((row) => ({
			id: row.contentDescriptorId,
			category: 'Content descriptions',
			strand: '',
			subStrand: '',
			text: row.contentDescriptorId,
			code: row.contentDescriptorId
		}));
	}

	return {
		plan,
		curriculum: { ...curriculum, levelDescription, contentDescriptors }
	};
};
