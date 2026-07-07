import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getUnitPlan,
	listUnitPlans,
	saveUnitPlan,
	deleteUnitPlan
} from '$lib/server/data';
import { createEmptyUnitPlan, createId } from '$lib/defaults';
import type { UnitPlan } from '$lib/types';

export const GET: RequestHandler = async ({ params, url }) => {
	const unitId = url.searchParams.get('unitId');
	if (!unitId) {
		const plans = await listUnitPlans(params.levelPlanId);
		return json(plans);
	}
	const plan = await getUnitPlan(params.levelPlanId, unitId);
	if (!plan) return json({ message: 'Not found' }, { status: 404 });
	return json(plan);
};

export const POST: RequestHandler = async ({ params, request }) => {
	const body = (await request.json()) as { unitNumber?: number };
	const unitNumber = body.unitNumber ?? 1;
	const existing = await listUnitPlans(params.levelPlanId);
	if (existing.some((p) => Number(p.unitNumber.value) === unitNumber)) {
		return json({ message: 'A unit plan already exists for this unit number' }, { status: 409 });
	}
	const id = createId('unit');
	const plan = createEmptyUnitPlan(id, params.levelPlanId, unitNumber);
	await saveUnitPlan(plan);
	return json(plan, { status: 201 });
};

export const PUT: RequestHandler = async ({ params, request }) => {
	const plan = (await request.json()) as UnitPlan;
	if (plan.levelPlanId !== params.levelPlanId) {
		return json({ message: 'Level plan ID mismatch' }, { status: 400 });
	}
	await saveUnitPlan(plan);
	return json(plan);
};

export const DELETE: RequestHandler = async ({ params, url }) => {
	const unitId = url.searchParams.get('unitId');
	if (!unitId) {
		return json({ message: 'unitId is required' }, { status: 400 });
	}
	const plan = await getUnitPlan(params.levelPlanId, unitId);
	if (!plan) return json({ message: 'Not found' }, { status: 404 });

	try {
		await deleteUnitPlan(params.levelPlanId, unitId, {
			internal: url.searchParams.get('internal') === '1'
		});
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Delete not allowed';
		return json({ message }, { status: 403 });
	}
	return json({ ok: true });
};
