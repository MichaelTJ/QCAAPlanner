<script lang="ts">
	import {
		getCapabilityDefinition,
		type CapabilityCategory
	} from '$lib/general-capabilities';

	let {
		capabilityName,
		checks = $bindable({})
	}: {
		capabilityName: string;
		checks: Record<string, boolean>;
	} = $props();

	const definition = $derived(getCapabilityDefinition(capabilityName));

	function categoryChecked(category: CapabilityCategory): boolean {
		return category.subElements.every((sub) => checks[sub.id]);
	}

	function setCategory(category: CapabilityCategory, checked: boolean) {
		for (const sub of category.subElements) {
			checks[sub.id] = checked;
		}
	}

	function toggleCategory(category: CapabilityCategory, event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		setCategory(category, input.checked);
	}
</script>

{#if definition}
	<ul class="capability-tree">
		{#each definition.categories as category (category.id)}
			<li class="capability-category">
				<label class="capability-category-label">
					<input
						type="checkbox"
						checked={categoryChecked(category)}
						onchange={(event) => toggleCategory(category, event)}
					/>
					<strong>{category.label}</strong>
				</label>
				<ul class="capability-sub-elements">
					{#each category.subElements as sub (sub.id)}
						<li>
							<label>
								<input type="checkbox" bind:checked={checks[sub.id]} />
								{sub.label}
							</label>
						</li>
					{/each}
				</ul>
			</li>
		{/each}
	</ul>
{:else}
	<p class="meta">No sub-elements defined for this capability.</p>
{/if}
