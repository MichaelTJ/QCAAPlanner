<script lang="ts">
	import {
		getCapabilityDefinition,
		type CapabilityCategory
	} from '$lib/general-capabilities';
	import type { CapabilityRow } from '$lib/types';

	let {
		row,
		unitLabels
	}: {
		row: CapabilityRow;
		unitLabels: string[];
	} = $props();

	const definition = $derived(getCapabilityDefinition(row.name.value));
	const unitCount = $derived(unitLabels.length);

	function categoryInclusions(category: CapabilityCategory): boolean[] {
		row.categoryInclusions ??= {};
		if (!row.categoryInclusions[category.id]) {
			row.categoryInclusions[category.id] = Array(unitCount).fill(false);
		}
		return row.categoryInclusions[category.id];
	}

	function subInclusions(subId: string): boolean[] {
		row.subElementInclusions ??= {};
		if (!row.subElementInclusions[subId]) {
			row.subElementInclusions[subId] = Array(unitCount).fill(false);
		}
		return row.subElementInclusions[subId];
	}

	function categoryChecked(category: CapabilityCategory): boolean {
		const inc = categoryInclusions(category);
		return inc.length > 0 && inc.every(Boolean);
	}

	function setCategoryUnit(category: CapabilityCategory, unitIndex: number, checked: boolean) {
		categoryInclusions(category)[unitIndex] = checked;
		for (const sub of category.subElements) {
			subInclusions(sub.id)[unitIndex] = checked;
		}
	}

	function setSubUnit(subId: string, category: CapabilityCategory, unitIndex: number, checked: boolean) {
		subInclusions(subId)[unitIndex] = checked;
		const allChecked = category.subElements.every((sub) => subInclusions(sub.id)[unitIndex]);
		categoryInclusions(category)[unitIndex] = allChecked;
	}

	function setCategory(category: CapabilityCategory, checked: boolean) {
		for (let ui = 0; ui < unitCount; ui++) {
			setCategoryUnit(category, ui, checked);
		}
	}
</script>

{#if definition}
	<table class="data-table capability-matrix">
		<thead>
			<tr>
				<th class="capability-matrix-label">Element / sub-element</th>
				{#each unitLabels as label}
					<th>{label}</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each definition.categories as category (category.id)}
				<tr class="capability-category-row">
					<td>
						<label class="capability-matrix-category">
							<input
								type="checkbox"
								checked={categoryChecked(category)}
								onchange={(event) =>
									setCategory(category, (event.currentTarget as HTMLInputElement).checked)}
							/>
							<strong>{category.label}</strong>
						</label>
					</td>
					{#each categoryInclusions(category) as _, ui}
						<td class="check-cell">
							<input
								type="checkbox"
								checked={categoryInclusions(category)[ui]}
								onchange={(event) =>
									setCategoryUnit(
										category,
										ui,
										(event.currentTarget as HTMLInputElement).checked
									)}
							/>
						</td>
					{/each}
				</tr>
				{#each category.subElements as sub (sub.id)}
					<tr class="capability-sub-row">
						<td class="capability-sub-label">{sub.label}</td>
						{#each subInclusions(sub.id) as _, ui}
							<td class="check-cell">
								<input
									type="checkbox"
									checked={subInclusions(sub.id)[ui]}
									onchange={(event) =>
										setSubUnit(
											sub.id,
											category,
											ui,
											(event.currentTarget as HTMLInputElement).checked
										)}
								/>
							</td>
						{/each}
					</tr>
				{/each}
			{/each}
		</tbody>
	</table>
{:else}
	<table class="data-table">
		<thead>
			<tr>
				<th>Capability</th>
				{#each unitLabels as label}<th>{label}</th>{/each}
			</tr>
		</thead>
		<tbody>
			<tr>
				<td>{row.name.value}</td>
				{#each row.unitInclusions as inc, ci}
					<td class="check-cell"><input type="checkbox" bind:checked={row.unitInclusions[ci]} /></td>
				{/each}
			</tr>
		</tbody>
	</table>
{/if}
