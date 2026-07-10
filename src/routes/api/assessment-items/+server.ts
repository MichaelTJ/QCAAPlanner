import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	createAssessmentItem,
	deleteAssessmentItem,
	getAssessmentItem,
	listAllAssessmentItems,
	listAssessmentItems,
	saveAssessmentItem
} from '$lib/server/data';
import { STANDALONE_LEVEL_PLAN_ID, STANDALONE_UNIT_PLAN_ID } from '$lib/defaults';
import type { AssessmentItem } from '$lib/types';

export const GET: RequestHandler = async ({ url }) => {
	const id = url.searchParams.get('id');
	const levelPlanId = url.searchParams.get('levelPlanId') ?? undefined;
	const unitPlanId = url.searchParams.get('unitPlanId') ?? undefined;
	const all = url.searchParams.get('all') === '1';

	if (id) {
		const item = await getAssessmentItem(id);
		if (!item) return json({ message: 'Not found' }, { status: 404 });
		return json(item);
	}

	if (all) {
		return json(await listAllAssessmentItems());
	}

	return json(await listAssessmentItems(levelPlanId, unitPlanId));
};

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as {
		levelPlanId?: string;
		unitPlanId?: string;
		title?: string;
		assessmentIndex?: number;
		standalone?: boolean;
	};

	if (body.standalone) {
		const item = await createAssessmentItem(
			STANDALONE_LEVEL_PLAN_ID,
			STANDALONE_UNIT_PLAN_ID,
			{ title: body.title }
		);
		return json(item, { status: 201 });
	}

	if (!body.levelPlanId || !body.unitPlanId) {
		return json({ message: 'levelPlanId and unitPlanId are required' }, { status: 400 });
	}

	const item = await createAssessmentItem(body.levelPlanId, body.unitPlanId, {
		title: body.title,
		assessmentIndex: body.assessmentIndex
	});
	return json(item, { status: 201 });
};

export const PUT: RequestHandler = async ({ request }) => {
	const item = (await request.json()) as AssessmentItem;
	const saved = await saveAssessmentItem(item);
	return json(saved);
};

export const DELETE: RequestHandler = async ({ url }) => {
	const id = url.searchParams.get('id');
	if (!id) return json({ message: 'id is required' }, { status: 400 });
	try {
		await deleteAssessmentItem(id);
		return json({ ok: true });
	} catch (err) {
		return json({ message: err instanceof Error ? err.message : 'Delete failed' }, { status: 400 });
	}
};
