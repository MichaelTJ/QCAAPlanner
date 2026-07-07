<script lang="ts">
	import type { AiField } from '$lib/types';
	import type { GenerationUsage } from '$lib/gemini-models';
	import ModelFeedback from '$lib/components/ModelFeedback.svelte';

	interface Props {
		label: string;
		field: AiField<string>;
		options: readonly string[];
		docType: 'level-plan' | 'unit-plan' | 'assessment-item';
		docId: string;
		levelPlanId?: string;
		fieldPath: string;
	}

	let {
		label,
		field = $bindable(),
		options,
		docType,
		docId,
		levelPlanId,
		fieldPath
	}: Props = $props();

	let generating = $state(false);
	let error = $state('');
	let lastUsage = $state<GenerationUsage | null>(null);

	async function generate() {
		generating = true;
		error = '';
		lastUsage = null;
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
					currentValue: field.value,
					aiNotes: field.aiNotes
				})
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.message || 'Generation failed');
			const match = options.find((o) =>
				data.value.toLowerCase().includes(o.toLowerCase())
			);
			field = { ...field, value: match || data.value, lastGenerated: data.lastGenerated };
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
		<select id={fieldPath} bind:value={field.value}>
			<option value="">— Select —</option>
			{#each options as opt}
				<option value={opt}>{opt}</option>
			{/each}
		</select>
	</div>
	<div class="ai-panel">
		<label for="{fieldPath}-notes">AI notes</label>
		<textarea id="{fieldPath}-notes" bind:value={field.aiNotes}></textarea>
		<div class="field-actions">
			<button class="btn btn-primary btn-sm" onclick={generate} disabled={generating}>
				{generating ? 'Generating…' : 'Generate'}
			</button>
		</div>
		<ModelFeedback usage={lastUsage} />
		{#if error}<p class="error">{error}</p>{/if}
	</div>
</div>
