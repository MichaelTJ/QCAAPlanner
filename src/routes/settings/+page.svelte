<script lang="ts">
	import type { PageData } from './$types';
	import type { Settings } from '$lib/types';
	import { MODEL_CASCADE } from '$lib/gemini-models';
	import FloatingSaveButton from '$lib/components/FloatingSaveButton.svelte';
	import { isDirtySnapshot, snapshotValue } from '$lib/dirty';

	let { data }: { data: PageData } = $props();
	let settings = $state<Settings>({ ...data.settings });
	let saved = $state(false);
	let saving = $state(false);
	let savedSnapshot = $state(snapshotValue({ ...data.settings }));
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
		When generating content, the app tries these models in order. If one is rate limited, it
		automatically falls back to the next.
	</p>
	<ol>
		{#each MODEL_CASCADE as model, i}
			<li>
				<strong>{model.label}</strong>
				<span class="meta">({model.id})</span>
			</li>
		{/each}
	</ol>
</div>

<FloatingSaveButton {dirty} {saving} {saved} onclick={save} label="Save settings" />
