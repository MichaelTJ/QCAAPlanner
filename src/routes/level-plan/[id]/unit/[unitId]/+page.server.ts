import { error } from '@sveltejs/kit';
import {
	getLevelPlan,
	getUnitPlan,
	listAllAssessmentItems,
	listAssessmentItems,
	listUnitPlans
} from '$lib/server/data';
import { resolveContentDescriptorsForUnit } from '$lib/content-descriptions';
import { unitPlanForLevelIndex } from '$lib/plan-sync';
import { aiField, type ContentDescriptionRow } from '$lib/types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const plan = await getUnitPlan(params.id, params.unitId);
	if (!plan) error(404, 'Unit plan not found');

	if (!plan.duration) {
		plan.duration = aiField('');
	}

	let levelDescription = '';
	let levelPlanContentDescriptions: ContentDescriptionRow[] | undefined;

	const levelPlan = await getLevelPlan(params.id);
	if (levelPlan) {
		levelDescription = String(levelPlan.levelDescription?.value ?? '');
		levelPlanContentDescriptions = levelPlan.contentDescriptions;
		const unitPlans = await listUnitPlans(params.id);
		for (const [index, levelUnit] of levelPlan.units.entries()) {
			const matched = unitPlanForLevelIndex(levelUnit, index, unitPlans);
			if (matched?.id !== plan.id) continue;
			if (!String(plan.duration.value).trim() && String(levelUnit.duration.value).trim()) {
				plan.duration.value = String(levelUnit.duration.value);
			}
			break;
		}
	}

	const contentDescriptors = resolveContentDescriptorsForUnit({
		subject: String(plan.subject.value),
		yearLevel: plan.yearLevel.value,
		levelPlanContentDescriptions
	});

	const [assessmentItems, allAssessmentItems] = await Promise.all([
		listAssessmentItems(undefined, plan.id),
		listAllAssessmentItems()
	]);

	return {
		plan,
		assessmentItems,
		standaloneAssessments: allAssessmentItems.filter((item) => item.isStandalone),
		contentDescriptors,
		levelDescription
	};
};
