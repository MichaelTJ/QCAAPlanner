/** Mirrors SvelteKit `$env/dynamic/private` for tsx scripts. */
export const env = process.env as Record<string, string | undefined>;
