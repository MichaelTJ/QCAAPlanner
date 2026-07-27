import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getFacultyIndex,
	saveFacultyIndex,
	uniqueFacultyId,
	createLevelPlanFromFacultyRow
} from '$lib/server/data';
import {
	CURRICULUM_PLAN_TYPE_LIST,
	resolveFacultyCurriculumPlanType,
	type CurriculumPlanTypeId
} from '$lib/curriculum/curriculum-catalogue';
import type { FacultyRow } from '$lib/types';

const VALID_PLAN_TYPES = new Set(CURRICULUM_PLAN_TYPE_LIST.map((p) => p.id));

export const GET: RequestHandler = async () => {
	const index = await getFacultyIndex();
	return json(index);
};

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as {
		learningAreaSubject: string;
		yearLevelBand: string;
		curriculumPlanType?: string;
	};

	if (!body.learningAreaSubject?.trim() || !body.yearLevelBand?.trim()) {
		return json({ message: 'Learning area and year band are required' }, { status: 400 });
	}

	const index = await getFacultyIndex();
	const id = uniqueFacultyId(index, body.learningAreaSubject, body.yearLevelBand);

	const explicitType =
		body.curriculumPlanType && VALID_PLAN_TYPES.has(body.curriculumPlanType as CurriculumPlanTypeId)
			? (body.curriculumPlanType as CurriculumPlanTypeId)
			: null;
	const resolved =
		explicitType ||
		resolveFacultyCurriculumPlanType(body.learningAreaSubject, body.yearLevelBand);

	const row: FacultyRow = {
		id,
		learningAreaSubject: body.learningAreaSubject.trim(),
		yearLevelBand: body.yearLevelBand.trim(),
		...(resolved ? { curriculumPlanType: resolved } : {}),
		dateLastModified: new Date().toISOString()
	};

	index.rows.push(row);
	await saveFacultyIndex(index);
	await createLevelPlanFromFacultyRow(row);

	return json(row, { status: 201 });
};

export const PUT: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as FacultyRow;
	const index = await getFacultyIndex();
	const idx = index.rows.findIndex((r) => r.id === body.id);
	if (idx === -1) return json({ message: 'Row not found' }, { status: 404 });

	const curriculumPlanType =
		body.curriculumPlanType && VALID_PLAN_TYPES.has(body.curriculumPlanType as CurriculumPlanTypeId)
			? body.curriculumPlanType
			: index.rows[idx].curriculumPlanType;

	index.rows[idx] = {
		...body,
		...(curriculumPlanType ? { curriculumPlanType } : {}),
		dateLastModified: new Date().toISOString()
	};
	await saveFacultyIndex(index);
	return json(index.rows[idx]);
};

export const DELETE: RequestHandler = async ({ url }) => {
	const id = url.searchParams.get('id');
	if (!id) return json({ message: 'id required' }, { status: 400 });

	const index = await getFacultyIndex();
	index.rows = index.rows.filter((r) => r.id !== id);
	await saveFacultyIndex(index);
	return json({ ok: true });
};
