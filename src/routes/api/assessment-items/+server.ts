import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	createAssessmentItem,
	getAssessmentItem,
	listAssessmentItems,
	saveAssessmentItem
} from '$lib/server/data';
import type { AssessmentItem } from '$lib/types';

export const GET: RequestHandler = async ({ url }) => {
	const id = url.searchParams.get('id');
	const levelPlanId = url.searchParams.get('levelPlanId') ?? undefined;
	const unitPlanId = url.searchParams.get('unitPlanId') ?? undefined;

	if (id) {
		const item = await getAssessmentItem(id);
		if (!item) return json({ message: 'Not found' }, { status: 404 });
		return json(item);
	}

	return json(await listAssessmentItems(levelPlanId, unitPlanId));
};

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as {
		levelPlanId: string;
		unitPlanId: string;
		title?: string;
	};
	const item = await createAssessmentItem(
		body.levelPlanId,
		body.unitPlanId,
		body.title
	);
	return json(item, { status: 201 });
};

export const PUT: RequestHandler = async ({ request }) => {
	const item = (await request.json()) as AssessmentItem;
	await saveAssessmentItem(item);
	return json(item);
};
