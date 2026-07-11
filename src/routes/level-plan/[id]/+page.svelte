<script lang="ts">
	import type { PageData } from './$types';
	import FieldEditor from '$lib/components/FieldEditor.svelte';
	import SelectFieldEditor from '$lib/components/SelectFieldEditor.svelte';
	import {
		ASSESSMENT_MODES,
		ASSESSMENT_TECHNIQUES,
		PLAN_STATUSES,
		createId
	} from '$lib/defaults';
	import type { LevelPlan, LevelPlanUnit } from '$lib/types';
	import EditorAiToggle from '$lib/components/EditorAiToggle.svelte';
	import CapabilityUnitMatrix from '$lib/components/CapabilityUnitMatrix.svelte';
	import { syncCapabilityRowColumns, unitPlanForLevelIndex } from '$lib/general-capabilities';
	import { seedUnitPlanFromLevelPlan, syncUnitPlansIntoLevelPlan } from '$lib/plan-sync';
	import FloatingSaveButton from '$lib/components/FloatingSaveButton.svelte';
	import { isDirtySnapshot, snapshotValue } from '$lib/dirty';

	let { data }: { data: PageData } = $props();
	let plan = $state<LevelPlan>(structuredClone(data.plan));
	let unitPlans = $state([...data.unitPlans]);
	syncUnitPlansIntoLevelPlan(plan, unitPlans);
	for (const row of plan.generalCapabilities) {
		syncCapabilityRowColumns(row, plan.units.length);
	}
	let section = $state<'overview' | 'units' | 'content' | 'capabilities'>('overview');
	let saving = $state(false);
	let saved = $state(false);
	let savedSnapshot = $state(snapshotValue(structuredClone(data.plan)));
	const dirty = $derived(isDirtySnapshot(plan, savedSnapshot));
	let showAiPanels = $state(true);
	let importing = $state(false);
	let importError = $state('');
	let importInput: HTMLInputElement | undefined = $state();

	async function importWord(file: File) {
		importing = true;
		importError = '';
		try {
			const form = new FormData();
			form.append('file', file);
			const res = await fetch(`/api/import/level-plan/${plan.id}`, {
				method: 'POST',
				body: form
			});
			const body = await res.json().catch(() => ({}));
			if (!res.ok) {
				throw new Error(body.message || 'Import failed');
			}
			if (body.redirectTo) {
				window.location.href = body.redirectTo;
				return;
			}
		} catch (e) {
			importError = e instanceof Error ? e.message : 'Import failed';
		} finally {
			importing = false;
			if (importInput) importInput.value = '';
		}
	}

	function onImportSelected(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		if (
			!confirm(
				'Import as a new level plan copy? Your current plan will not be changed, and you will be taken to the imported copy.'
			)
		) {
			input.value = '';
			return;
		}
		void importWord(file);
	}

	async function save() {
		saving = true;
		saved = false;
		const res = await fetch(`/api/level-plan/${plan.id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(plan)
		});
		if (res.ok) {
			saved = true;
			savedSnapshot = snapshotValue(plan);
		}
		saving = false;
	}

	function addUnit() {
		plan.units = [
			...plan.units,
			{
				id: createId('unit'),
				unitTitle: { value: `Unit ${plan.units.length + 1}`, aiNotes: '' },
				yearLevel: { value: '', aiNotes: '' },
				duration: { value: '', aiNotes: '' },
				description: { value: '', aiNotes: '' },
				assessments: []
			}
		];
		syncMatrixColumns();
	}

	function addAssessment(unit: LevelPlanUnit) {
		unit.assessments = [
			...unit.assessments,
			{
				id: createId('assess'),
				assessmentNumber: { value: unit.assessments.length + 1, aiNotes: '' },
				title: { value: '', aiNotes: '' },
				term: { value: '', aiNotes: '' },
				week: { value: '', aiNotes: '' },
				description: { value: '', aiNotes: '' },
				technique: { value: '', aiNotes: '' },
				mode: { value: '', aiNotes: '' },
				conditions: { value: '', aiNotes: '' },
				achievementStandard: { value: '', aiNotes: '' },
				moderation: { value: '', aiNotes: '' }
			}
		];
	}

	function removeAssessment(unit: LevelPlanUnit, index: number) {
		if (!confirm('Remove this assessment?')) return;
		unit.assessments = unit.assessments.filter((_, i) => i !== index);
	}

	async function detachUnit(index: number) {
		const label = plan.units[index].unitTitle.value || `Unit ${index + 1}`;
		if (
			!confirm(
				`Detach "${label}"? The unit plan will move to standalone and can be re-attached from the overview page.`
			)
		) {
			return;
		}

		saving = true;
		saved = false;
		const res = await fetch(`/api/level-plan/${plan.id}/units/${index}/detach`, {
			method: 'POST'
		});
		const data = await res.json();
		if (!res.ok) {
			alert(data.message || 'Failed to detach unit.');
			saving = false;
			return;
		}

		plan.units = data.levelPlan.units;
		await refreshUnitPlans();
		saved = true;
		saving = false;
	}

	async function removeEmptyColumn(index: number) {
		if (plan.units.length <= 1) {
			alert('At least one unit column is required.');
			return;
		}
		if (unitPlanForIndex(index)) {
			alert('Detach the unit plan before removing this column.');
			return;
		}
		const label = plan.units[index].unitTitle.value || `Unit ${index + 1}`;
		if (!confirm(`Remove empty column "${label}"? This cannot be undone.`)) return;

		saving = true;
		saved = false;
		const res = await fetch(`/api/level-plan/${plan.id}/units/${index}/remove`, {
			method: 'POST'
		});
		const data = await res.json();
		if (!res.ok) {
			alert(data.message || 'Failed to remove column.');
			saving = false;
			return;
		}

		plan.units = data.levelPlan.units;
		syncMatrixColumns();
		await refreshUnitPlans();
		saved = true;
		saving = false;
	}

	function strandRowSpan(index: number): number {
		const rows = plan.contentDescriptions;
		const strand = rows[index]?.strand.value ?? '';
		if (index > 0 && rows[index - 1].strand.value === strand) return 0;
		let span = 1;
		while (index + span < rows.length && rows[index + span].strand.value === strand) span++;
		return span;
	}

	function syncMatrixColumns() {
		const count = plan.units.length;
		for (const row of plan.contentDescriptions) {
			while (row.unitInclusions.length < count) row.unitInclusions.push(false);
			row.unitInclusions = row.unitInclusions.slice(0, count);
		}
		for (const row of plan.generalCapabilities) {
			syncCapabilityRowColumns(row, count);
		}
		for (const row of plan.crossCurriculumPriorities) {
			while (row.unitInclusions.length < count) row.unitInclusions.push(false);
			row.unitInclusions = row.unitInclusions.slice(0, count);
		}
	}

	function unitPlanForIndex(index: number) {
		return unitPlanForLevelIndex(plan.units[index], index, unitPlans);
	}

	async function refreshUnitPlans() {
		const res = await fetch(`/api/unit-plan/${plan.id}`);
		if (res.ok) {
			unitPlans = await res.json();
			syncUnitPlansIntoLevelPlan(plan, unitPlans);
		}
	}

	async function moveUnit(fromIndex: number, toIndex: number) {
		if (fromIndex === toIndex) return;

		saving = true;
		saved = false;
		const res = await fetch(`/api/level-plan/${plan.id}/units/${fromIndex}/reorder`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ toIndex })
		});
		const data = await res.json();
		if (!res.ok) {
			alert(data.message || 'Failed to reorder unit.');
			saving = false;
			return;
		}

		plan.units = data.levelPlan.units;
		unitPlans = data.unitPlans;
		syncUnitPlansIntoLevelPlan(plan, unitPlans);
		syncMatrixColumns();
		saved = true;
		saving = false;
	}

	async function cloneUnit(index: number) {
		const label = plan.units[index].unitTitle.value || `Unit ${index + 1}`;
		if (
			!confirm(
				`Clone "${label}"? A copy will be inserted after this unit. The original is unchanged.`
			)
		) {
			return;
		}

		saving = true;
		saved = false;
		const res = await fetch(`/api/level-plan/${plan.id}/units/${index}/clone`, {
			method: 'POST'
		});
		const data = await res.json();
		if (!res.ok) {
			alert(data.message || 'Failed to clone unit.');
			saving = false;
			return;
		}

		plan.units = data.levelPlan.units;
		unitPlans = data.unitPlans;
		syncUnitPlansIntoLevelPlan(plan, unitPlans);
		syncMatrixColumns();
		saved = true;
		saving = false;
	}

	async function createUnitPlan(_unit: LevelPlanUnit, index: number) {
		await refreshUnitPlans();
		if (unitPlanForIndex(index)) {
			alert('A unit plan already exists for this unit. Delete it first or refresh the page.');
			return;
		}

		const res = await fetch(`/api/unit-plan/${plan.id}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ unitNumber: index + 1 })
		});
		if (!res.ok) {
			if (res.status === 409) await refreshUnitPlans();
			alert(
				res.status === 409
					? 'A unit plan already exists for this unit. Delete it first or refresh the page.'
					: 'Failed to create unit plan.'
			);
			return;
		}

		const created = await res.json();
		seedUnitPlanFromLevelPlan(plan, created, index);

		const putRes = await fetch(`/api/unit-plan/${plan.id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(created)
		});
		if (!putRes.ok) {
			await fetch(`/api/unit-plan/${plan.id}?unitId=${created.id}&internal=1`, { method: 'DELETE' });
			alert('Failed to save unit plan details.');
			return;
		}

		unitPlans = [...unitPlans, await putRes.json()];
	}
</script>

<div class="toolbar">
	<a class="btn" href="/">← Overview</a>
	<h1 style="margin:0;flex:1">{plan.bandSubjectTitle.value || 'Level plan'}</h1>
	<a class="btn" href="/api/export/level-plan/{plan.id}" target="_blank">Export Word</a>
	<input
		bind:this={importInput}
		type="file"
		accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
		hidden
		onchange={onImportSelected}
	/>
	<button class="btn" onclick={() => importInput?.click()} disabled={importing}>
		{importing ? 'Importing…' : 'Import Word'}
	</button>
	<EditorAiToggle bind:showAi={showAiPanels} />
	<button class="btn btn-primary" onclick={save} disabled={saving}>
		{saving ? 'Saving…' : 'Save'}
	</button>
	{#if saved}<span class="meta">Saved</span>{/if}
	{#if importError}<span class="meta" style="color:var(--danger,#c00)">{importError}</span>{/if}
</div>

<div class="section-nav">
	<button class:active={section === 'overview'} onclick={() => (section = 'overview')}>Overview</button>
	<button class:active={section === 'units'} onclick={() => (section = 'units')}>Units & assessments</button>
	<button class:active={section === 'content'} onclick={() => (section = 'content')}>Content descriptions</button>
	<button class:active={section === 'capabilities'} onclick={() => (section = 'capabilities')}>Capabilities</button>
</div>

<div class="doc-editor" class:hide-ai-panels={!showAiPanels}>
{#if section === 'overview'}
	<div class="card">
		<FieldEditor label="Band / subject title" bind:field={plan.bandSubjectTitle} docType="level-plan" docId={plan.id} fieldPath="bandSubjectTitle" />
		<FieldEditor label="School" bind:field={plan.school} docType="level-plan" docId={plan.id} fieldPath="school" multiline={false} />
		<div class="grid-2">
			<FieldEditor label="Year" bind:field={plan.year} docType="level-plan" docId={plan.id} fieldPath="year" multiline={false} />
			<SelectFieldEditor label="Status" bind:field={plan.status} options={PLAN_STATUSES} docType="level-plan" docId={plan.id} fieldPath="status" />
		</div>
		<FieldEditor label="Level description" bind:field={plan.levelDescription} docType="level-plan" docId={plan.id} fieldPath="levelDescription" rows={6} />
		<FieldEditor label="Context and cohort considerations" bind:field={plan.contextAndCohortConsiderations} docType="level-plan" docId={plan.id} fieldPath="contextAndCohortConsiderations" rows={6} />
	</div>
{/if}

{#if section === 'units'}
	<div class="toolbar">
		<button class="btn" onclick={addUnit}>Add unit</button>
	</div>
	{#each plan.units as unit, ui (unit.id)}
		<div class="card">
			<div class="toolbar">
				<h2 style="margin:0;flex:1">{unit.unitTitle.value || `Unit ${ui + 1}`}</h2>
				<div class="unit-order-actions">
					<button
						class="btn btn-sm"
						title="Move up"
						disabled={saving || ui === 0}
						onclick={() => moveUnit(ui, ui - 1)}
					>↑</button>
					<button
						class="btn btn-sm"
						title="Move down"
						disabled={saving || ui === plan.units.length - 1}
						onclick={() => moveUnit(ui, ui + 1)}
					>↓</button>
					<button
						class="btn btn-sm"
						disabled={saving}
						onclick={() => cloneUnit(ui)}
					>Clone</button>
				</div>
				{#if unitPlanForIndex(ui)}
					<button class="btn btn-sm" onclick={() => detachUnit(ui)}>Detach unit</button>
				{:else if plan.units.length > 1}
					<button class="btn btn-sm" onclick={() => removeEmptyColumn(ui)}>Remove column</button>
				{/if}
			</div>
			<div class="toolbar">
				{#if !unitPlanForIndex(ui)}
					<a class="btn btn-sm btn-primary" href="/unit-wizard?levelPlanId={plan.id}&unitIndex={ui}">Plan with AI</a>
					<button class="btn btn-sm" onclick={() => createUnitPlan(unit, ui)}>Create unit plan</button>
				{:else}
					<a class="btn btn-sm" href="/level-plan/{plan.id}/unit/{unitPlanForIndex(ui)?.id}">Open unit plan</a>
				{/if}
			</div>
			<FieldEditor label="Unit title" bind:field={unit.unitTitle} docType="level-plan" docId={plan.id} fieldPath="units.{ui}.unitTitle" />
			<div class="grid-2">
				<FieldEditor label="Year level" bind:field={unit.yearLevel} docType="level-plan" docId={plan.id} fieldPath="units.{ui}.yearLevel" multiline={false} />
				<FieldEditor label="Duration" bind:field={unit.duration} docType="level-plan" docId={plan.id} fieldPath="units.{ui}.duration" multiline={false} />
			</div>
			<FieldEditor label="Description" bind:field={unit.description} docType="level-plan" docId={plan.id} fieldPath="units.{ui}.description" rows={5} />

			<div class="toolbar">
				<button class="btn btn-sm" onclick={() => addAssessment(unit)}>Add assessment</button>
			</div>

			{#each unit.assessments as assess, ai (assess.id)}
				<div class="card" style="background:#f8fafc">
					<div class="toolbar">
						<h3 style="margin:0;flex:1">Assessment {assess.assessmentNumber.value || ai + 1}</h3>
						<button class="btn btn-sm" onclick={() => removeAssessment(unit, ai)}>Remove</button>
					</div>
					<div class="grid-2">
						<FieldEditor label="Title" bind:field={assess.title} docType="level-plan" docId={plan.id} fieldPath="units.{ui}.assessments.{ai}.title" multiline={false} />
						<FieldEditor label="Assessment number" bind:field={assess.assessmentNumber} docType="level-plan" docId={plan.id} fieldPath="units.{ui}.assessments.{ai}.number" multiline={false} />
					</div>
					<div class="grid-2">
						<FieldEditor label="Term" bind:field={assess.term} docType="level-plan" docId={plan.id} fieldPath="units.{ui}.assessments.{ai}.term" multiline={false} />
						<FieldEditor label="Week" bind:field={assess.week} docType="level-plan" docId={plan.id} fieldPath="units.{ui}.assessments.{ai}.week" multiline={false} />
					</div>
					<FieldEditor label="Description" bind:field={assess.description} docType="level-plan" docId={plan.id} fieldPath="units.{ui}.assessments.{ai}.description" />
					<div class="grid-2">
						<SelectFieldEditor label="Technique" bind:field={assess.technique} options={ASSESSMENT_TECHNIQUES} docType="level-plan" docId={plan.id} fieldPath="units.{ui}.assessments.{ai}.technique" />
						<SelectFieldEditor label="Mode" bind:field={assess.mode} options={ASSESSMENT_MODES} docType="level-plan" docId={plan.id} fieldPath="units.{ui}.assessments.{ai}.mode" />
					</div>
					<FieldEditor label="Conditions" bind:field={assess.conditions} docType="level-plan" docId={plan.id} fieldPath="units.{ui}.assessments.{ai}.conditions" />
					<FieldEditor label="Achievement standard" bind:field={assess.achievementStandard} docType="level-plan" docId={plan.id} fieldPath="units.{ui}.assessments.{ai}.achievementStandard" rows={5} />
					<FieldEditor label="Moderation" bind:field={assess.moderation} docType="level-plan" docId={plan.id} fieldPath="units.{ui}.assessments.{ai}.moderation" />
				</div>
			{/each}
		</div>
	{/each}
{/if}

{#if section === 'content'}
	<div class="card">
		<p class="meta" style="margin:0">
			For units with an attached unit plan, each checkbox shows whether any assessment in that
			unit includes the descriptor. Edit descriptors per assessment on the unit plan.
		</p>
	</div>
	<div class="card checkbox-matrix content-descriptions-matrix">
		<table class="data-table">
			<thead>
				<tr>
					<th>Strand</th>
					<th>Sub-strand</th>
					<th>Text</th>
					<th>Code</th>
					{#each plan.units as unit}<th class="unit-col">{unit.unitTitle.value}</th>{/each}
				</tr>
			</thead>
			<tbody>
				{#each plan.contentDescriptions as row, ri (row.id)}
					{@const strandSpan = strandRowSpan(ri)}
					<tr>
						{#if strandSpan > 0}
							<td class="content-strand-cell" rowspan={strandSpan}>{row.strand.value}</td>
						{/if}
						<td class="content-substrand-cell">{row.subStrand.value}</td>
						<td class="content-text-cell">{row.text.value}</td>
						<td class="content-code-cell">{row.code.value}</td>
						{#each row.unitInclusions as _, ci}
							{@const linkedUnitPlan = unitPlanForIndex(ci)}
							<td class="unit-check-cell">
								{#if linkedUnitPlan}
									<input
										type="checkbox"
										checked={row.unitInclusions[ci]}
										disabled
										aria-label="{row.code.value} — {plan.units[ci]?.unitTitle.value || `Unit ${ci + 1}`} (from assessments)"
									/>
								{:else}
									<input
										type="checkbox"
										aria-label="{row.code.value} — {plan.units[ci]?.unitTitle.value || `Unit ${ci + 1}`}"
										bind:checked={row.unitInclusions[ci]}
									/>
								{/if}
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

{#if section === 'capabilities'}
	<div class="card">
		<h2>General capabilities</h2>
		<p class="meta">
			Tick elements and sub-elements included in each unit. Categories match the Australian
			Curriculum v9 general capabilities.
		</p>
	</div>
	{#each plan.generalCapabilities as row (row.id)}
		<div class="card checkbox-matrix">
			<h2 style="margin-top:0">{row.name.value}</h2>
			<CapabilityUnitMatrix
				{row}
				unitLabels={plan.units.map((unit, i) => unit.unitTitle.value || `Unit ${i + 1}`)}
			/>
		</div>
	{/each}
	<div class="card checkbox-matrix">
		<h2>Cross-curriculum priorities</h2>
		<table class="data-table">
			<thead>
				<tr>
					<th>Priority</th>
					{#each plan.units as unit}<th>{unit.unitTitle.value}</th>{/each}
				</tr>
			</thead>
			<tbody>
				{#each plan.crossCurriculumPriorities as row}
					<tr>
						<td>{row.name.value}</td>
						{#each row.unitInclusions as inc, ci}
							<td><input type="checkbox" bind:checked={row.unitInclusions[ci]} /></td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
</div>

<FloatingSaveButton {dirty} {saving} {saved} onclick={save} />
