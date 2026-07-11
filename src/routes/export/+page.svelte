<script lang="ts">
	import type { PageData } from './$types';
	import type { AssessmentItemSummary, FacultyOverviewEntry, UnitPlanSummary } from '$lib/types';

	let { data }: { data: PageData } = $props();

	let bundling = $state(false);
	let bundleError = $state('');
	let levelBundleBusy = $state('');
	let levelBundleError = $state('');
	let levelBundleErrorId = $state('');
	let unitBundleBusy = $state('');
	let unitBundleError = $state('');
	let unitBundleErrorId = $state('');

	function unitsForLevel(entry: FacultyOverviewEntry): UnitPlanSummary[] {
		return data.allUnits
			.filter((unit) => unit.levelPlanId === entry.id && !unit.isStandalone)
			.sort((a, b) => {
				const an = typeof a.unitNumber === 'number' ? a.unitNumber : 999;
				const bn = typeof b.unitNumber === 'number' ? b.unitNumber : 999;
				return an - bn || a.unitTitle.localeCompare(b.unitTitle);
			});
	}

	function assessmentsForUnit(unitId: string): AssessmentItemSummary[] {
		return data.allAssessments
			.filter((item) => item.unitPlanId === unitId)
			.sort((a, b) => {
				const an = typeof a.assessmentNumber === 'number' ? a.assessmentNumber : 999;
				const bn = typeof b.assessmentNumber === 'number' ? b.assessmentNumber : 999;
				return an - bn || a.title.localeCompare(b.title);
			});
	}

	function assessmentsForLevel(entry: FacultyOverviewEntry): AssessmentItemSummary[] {
		const unitIds = new Set(unitsForLevel(entry).map((u) => u.id));
		return data.allAssessments
			.filter(
				(item) =>
					item.levelPlanId === entry.id ||
					(item.unitPlanId && unitIds.has(item.unitPlanId))
			)
			.filter((item) => !item.isStandalone)
			.sort((a, b) => a.title.localeCompare(b.title));
	}

	async function downloadZip(url: string, fallbackName: string) {
		const res = await fetch(url);
		if (!res.ok) {
			const body = await res.json().catch(() => ({}));
			throw new Error(body.message || 'Export failed');
		}
		const blob = await res.blob();
		const disposition = res.headers.get('Content-Disposition') || '';
		const match = disposition.match(/filename="([^"]+)"/);
		const filename = match?.[1] || fallbackName;
		const objectUrl = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = objectUrl;
		a.download = filename;
		a.click();
		URL.revokeObjectURL(objectUrl);
	}

	async function downloadBundle() {
		bundling = true;
		bundleError = '';
		try {
			await downloadZip('/api/export/faculty-bundle', 'faculty-plans.zip');
		} catch (e) {
			bundleError = e instanceof Error ? e.message : 'Bundle export failed';
		} finally {
			bundling = false;
		}
	}

	async function downloadLevelBundle(levelPlanId: string) {
		levelBundleBusy = levelPlanId;
		levelBundleError = '';
		levelBundleErrorId = '';
		try {
			await downloadZip(
				`/api/export/level-plan-bundle/${levelPlanId}`,
				`${levelPlanId}-bundle.zip`
			);
		} catch (e) {
			levelBundleError = e instanceof Error ? e.message : 'Level plan bundle failed';
			levelBundleErrorId = levelPlanId;
		} finally {
			levelBundleBusy = '';
		}
	}

	async function downloadUnitBundle(levelPlanId: string, unitId: string) {
		unitBundleBusy = unitId;
		unitBundleError = '';
		unitBundleErrorId = '';
		try {
			await downloadZip(
				`/api/export/unit-plan-bundle/${levelPlanId}/${unitId}`,
				`${unitId}-bundle.zip`
			);
		} catch (e) {
			unitBundleError = e instanceof Error ? e.message : 'Unit plan bundle failed';
			unitBundleErrorId = unitId;
		} finally {
			unitBundleBusy = '';
		}
	}
</script>

<h1>Export</h1>

