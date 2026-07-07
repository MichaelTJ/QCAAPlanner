import { getSettings } from '$lib/server/data';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({ settings: await getSettings() });
