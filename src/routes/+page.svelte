<script lang="ts">
	import type { PageData } from './$types';
	import { formatBandSubjectTitle } from '$lib/defaults';
	import { unitCompatibleWithFaculty } from '$lib/curriculum-match';
	import type { FacultyOverviewEntry, UnitPlanSummary } from '$lib/types';

	let { data }: { data: PageData } = $props();

	let entries = $state<FacultyOverviewEntry[]>([...data.overview]);
	let allUnits = $state<UnitPlanSummary[]>([...data.allUnits]);
	let learningAreaSubject = $state('');
	let yearLevelBand = $state('');
	let standaloneTitle = $state('');
	let saving = $state(false);
	let creatingStandalone = $state(false);
	let boardBusy = $state('');
	let error = $state('');
	let standaloneError = $state('');
	let boardError = $state('');

	function compatibleStandaloneUnits(entry: FacultyOverviewEntry): UnitPlanSummary[] {
		return allUnits
			.filter(
				(unit) =>
					unit.isStandalone &&
					unitCompatibleWithFaculty(
						unit.subject,
						unit.yearLevel,
						entry.learningAreaSubject,
						entry.yearLevelBand
					)
			)
			.sort(
				(a, b) =>
					a.curriculumSortKey.localeCompare(b.curriculumSortKey) ||
					a.unitTitle.localeCompare(b.unitTitle)
			);
	}

	function standaloneGroups(): [string, UnitPlanSummary[]][] {
		const groups = new Map<string, UnitPlanSummary[]>();
		for (const unit of allUnits.filter((u) => u.isStandalone)) {
			const list = groups.get(unit.curriculumLabel) ?? [];
			list.push(unit);
			groups.set(unit.curriculumLabel, list);
		}
		return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
	}

	async function refreshBoard() {
		const [overviewRes, unitsRes] = await Promise.all([
			fetch('/api/faculty/overview'),
			fetch('/api/unit-plans')
		]);
		if (overviewRes.ok) entries = await overviewRes.json();
		if (unitsRes.ok) allUnits = await unitsRes.json();
	}

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

	async function addRow() {
		if (!learningAreaSubject.trim() || !yearLevelBand.trim()) {
			error = 'Learning area and year band are required';
			return;
		}
		saving = true;
		error = '';
		try {
			const res = await fetch('/api/faculty', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ learningAreaSubject, yearLevelBand })
			});
			const row = await res.json();
			if (!res.ok) throw new Error(row.message);
			entries = [
				...entries,
				{
					...row,
					bandSubjectTitle: formatBandSubjectTitle(row.yearLevelBand, row.learningAreaSubject),
					levelPlanStatus: 'Draft',
					units: []
				}
			];
			learningAreaSubject = '';
			yearLevelBand = '';
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to add row';
		} finally {
			saving = false;
		}
	}

	async function deleteRow(id: string) {
		if (!confirm('Delete this faculty row? The level plan file will remain on disk.')) return;
		await fetch(`/api/faculty?id=${id}`, { method: 'DELETE' });
		entries = entries.filter((r) => r.id !== id);
	}

	async function createStandaloneUnit() {
		creatingStandalone = true;
		standaloneError = '';
		try {
			const res = await fetch('/api/unit-plans', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ title: standaloneTitle.trim() || undefined })
			});
			const plan = await res.json();
			if (!res.ok) throw new Error(plan.message || 'Failed to create unit');
			standaloneTitle = '';
			window.location.href = `/level-plan/${plan.levelPlanId}/unit/${plan.id}`;
		} catch (e) {
			standaloneError = e instanceof Error ? e.message : 'Failed to create unit';
		} finally {
			creatingStandalone = false;
		}
	}

	async function deleteStandaloneUnit(unit: UnitPlanSummary) {
		if (!unit.isStandalone) return;
		if (!confirm(`Delete "${unit.unitTitle}"? This cannot be undone.`)) return;
		const res = await fetch(
			`/api/unit-plan/${unit.levelPlanId}?unitId=${unit.id}`,
			{ method: 'DELETE' }
		);
		if (res.ok) {
			await refreshBoard();
		} else {
			const data = await res.json().catch(() => ({}));
			standaloneError =
				data.message || 'Failed to delete unit. Only standalone units can be deleted here.';
		}
	}

	async function detachUnit(entry: FacultyOverviewEntry, unitIndex: number, title: string) {
		if (
			!confirm(
				`Detach "${title}" from ${entry.bandSubjectTitle}? The unit plan will move to standalone and can be re-attached later.`
			)
		) {
			return;
		}
		boardError = '';
		boardBusy = `${entry.id}:${unitIndex}`;
		try {
			const res = await fetch(`/api/level-plan/${entry.id}/units/${unitIndex}/detach`, {
				method: 'POST'
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.message || 'Detach failed');
			await refreshBoard();
		} catch (e) {
			boardError = e instanceof Error ? e.message : 'Detach failed';
		} finally {
			boardBusy = '';
		}
	}

	async function attachUnit(
		entry: FacultyOverviewEntry,
		unitIndex: number,
		unitPlanId: string,
		slotTitle: string,
		hasUnitPlan: boolean
	) {
		if (!unitPlanId) return;
		const candidate = allUnits.find((unit) => unit.id === unitPlanId);
		if (!candidate) return;

		let replace = false;
		if (hasUnitPlan) {
			if (
				!confirm(
					`Replace "${slotTitle}" with "${candidate.unitTitle}"? The current unit will move to standalone.`
				)
			) {
				return;
			}
			replace = true;
		}

		boardError = '';
		boardBusy = `${entry.id}:${unitIndex}`;
		try {
			const res = await fetch(`/api/level-plan/${entry.id}/units/${unitIndex}/attach`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ unitPlanId, replace })
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.message || 'Attach failed');
			await refreshBoard();
		} catch (e) {
			boardError = e instanceof Error ? e.message : 'Attach failed';
		} finally {
			boardBusy = '';
		}
	}

	async function removeEmptyColumn(entry: FacultyOverviewEntry, unitIndex: number, title: string) {
		if (entry.units.length <= 1) {
			alert('At least one unit column is required.');
			return;
		}
		if (!confirm(`Remove empty column "${title}" from ${entry.bandSubjectTitle}?`)) return;

		boardError = '';
		boardBusy = `${entry.id}:${unitIndex}`;
		try {
			const res = await fetch(`/api/level-plan/${entry.id}/units/${unitIndex}/remove`, {
				method: 'POST'
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.message || 'Remove column failed');
			await refreshBoard();
		} catch (e) {
			boardError = e instanceof Error ? e.message : 'Remove column failed';
		} finally {
			boardBusy = '';
		}
	}

	async function moveUnit(entry: FacultyOverviewEntry, fromIndex: number, toIndex: number) {
		if (fromIndex === toIndex) return;

		boardError = '';
		boardBusy = `${entry.id}:${fromIndex}`;
		try {
			const res = await fetch(`/api/level-plan/${entry.id}/units/${fromIndex}/reorder`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ toIndex })
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.message || 'Reorder failed');
			await refreshBoard();
		} catch (e) {
			boardError = e instanceof Error ? e.message : 'Reorder failed';
		} finally {
			boardBusy = '';
		}
	}

	async function cloneUnit(entry: FacultyOverviewEntry, unitIndex: number, title: string) {
		if (
			!confirm(
				`Clone "${title}" in ${entry.bandSubjectTitle}? A copy will be inserted after this unit.`
			)
		) {
			return;
		}

		boardError = '';
		boardBusy = `${entry.id}:${unitIndex}`;
		try {
			const res = await fetch(`/api/level-plan/${entry.id}/units/${unitIndex}/clone`, {
				method: 'POST'
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.message || 'Clone failed');
			await refreshBoard();
		} catch (e) {
			boardError = e instanceof Error ? e.message : 'Clone failed';
		} finally {
			boardBusy = '';
		}
	}
</script>

<h1>Faculty Overview</h1>

<div class="card">
	<h2>Add level plan</h2>
	<div class="form-row">
		<label>
			Learning area / subject
			<input bind:value={learningAreaSubject} placeholder="Digital Technologies" />
		</label>
		<label>
			Year level / band
			<input bind:value={yearLevelBand} placeholder="9-10" />
		</label>
		<button class="btn btn-primary" onclick={addRow} disabled={saving}>Add</button>
	</div>
	{#if error}<p class="error">{error}</p>{/if}
</div>

{#each entries as entry (entry.id)}
	<div class="card level-plan-group">
		<div class="level-plan-header">
			<div>
				<h2 class="level-plan-title">{entry.bandSubjectTitle}</h2>
				<p class="meta">
					{#if entry.levelPlanStatus}
						{entry.levelPlanStatus}
						·
					{/if}
					Updated {formatDate(entry.dateLastModified)}
				</p>
			</div>
			<div class="level-plan-actions">
				<a class="btn btn-sm" href="/level-plan/{entry.id}">Open level plan</a>
				<button class="btn btn-sm" onclick={() => deleteRow(entry.id)}>Delete</button>
			</div>
		</div>

		{#if entry.units.length}
			<table class="data-table unit-nested-table">
				<thead>
					<tr>
						<th>Unit</th>
						<th>Title</th>
						<th>Year</th>
						<th>Duration</th>
						<th>Status</th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					{#each entry.units as unit (unit.levelUnitId)}
						{@const attachable = compatibleStandaloneUnits(entry)}
						{@const slotBusy = boardBusy === `${entry.id}:${unit.slotIndex}`}
						<tr class:unit-missing={!unit.hasUnitPlan}>
							<td>{unit.unitNumber !== '' ? `Unit ${unit.unitNumber}` : `Unit ${unit.slotIndex + 1}`}</td>
							<td>{unit.title}</td>
							<td>{unit.yearLevel !== '' ? unit.yearLevel : '—'}</td>
							<td>{unit.duration || '—'}</td>
							<td>{unit.status}</td>
							<td class="unit-slot-actions">
								<span class="unit-order-actions">
									<button
										class="btn btn-sm"
										title="Move up"
										disabled={slotBusy || unit.slotIndex === 0}
										onclick={() => moveUnit(entry, unit.slotIndex, unit.slotIndex - 1)}
									>↑</button>
									<button
										class="btn btn-sm"
										title="Move down"
										disabled={slotBusy || unit.slotIndex === entry.units.length - 1}
										onclick={() => moveUnit(entry, unit.slotIndex, unit.slotIndex + 1)}
									>↓</button>
									<button
										class="btn btn-sm"
										disabled={slotBusy}
										onclick={() => cloneUnit(entry, unit.slotIndex, unit.title)}
									>Clone</button>
								</span>
								{#if unit.hasUnitPlan && unit.unitPlanId}
									<a
										class="btn btn-sm btn-primary"
										href="/level-plan/{entry.id}/unit/{unit.unitPlanId}">Open</a
									>
									<button
										class="btn btn-sm"
										disabled={slotBusy}
										onclick={() => detachUnit(entry, unit.slotIndex, unit.title)}
									>
										{slotBusy ? '…' : 'Detach'}
									</button>
								{:else}
									<a class="btn btn-sm" href="/level-plan/{entry.id}">Create in level plan</a>
									{#if entry.units.length > 1}
										<button
											class="btn btn-sm"
											disabled={slotBusy}
											onclick={() => removeEmptyColumn(entry, unit.slotIndex, unit.title)}
										>
											{slotBusy ? '…' : 'Remove column'}
										</button>
									{/if}
								{/if}
								{#if attachable.length}
									<select
										class="attach-select"
										disabled={slotBusy}
										onchange={(event) => {
											const select = event.currentTarget as HTMLSelectElement;
											const unitPlanId = select.value;
											select.value = '';
											if (unitPlanId) {
												attachUnit(entry, unit.slotIndex, unitPlanId, unit.title, unit.hasUnitPlan);
											}
										}}
									>
										<option value="">
											{unit.hasUnitPlan ? 'Replace with…' : 'Attach standalone…'}
										</option>
										{#each attachable as candidate (candidate.id)}
											<option value={candidate.id}>
												{candidate.unitTitle} · {candidate.curriculumLabel}
											</option>
										{/each}
									</select>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
			{#if compatibleStandaloneUnits(entry).length === 0}
				<p class="meta unit-empty">
					No compatible standalone units for {entry.bandSubjectTitle}. Create one with matching
					subject and year band below.
				</p>
			{/if}
		{:else}
			<p class="meta unit-empty">No units defined yet — open the level plan to add units.</p>
		{/if}
	</div>
{:else}
	<div class="card">
		<p class="meta">No level plans yet. Add one above.</p>
	</div>
{/each}
{#if boardError}<p class="error">{boardError}</p>{/if}

<section class="all-units-section">
	<h2>Standalone unit pool</h2>
	<p class="meta section-intro">
		Units sorted by subject and year band. Only matching units can be attached to a level plan.
	</p>
	<div class="card">
		<div class="form-row">
			<label>
				Title (optional)
				<input bind:value={standaloneTitle} placeholder="Untitled unit" />
			</label>
			<button
				class="btn btn-primary"
				onclick={createStandaloneUnit}
				disabled={creatingStandalone}
			>
				{creatingStandalone ? 'Creating…' : 'Create standalone unit'}
			</button>
		</div>
		{#if standaloneError}<p class="error">{standaloneError}</p>{/if}

		{#if standaloneGroups().length}
			{#each standaloneGroups() as [curriculumLabel, units] (curriculumLabel)}
				<h3 class="curriculum-group-title">{curriculumLabel}</h3>
				<table class="data-table curriculum-unit-table">
					<thead>
						<tr>
							<th>Title</th>
							<th>Subject</th>
							<th>Year</th>
							<th>Status</th>
							<th></th>
						</tr>
					</thead>
					<tbody>
						{#each units as unit (unit.id)}
							<tr>
								<td>{unit.unitTitle}</td>
								<td>{unit.subject || '—'}</td>
								<td>{unit.yearLevel !== '' ? unit.yearLevel : '—'}</td>
								<td>{unit.status || '—'}</td>
								<td class="unit-actions">
									<a
										class="btn btn-sm btn-primary"
										href="/level-plan/{unit.levelPlanId}/unit/{unit.id}">Open</a
									>
									<a
										class="btn btn-sm"
										href="/api/export/unit-plan/{unit.levelPlanId}/{unit.id}"
										target="_blank">Export</a
									>
									<button class="btn btn-sm" onclick={() => deleteStandaloneUnit(unit)}
										>Delete</button
									>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/each}
		{:else}
			<p class="meta">No standalone units in the pool yet.</p>
		{/if}

		{#if allUnits.some((unit) => !unit.isStandalone)}
			<h3 class="curriculum-group-title attached-units-title">Attached to level plans</h3>
			<table class="data-table">
				<thead>
					<tr>
						<th>Title</th>
						<th>Level plan</th>
						<th>Unit #</th>
						<th>Curriculum</th>
						<th>Status</th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					{#each allUnits.filter((u) => !u.isStandalone) as unit (unit.id)}
						<tr>
							<td>{unit.unitTitle}</td>
							<td>
								<a href="/level-plan/{unit.levelPlanId}">{unit.levelPlanLabel}</a>
							</td>
							<td>{unit.unitNumber !== '' ? unit.unitNumber : '—'}</td>
							<td>{unit.curriculumLabel}</td>
							<td>{unit.status || '—'}</td>
							<td class="unit-actions">
								<a
									class="btn btn-sm btn-primary"
									href="/level-plan/{unit.levelPlanId}/unit/{unit.id}">Open</a
								>
								<a
									class="btn btn-sm"
									href="/api/export/unit-plan/{unit.levelPlanId}/{unit.id}"
									target="_blank">Export</a
								>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</div>
</section>
