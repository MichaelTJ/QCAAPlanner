import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getFacultyIndex, saveFacultyIndex, slugId, createLevelPlanFromFacultyRow } from '$lib/server/data';
import { createId } from '$lib/defaults';
import type { FacultyRow } from '$lib/types';

export const GET: RequestHandler = async () => {
	const index = await getFacultyIndex();
	return json(index);
};

export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as {
		learningAreaSubject: string;
		yearLevelBand: string;
	};

	const id =
		slugId(`${body.learningAreaSubject}-${body.yearLevelBand}`) || createId('plan');

	const row: FacultyRow = {
		id,
		learningAreaSubject: body.learningAreaSubject,
		yearLevelBand: body.yearLevelBand,
		dateLastModified: new Date().toISOString()
	};

	const index = await getFacultyIndex();
	if (index.rows.some((r) => r.id === id)) {
		return json({ message: 'A plan with this subject and band already exists' }, { status: 400 });
	}

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

	index.rows[idx] = { ...body, dateLastModified: new Date().toISOString() };
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
