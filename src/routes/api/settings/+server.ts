import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSettings, saveSettings } from '$lib/server/data';

export const GET: RequestHandler = async () => json(await getSettings());

export const PUT: RequestHandler = async ({ request }) => {
	const settings = await request.json();
	await saveSettings(settings);
	return json(settings);
};
