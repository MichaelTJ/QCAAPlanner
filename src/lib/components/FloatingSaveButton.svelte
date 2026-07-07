<script lang="ts">
	interface Props {
		dirty: boolean;
		saving?: boolean;
		saved?: boolean;
		onclick: () => void | Promise<void>;
		label?: string;
	}

	let {
		dirty,
		saving = false,
		saved = false,
		onclick,
		label = 'Save'
	}: Props = $props();
</script>

{#if dirty}
	<div class="floating-save" role="region" aria-label="Unsaved changes">
		{#if saved}<span class="floating-save-status meta">Saved</span>{/if}
		<button class="btn btn-primary" {onclick} disabled={saving}>
			{saving ? 'Saving…' : label}
		</button>
	</div>
{/if}
