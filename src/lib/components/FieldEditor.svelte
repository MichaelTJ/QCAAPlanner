<script lang="ts">
	import type { AiField } from '$lib/types';
	import type { GenerationUsage } from '$lib/gemini-models';
	import ModelFeedback from '$lib/components/ModelFeedback.svelte';

	interface Props {
		label: string;
		field: AiField<unknown>;
		multiline?: boolean;
		rows?: number;
		docType: 'level-plan' | 'unit-plan' | 'assessment-item';
		docId: string;
		levelPlanId?: string;
		fieldPath: string;
		onupdate?: (field: AiField<unknown>) => void;
	}

	let {
		label,
		field = $bindable(),
		multiline = true,
		rows = 4,
		docType,
		docId,
		levelPlanId,
		fieldPath,
		onupdate
	}: Props = $props();

	let generating = $state(false);
	let error = $state('');
	let lastUsage = $state<GenerationUsage | null>(null);
	// Local notes avoid Svelte 5 nested $bindable writes being dropped before generate().
	let aiNotes = $state(String(field.aiNotes ?? ''));

	function commitField(next: AiField<unknown>) {
		field = next;
		onupdate?.(next);
	}

	async function generate() {
		generating = true;
		error = '';
		lastUsage = null;
		const notes = aiNotes;
		try {
			const res = await fetch('/api/generate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					docType,
					docId,
					levelPlanId,
					fieldPath,
					fieldLabel: label,
					currentValue: String(field.value ?? ''),
					aiNotes: notes
				})
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.message || 'Generation failed');
			commitField({
				...field,
				value: data.value,
				aiNotes: notes,
				lastGenerated: data.lastGenerated
			});
			lastUsage = {
				model: data.model,
				modelLabel: data.modelLabel,
				attemptedModels: data.attemptedModels ?? [],
				usedFallback: data.usedFallback ?? false
			};
		} catch (e) {
			error = e instanceof Error ? e.message : 'Generation failed';
		} finally {
			generating = false;
		}
	}
</script>

<div class="field-editor">
	<div>
		<label for={fieldPath}>{label}</label>
		{#if multiline}
			<textarea id={fieldPath} bind:value={field.value} {rows}></textarea>
		{:else}
			<input id={fieldPath} type="text" bind:value={field.value} />
		{/if}
	</div>
	<div class="ai-panel">
		<label for="{fieldPath}-notes">AI notes</label>
		<textarea
			id="{fieldPath}-notes"
			placeholder="Tell the AI what to write or how to improve..."
			bind:value={aiNotes}
		></textarea>
		<div class="field-actions">
			<button class="btn btn-primary btn-sm" onclick={generate} disabled={generating}>
				{generating ? 'Generating…' : 'Generate'}
			</button>
			{#if field.lastGenerated}
				<span class="meta">Generated {new Date(field.lastGenerated).toLocaleString()}</span>
			{/if}
		</div>
		<ModelFeedback usage={lastUsage} />
		{#if error}<p class="error">{error}</p>{/if}
	</div>
</div>
