<script lang="ts">
	import { onMount, tick } from 'svelte';
	import type { PageData } from './$types';
	import { fitAllTextareas, fitTextareaHeight } from '$lib/actions/fit-textarea';
	import {
		addQuickPlanUnit,
		assessmentColumnIndex,
		getSelectedDescriptorsForAssessment,
		getSelectedDescriptorsForUnit,
		removeQuickPlanUnit
	} from '$lib/quick-plan';
	import type { QuickLevelPlan } from '$lib/types';

	let { data }: { data: PageData } = $props();
	let plan = $state<QuickLevelPlan>(structuredClone(data.plan));
	let saving = $state(false);
	let saved = $state(false);
	let refineError = $state('');
	let refiningKey = $state<string | null>(null);

	const REFINE_TIMEOUT_MS = 60_000;

	async function postRefine(body: Record<string, unknown>) {
		const res = await fetch('/api/quick-level-plan/refine', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(REFINE_TIMEOUT_MS)
		});
		const result = await res.json();
		if (!res.ok) throw new Error(result.message ?? 'Refinement failed');
		return result as { value: string };
	}

	function refineFailureMessage(error: unknown) {
		if (error instanceof Error && error.name === 'TimeoutError') {
			return 'Refinement timed out after 60 seconds. Try again.';
		}
		return error instanceof Error ? error.message : 'Refinement failed';
	}

	async function refitTextareas() {
		await tick();
		fitAllTextareas();
	}

	onMount(() => {
		requestAnimationFrame(() => fitAllTextareas());
	});

	const groupedDescriptors = $derived.by(() => {
		const groups = new Map<string, typeof data.curriculum.contentDescriptors>();
		for (const cd of data.curriculum.contentDescriptors) {
			const list = groups.get(cd.category) ?? [];
			list.push(cd);
			groups.set(cd.category, list);
		}
		return [...groups.entries()];
	});

	function inclusionRow(contentDescriptorId: string) {
		return plan.contentInclusions.find((row) => row.contentDescriptorId === contentDescriptorId);
	}

	function descriptorCountForUnit(unitIndex: number) {
		return getSelectedDescriptorsForUnit(plan, data.curriculum.contentDescriptors, unitIndex).length;
	}

	function descriptorCountForAssessment(unitIndex: number, assessmentIndex: number) {
		return getSelectedDescriptorsForAssessment(
			plan,
			data.curriculum.contentDescriptors,
			unitIndex,
			assessmentIndex
		).length;
	}

	async function save() {
		saving = true;
		saved = false;
		const res = await fetch(`/api/quick-level-plan/${plan.id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(plan)
		});
		if (res.ok) {
			plan = await res.json();
			saved = true;
			await refitTextareas();
		}
		saving = false;
	}

	function handleAddUnit() {
		plan = addQuickPlanUnit(plan);
		void refitTextareas();
	}

	function handleRemoveUnit(unitIndex: number) {
		plan = removeQuickPlanUnit(plan, unitIndex);
	}

	async function refineUnit(unitIndex: number) {
		const selected = getSelectedDescriptorsForUnit(
			plan,
			data.curriculum.contentDescriptors,
			unitIndex
		);
		if (!selected.length) {
			refineError = 'Select at least one content descriptor for this unit before refining.';
			return;
		}

		const key = `unit-${unitIndex}`;
		refiningKey = key;
		refineError = '';
		try {
			const result = await postRefine({
				target: 'unit',
				planType: plan.planType,
				levelDescription: data.curriculum.levelDescription,
				unitTitle: plan.units[unitIndex].title,
				currentValue: plan.units[unitIndex].description,
				selectedContentDescriptors: selected.map((d) => ({
					code: d.code,
					text: d.text,
					strand: d.strand
				}))
			});
			plan.units[unitIndex].description = result.value;
			await refitTextareas();
		} catch (e) {
			refineError = refineFailureMessage(e);
		} finally {
			refiningKey = null;
		}
	}

	async function refineAssessment(unitIndex: number, assessmentIndex: number) {
		const selected = getSelectedDescriptorsForAssessment(
			plan,
			data.curriculum.contentDescriptors,
			unitIndex,
			assessmentIndex
		);
		if (!selected.length) {
			refineError =
				'Select at least one content descriptor for this assessment before refining.';
			return;
		}

		const key = `assess-${unitIndex}-${assessmentIndex}`;
		refiningKey = key;
		refineError = '';
		try {
			const result = await postRefine({
				target: 'assessment',
				planType: plan.planType,
				levelDescription: data.curriculum.levelDescription,
				unitTitle: plan.units[unitIndex].title,
				assessmentTitle: plan.units[unitIndex].assessments[assessmentIndex].title,
				currentValue: plan.units[unitIndex].assessments[assessmentIndex].description,
				selectedContentDescriptors: selected.map((d) => ({
					code: d.code,
					text: d.text,
					strand: d.strand
				}))
			});
			plan.units[unitIndex].assessments[assessmentIndex].description = result.value;
			await refitTextareas();
		} catch (e) {
			refineError = refineFailureMessage(e);
		} finally {
			refiningKey = null;
		}
	}
</script>

<div class="toolbar">
	<a class="btn" href="/quick-level-plan">← Quick plans</a>
	<h1 style="margin:0;flex:1;font-size:1.35rem">{plan.title}</h1>
	{#if plan.sourceLevelPlanId}
		<a class="btn" href="/level-plan/{plan.sourceLevelPlanId}">Full level plan</a>
	{/if}
	<button class="btn btn-primary" onclick={save} disabled={saving}>
		{saving ? 'Saving…' : 'Save'}
	</button>
	{#if saved}<span class="meta">Saved</span>{/if}
</div>

{#if refineError}
	<p class="error">{refineError}</p>
{/if}

<div class="card">
	<h2>Level description</h2>
	{#if data.curriculum.levelDescription}
		<div class="level-description">
			{#each data.curriculum.levelDescription.split('\n\n') as paragraph}
				<p>{paragraph}</p>
			{/each}
		</div>
	{:else}
		<p class="meta">Level description not yet added for this plan type.</p>
	{/if}
</div>

{#if data.curriculum.contentDescriptors.length === 0}
	<div class="card">
		<p class="meta">
			Content descriptors for this plan type are not yet in the app. You can still draft unit and
			assessment ideas below; add curriculum data in
			<code>src/lib/curriculum/quick-plan-data.ts</code> when ready.
		</p>
	</div>
{/if}

<div class="toolbar">
	<button class="btn" onclick={handleAddUnit}>Add unit</button>
</div>

<div class="card quick-plan-matrix-wrap">
	<table class="data-table quick-plan-matrix">
		<thead>
			<tr class="unit-header-row">
				<th class="sticky-col corner-cell">Units</th>
				{#each plan.units as unit, ui (unit.id)}
					<th colspan="2" class="unit-header-cell">
						<div class="unit-header">
							<div class="unit-header-top">
								<input
									class="unit-title-input"
									bind:value={plan.units[ui].title}
									placeholder="Unit title"
								/>
								<button
									class="btn btn-sm remove-unit-btn"
									type="button"
									title="Remove unit"
									disabled={plan.units.length <= 1}
									onclick={() => handleRemoveUnit(ui)}
								>×</button>
							</div>
							<textarea
								class="unit-desc-input fit-textarea"
								use:fitTextareaHeight
								bind:value={plan.units[ui].description}
								placeholder="Unit idea / description"
								rows="1"
							></textarea>
							<button
								class="btn btn-sm refine-btn"
								type="button"
								disabled={refiningKey !== null || descriptorCountForUnit(ui) === 0}
								title={descriptorCountForUnit(ui) === 0
									? 'Select content descriptors for this unit first'
									: `Refine using ${descriptorCountForUnit(ui)} selected descriptor(s)`}
								onclick={() => refineUnit(ui)}
							>
								{refiningKey === `unit-${ui}` ? 'Refining…' : 'Refine'}
							</button>
						</div>
					</th>
				{/each}
			</tr>
			<tr class="assessment-header-row">
				<th class="sticky-col">Content descriptors</th>
				{#each plan.units as unit, ui (unit.id)}
					{#each unit.assessments as assessment, ai (assessment.id)}
						<th class="assessment-header-cell">
							<input
								class="assessment-title-input"
								bind:value={plan.units[ui].assessments[ai].title}
								placeholder="Assessment {ai + 1}"
							/>
							<textarea
								class="assessment-desc-input fit-textarea"
								use:fitTextareaHeight
								bind:value={plan.units[ui].assessments[ai].description}
								placeholder="Assessment description"
								rows="1"
							></textarea>
							<button
								class="btn btn-sm refine-btn"
								type="button"
								disabled={refiningKey !== null ||
									descriptorCountForAssessment(ui, ai) === 0}
								title={descriptorCountForAssessment(ui, ai) === 0
									? 'Select content descriptors for this assessment first'
									: `Refine using ${descriptorCountForAssessment(ui, ai)} selected descriptor(s)`}
								onclick={() => refineAssessment(ui, ai)}
							>
								{refiningKey === `assess-${ui}-${ai}` ? 'Refining…' : 'Refine'}
							</button>
						</th>
					{/each}
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each groupedDescriptors as [category, descriptors] (category)}
				<tr class="category-row">
					<td class="sticky-col category-label" colspan={1 + plan.units.length * 2}>
						{category}
					</td>
				</tr>
				{#each descriptors as cd (cd.id)}
					{@const row = inclusionRow(cd.id)}
					<tr>
						<td class="sticky-col descriptor-cell">
							{#if cd.strand}
								<div class="descriptor-strand">{cd.strand}</div>
							{/if}
							<div class="descriptor-text">{cd.text}</div>
							<div class="descriptor-code">{cd.code}</div>
						</td>
						{#each plan.units as _, ui}
							{#each [0, 1] as ai}
								{@const col = assessmentColumnIndex(ui, ai)}
								<td class="check-cell">
									{#if row}
										<input
											type="checkbox"
											aria-label="{cd.code} — Unit {ui + 1} assessment {ai + 1}"
											bind:checked={row.assessmentInclusions[col]}
										/>
									{/if}
								</td>
							{/each}
						{/each}
					</tr>
				{/each}
			{:else}
				<tr>
					<td class="sticky-col meta" colspan={1 + plan.units.length * 2}>
						No content descriptors loaded for this plan type yet.
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
