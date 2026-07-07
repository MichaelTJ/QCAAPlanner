import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getFacultyOverview } from '$lib/server/data';

export const GET: RequestHandler = async () => {
	return json(await getFacultyOverview());
};
