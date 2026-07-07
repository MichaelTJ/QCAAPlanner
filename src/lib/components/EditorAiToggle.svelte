<script lang="ts">
	let { showAi = $bindable(true) }: { showAi?: boolean } = $props();
</script>

<button class="btn" type="button" onclick={() => (showAi = !showAi)}>
	{showAi ? 'Hide AI panels' : 'Show AI panels'}
</button>
