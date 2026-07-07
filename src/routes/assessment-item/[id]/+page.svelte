<script lang="ts">
	import type { PageData } from './$types';
	import FieldEditor from '$lib/components/FieldEditor.svelte';
	import SelectFieldEditor from '$lib/components/SelectFieldEditor.svelte';
	import { ASSESSMENT_MODES, ASSESSMENT_TECHNIQUES } from '$lib/defaults';
	import type { AssessmentItem } from '$lib/types';
	import EditorAiToggle from '$lib/components/EditorAiToggle.svelte';
	import FloatingSaveButton from '$lib/components/FloatingSaveButton.svelte';
	import { isDirtySnapshot, snapshotValue } from '$lib/dirty';

	let { data }: { data: PageData } = $props();
	let item = $state<AssessmentItem>(structuredClone(data.item));
	let saving = $state(false);
	let saved = $state(false);
	let savedSnapshot = $state(snapshotValue(structuredClone(data.item)));
	const dirty = $derived(isDirtySnapshot(item, savedSnapshot));
	let showAiPanels = $state(true);

	async function save() {
		saving = true;
		saved = false;
		const res = await fetch('/api/assessment-items', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(item)
		});
		if (res.ok) {
			saved = true;
			savedSnapshot = snapshotValue(item);
		}
		saving = false;
	}
</script>

<div class="toolbar">
	<a class="btn" href="/level-plan/{item.levelPlanId}/unit/{item.unitPlanId}">← Unit plan</a>
	<h1 style="margin:0;flex:1">{item.title.value || 'Assessment item'}</h1>
	<EditorAiToggle bind:showAi={showAiPanels} />
	<button class="btn btn-primary" onclick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
	{#if saved}<span class="meta">Saved</span>{/if}
</div>

<div class="doc-editor" class:hide-ai-panels={!showAiPanels}>
<div class="card">
	<p class="meta">Placeholder schema — add more fields when you have examples.</p>
	<FieldEditor label="Title" bind:field={item.title} docType="assessment-item" docId={item.id} fieldPath="title" multiline={false} />
	<FieldEditor label="Description" bind:field={item.description} docType="assessment-item" docId={item.id} fieldPath="description" rows={6} />
	<div class="grid-2">
		<SelectFieldEditor label="Technique" bind:field={item.technique} options={ASSESSMENT_TECHNIQUES} docType="assessment-item" docId={item.id} fieldPath="technique" />
		<SelectFieldEditor label="Mode" bind:field={item.mode} options={ASSESSMENT_MODES} docType="assessment-item" docId={item.id} fieldPath="mode" />
	</div>
	<FieldEditor label="Conditions" bind:field={item.conditions} docType="assessment-item" docId={item.id} fieldPath="conditions" rows={4} />
	<FieldEditor label="Marking criteria" bind:field={item.markingCriteria} docType="assessment-item" docId={item.id} fieldPath="markingCriteria" rows={6} />
	<FieldEditor label="Notes" bind:field={item.notes} docType="assessment-item" docId={item.id} fieldPath="notes" rows={4} />
</div>
</div>

<FloatingSaveButton {dirty} {saving} {saved} onclick={save} />