<div class="card">
	<h2>Download everything</h2>
	<p class="meta section-intro">
		One ZIP with each level plan folder. Every unit gets its own subfolder containing the unit
		Word file, all linked assessment items, and both learning guides (summary + detailed).
		Learning guides use AI, so a full download can take a few minutes.
	</p>
	<button class="btn btn-primary" onclick={downloadBundle} disabled={bundling}>
		{bundling ? 'Building ZIP (includes AI learning guides)…' : 'Download all level plans as ZIP'}
	</button>
	{#if bundleError}<p class="error">{bundleError}</p>{/if}
</div>

{#each data.overview as entry (entry.id)}
	{@const units = unitsForLevel(entry)}
	{@const levelAssessments = assessmentsForLevel(entry)}
	<div class="card level-plan-group">
		<div class="level-plan-header">
			<div>
				<h2 class="level-plan-title">{entry.bandSubjectTitle}</h2>
				<p class="meta">
					{units.length} unit{units.length === 1 ? '' : 's'}
					·
					{levelAssessments.length} assessment{levelAssessments.length === 1 ? '' : 's'}
				</p>
			</div>
			<div class="level-plan-actions">
				<a class="btn btn-sm btn-primary" href="/api/export/level-plan/{entry.id}" target="_blank"
					>Export level plan</a
				>
				<button
					class="btn btn-sm"
					disabled={levelBundleBusy === entry.id}
					onclick={() => downloadLevelBundle(entry.id)}
				>
					{levelBundleBusy === entry.id
						? 'Building ZIP…'
						: 'Export with units & assessments'}
				</button>
			</div>
		</div>
		{#if levelBundleErrorId === entry.id && levelBundleError}
			<p class="error">{levelBundleError}</p>
		{/if}

		{#if units.length}
			<table class="data-table unit-nested-table">
				<thead>
					<tr>
						<th>Unit</th>
						<th>Title</th>
						<th>Status</th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					{#each units as unit (unit.id)}
						{@const assessments = assessmentsForUnit(unit.id)}
						<tr>
							<td>{unit.unitNumber !== '' ? `Unit ${unit.unitNumber}` : '—'}</td>
							<td>
								{unit.unitTitle}
								{#if assessments.length}
									<span class="meta">
										· {assessments.length} assessment{assessments.length === 1 ? '' : 's'}
									</span>
								{/if}
							</td>
							<td>{unit.status || '—'}</td>
							<td class="unit-actions">
								<a
									class="btn btn-sm"
									href="/api/export/unit-plan/{unit.levelPlanId}/{unit.id}"
									target="_blank">Export unit</a
								>
								<button
									class="btn btn-sm"
									disabled={unitBundleBusy === unit.id}
									onclick={() => downloadUnitBundle(unit.levelPlanId, unit.id)}
								>
									{unitBundleBusy === unit.id
										? 'Building ZIP…'
										: assessments.length
											? `Export with ${assessments.length} assessment${assessments.length === 1 ? '' : 's'}`
											: 'Export with assessments'}
								</button>
								<a
									class="btn btn-sm"
									href="/api/export/learning-guide/{unit.levelPlanId}/{unit.id}"
									target="_blank">Learning guide</a
								>
								<a
									class="btn btn-sm"
									href="/api/export/learning-guide/{unit.levelPlanId}/{unit.id}?detail=detailed"
									target="_blank">Detailed guide</a
								>
							</td>
						</tr>
						{#if unitBundleErrorId === unit.id && unitBundleError}
							<tr>
								<td colspan="4"><p class="error">{unitBundleError}</p></td>
							</tr>
						{/if}
						{#each assessments as item (item.id)}
							<tr class="export-assessment-row">
								<td></td>
								<td colspan="2">
									<span class="meta">
										Assessment{item.assessmentNumber !== ''
											? ` ${item.assessmentNumber}`
											: ''} ·
									</span>{item.title}
									{#if item.technique}
										<span class="meta"> · {item.technique}</span>
									{/if}
								</td>
								<td class="unit-actions">
									<a
										class="btn btn-sm"
										href="/api/export/assessment-item/{item.id}"
										target="_blank">Export assessment</a
									>
								</td>
							</tr>
						{/each}
					{/each}
				</tbody>
			</table>
		{:else}
			<p class="meta unit-empty">No unit plans attached yet.</p>
		{/if}

		{#if entry.units.some((u) => !u.hasUnitPlan)}
			<p class="meta unit-empty">
				{entry.units.filter((u) => !u.hasUnitPlan).length} level-plan slot{entry.units.filter(
					(u) => !u.hasUnitPlan
				).length === 1
					? ''
					: 's'} still missing a unit plan file — those are skipped in the ZIP.
			</p>
		{/if}
	</div>
{:else}
	<div class="card">
		<p class="meta">No level plans to export yet.</p>
	</div>
{/each}

<style>
	.export-assessment-row td {
		background: #eef1f5;
	}
</style>
