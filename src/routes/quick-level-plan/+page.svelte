<script lang="ts">
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';
	import { formatBandSubjectTitle } from '$lib/defaults';
	import type { QuickPlanType } from '$lib/types';

	let { data }: { data: PageData } = $props();
	let plans = $state([...data.plans]);
	let creating = $state(false);
	let importingId = $state<string | null>(null);
	let error = $state('');

	function formatDate(iso: string) {
		return new Date(iso).toLocaleString('en-AU', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: 'numeric',
			minute: '2-digit',
			hour12: true
		});
	}

	async function startPlan(planType: QuickPlanType) {
		creating = true;
		error = '';
		try {
			const res = await fetch('/api/quick-level-plan', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ planType })
			});
			const plan = await res.json();
			if (!res.ok) throw new Error(plan.message ?? 'Failed to create plan');
			await goto(`/quick-level-plan/${plan.id}`);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to create plan';
			creating = false;
		}
	}

	async function openLevelPlan(levelPlanId: string) {
		importingId = levelPlanId;
		error = '';
		try {
			const res = await fetch('/api/quick-level-plan/from-level-plan', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ levelPlanId })
			});
			const plan = await res.json();
			if (!res.ok) throw new Error(plan.message ?? 'Failed to open level plan');
			await goto(`/quick-level-plan/${plan.id}`);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to open level plan';
			importingId = null;
		}
	}

	async function deletePlan(id: string) {
		if (!confirm('Delete this quick level plan?')) return;
		await fetch(`/api/quick-level-plan/${id}`, { method: 'DELETE' });
		plans = plans.filter((p) => p.id !== id);
	}
</script>

<h1>Quick level plan</h1>
<p class="meta" style="margin-top:-0.5rem;margin-bottom:1.25rem">
	Map unit ideas and assessment items to QCAA content descriptors.
</p>

<div class="card">
	<h2>Open a level plan</h2>
	<p class="meta">Open a finalised level plan in the quick planner — unit titles, descriptions, assessments, and content descriptor checkboxes.</p>
	<table class="data-table">
		<thead>
			<tr>
				<th>Level plan</th>
				<th>Last modified</th>
				<th></th>
			</tr>
		</thead>
		<tbody>
			{#each data.levelPlans as row (row.id)}
				<tr>
					<td>{formatBandSubjectTitle(row.yearLevelBand, row.learningAreaSubject)}</td>
					<td>{formatDate(row.dateLastModified)}</td>
					<td>
						<button
							class="btn btn-sm btn-primary"
							disabled={importingId !== null}
							onclick={() => openLevelPlan(row.id)}
						>
							{importingId === row.id ? 'Opening…' : 'Open in quick plan'}
						</button>
						<a class="btn btn-sm" href="/level-plan/{row.id}">Full editor</a>
					</td>
				</tr>
			{:else}
				<tr>
					<td colspan="3">No level plans yet. Add one from the Overview page.</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<div class="card">
	<h2>Start a new plan</h2>
	<p class="meta">Choose the subject and year band for your level plan.</p>
	<div class="plan-type-grid">
		{#each data.planTypes as planType (planType.id)}
			<button
				class="plan-type-card"
				disabled={creating || importingId !== null}
				onclick={() => startPlan(planType.id)}
			>
				<strong>{planType.label}</strong>
				{#if planType.contentDescriptors.length}
					<span class="meta">{planType.contentDescriptors.length} content descriptors</span>
				{:else}
					<span class="meta">Curriculum data coming soon</span>
				{/if}
			</button>
		{/each}
	</div>
	{#if error}<p class="error">{error}</p>{/if}
</div>

{#if plans.length}
	<div class="card">
		<h2>Saved quick plans</h2>
		<table class="data-table">
			<thead>
				<tr>
					<th>Plan</th>
					<th>Source</th>
					<th>Last modified</th>
					<th></th>
				</tr>
			</thead>
			<tbody>
				{#each plans as plan (plan.id)}
					<tr>
						<td>{plan.title}</td>
						<td>
							{#if plan.sourceLevelPlanId}
								<a class="btn btn-sm" href="/level-plan/{plan.sourceLevelPlanId}">Level plan</a>
							{:else}
								<span class="meta">Draft</span>
							{/if}
						</td>
						<td>{formatDate(plan.modifiedAt)}</td>
						<td>
							<a class="btn btn-sm" href="/quick-level-plan/{plan.id}">Open</a>
							<button class="btn btn-sm" onclick={() => deletePlan(plan.id)}>Delete</button>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
