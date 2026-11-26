<script lang="ts">
	import type { PageData } from './$types';
	import { untrack } from 'svelte';
	import type { Settings } from '$lib/types';
	import { ENRICH_MODEL_CASCADE, MODEL_CASCADE } from '$lib/gemini-models';
	import FloatingSaveButton from '$lib/components/FloatingSaveButton.svelte';
	import { isDirtySnapshot, snapshotValue } from '$lib/dirty';

	let { data }: { data: PageData } = $props();
	let settings = $state<Settings>(untrack(() => ({ ...data.settings })));
	let saved = $state(false);
	let saving = $state(false);
	let savedSnapshot = $state(untrack(() => snapshotValue({ ...data.settings })));
	const dirty = $derived(isDirtySnapshot(settings, savedSnapshot));
	let error = $state('');

	async function save() {
		saved = false;
		error = '';
		saving = true;
		try {
			const res = await fetch('/api/settings', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(settings)
			});
			if (!res.ok) throw new Error('Save failed');
			saved = true;
			savedSnapshot = snapshotValue(settings);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Save failed';
		} finally {
			saving = false;
		}
	}
</script>

<h1>Settings</h1>

<div class="card">
	<div class="field-editor" style="grid-template-columns: 1fr;">
		<div>
			<label for="school">School</label>
			<input id="school" bind:value={settings.school} />
		</div>
		<div>
			<label for="aiTone">AI tone</label>
			<textarea id="aiTone" rows="4" bind:value={settings.aiTone}></textarea>
		</div>
	</div>
	<button class="btn btn-primary" onclick={save} disabled={saving}>Save settings</button>
	{#if saved}<p class="meta">Saved.</p>{/if}
	{#if error}<p class="error">{error}</p>{/if}
</div>

<div class="card">
	<h2>Model cascade</h2>
	<p class="meta">
		Generate (full ASPIRE scripts) tries these models in order. UI stays on Standard. The overnight
		batch probes with a 120s timeout on the first week, then Flex-queues the model that just
		worked. If one times out or returns 503, it falls back to the next. Weeks finished on an older
		model can be upgraded later.
	</p>
	<ol>
		{#each MODEL_CASCADE as model (model.id)}
			<li>
				<strong>{model.label}</strong>
				<span class="meta">({model.id})</span>
			</li>
		{/each}
	</ol>
	<p class="meta">
		Enrich (one Enhance activity at a time) uses Flash-Lite:
	</p>
	<ol>
		{#each ENRICH_MODEL_CASCADE as model (model.id)}
			<li>
				<strong>{model.label}</strong>
				<span class="meta">({model.id})</span>
			</li>
		{/each}
	</ol>
</div>

<FloatingSaveButton {dirty} {saving} {saved} onclick={save} label="Save settings" />
