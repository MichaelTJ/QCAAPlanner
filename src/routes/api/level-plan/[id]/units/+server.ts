import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	appendUnitColumnToLevelPlan,
	ensureEmptyUnitSlotOnLevelPlan
} from '$lib/server/data';

export const POST: RequestHandler = async ({ params, request }) => {
	const body = (await request.json().catch(() => ({}))) as {
		title?: string;
		/** Prefer an empty slot when present; otherwise append. Default true. */
		reuseEmptySlot?: boolean;
	};
	const title = typeof body.title === 'string' ? body.title : undefined;
	const reuseEmptySlot = body.reuseEmptySlot !== false;

	try {
		const result = reuseEmptySlot
			? await ensureEmptyUnitSlotOnLevelPlan(params.id, title)
			: await appendUnitColumnToLevelPlan(params.id, title);
		return json(result, { status: 201 });
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Failed to add unit column';
		return json({ message }, { status: 400 });
	}
};
