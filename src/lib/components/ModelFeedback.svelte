<script lang="ts">
	import type { GenerationUsage } from '$lib/gemini-models';

	let { usage }: { usage: GenerationUsage | null } = $props();
</script>

{#if usage}
	<div class="model-feedback">
		<p class="model-feedback-used">
			{#if usage.usedFallback}
				Rate limited — used <strong>{usage.modelLabel}</strong>
				<span class="meta">({usage.model})</span>
			{:else}
				Generated with <strong>{usage.modelLabel}</strong>
				<span class="meta">({usage.model})</span>
			{/if}
		</p>
		{#if usage.attemptedModels.length > 1}
			<details>
				<summary>Model attempts ({usage.attemptedModels.length})</summary>
				<ul>
					{#each usage.attemptedModels as attempt}
						<li class:failed={!!attempt.error}>
							{attempt.label}
							<span class="meta">({attempt.model})</span>
							{#if attempt.error}
								— <span class="error">{attempt.error}</span>
							{:else}
								— succeeded
							{/if}
						</li>
					{/each}
				</ul>
			</details>
		{/if}
	</div>
{/if}

<style>
	.model-feedback {
		margin-top: 0.5rem;
		font-size: 0.8rem;
	}

	.model-feedback-used {
		margin: 0.25rem 0 0;
	}

	.model-feedback ul {
		margin: 0.35rem 0 0;
		padding-left: 1.2rem;
	}

	.model-feedback li.failed {
		color: #8a4b00;
	}

	.model-feedback details summary {
		cursor: pointer;
		color: #1e3a5f;
	}
</style>
