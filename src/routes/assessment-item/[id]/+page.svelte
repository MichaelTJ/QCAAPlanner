<script lang="ts">
	import type { PageData } from './$types';
	import FieldEditor from '$lib/components/FieldEditor.svelte';
	import SelectFieldEditor from '$lib/components/SelectFieldEditor.svelte';
	import {
		ASSESSMENT_INDIVIDUAL_OR_GROUP,
		ASSESSMENT_MODES,
		ASSESSMENT_TECHNIQUES,
		STANDALONE_UNIT_PLAN_ID
	} from '$lib/defaults';
	import {
		selectedContentDescriptionCodes,
		toggleContentDescription,
		toggleCriteriaRow
	} from '$lib/assessment/digitech-instruments';
	import type { AssessmentItem } from '$lib/types';
	import EditorAiToggle from '$lib/components/EditorAiToggle.svelte';
	import FloatingSaveButton from '$lib/components/FloatingSaveButton.svelte';
	import { isDirtySnapshot, snapshotValue } from '$lib/dirty';
	import { fitAllTextareas, fitTextareaHeight } from '$lib/actions/fit-textarea';

	let { data }: { data: PageData } = $props();
	let item = $state<AssessmentItem>(structuredClone(data.item));
	let saving = $state(false);
	let saved = $state(false);
	let savedSnapshot = $state(snapshotValue(structuredClone(data.item)));
	const dirty = $derived(isDirtySnapshot(item, savedSnapshot));
	let showAiPanels = $state(true);
	let section = $state<
		| 'overview'
		| 'conditions'
		| 'task'
		| 'content'
		| 'auth'
		| 'rubric'
		| 'exam'
		| 'notes'
	>('overview');
	let showDisabledCriteria = $state(false);
	let statusMessage = $state('');
	let rubricPanel: HTMLElement | undefined = $state();

	const isStandalone = $derived(item.unitPlanId === STANDALONE_UNIT_PLAN_ID);
	const isExam = $derived(item.technique.value === 'Examination');
	const backHref = $derived(
		isStandalone ? '/' : `/level-plan/${item.levelPlanId}/unit/${item.unitPlanId}`
	);

	$effect(() => {
		if (section !== 'rubric') return;
		void item.criteriaRows;
		void showDisabledCriteria;
		requestAnimationFrame(() => {
			if (rubricPanel) fitAllTextareas(rubricPanel);
		});
	});

	async function save() {
		saving = true;
		saved = false;
		statusMessage = '';
		const res = await fetch('/api/assessment-items', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(item)
		});
		if (res.ok) {
			item = await res.json();
			saved = true;
			savedSnapshot = snapshotValue(item);
		} else {
			const body = await res.json().catch(() => ({}));
			statusMessage = body.message || 'Save failed';
		}
		saving = false;
	}

	function onCdToggle(code: string, selected: boolean) {
		// $state proxies are not structuredClone-able — snapshot first
		item = toggleContentDescription($state.snapshot(item), code, selected);
	}

	function onCriteriaToggle(rowId: string, enabled: boolean) {
		item = toggleCriteriaRow($state.snapshot(item), rowId, enabled);
	}

	function linkedContentDescriptions(row: AssessmentItem['criteriaRows'][number]) {
		const codes = new Set(row.contentDescriptionCodes);
		return item.contentDescriptions.filter((cd) => codes.has(String(cd.code.value)));
	}

	async function detach() {
		if (isStandalone) return;
		const index =
			item.assessmentNumber.value !== '' ? Number(item.assessmentNumber.value) - 1 : 0;
		if (!confirm('Detach this assessment item from the unit plan?')) return;
		const res = await fetch(
			`/api/unit-plan/${item.levelPlanId}/${item.unitPlanId}/assessments/${index}/detach`,
			{ method: 'POST' }
		);
		if (!res.ok) {
			const body = await res.json().catch(() => ({}));
			statusMessage = body.message || 'Detach failed';
			return;
		}
		const result = await res.json();
		item = result.assessmentItem;
		savedSnapshot = snapshotValue(item);
		statusMessage = 'Detached to standalone pool';
	}

	async function deleteItem() {
		if (!isStandalone) return;
		if (!confirm('Delete this standalone assessment item?')) return;
		const res = await fetch(`/api/assessment-items?id=${encodeURIComponent(item.id)}`, {
			method: 'DELETE'
		});
		if (!res.ok) {
			const body = await res.json().catch(() => ({}));
			statusMessage = body.message || 'Delete failed';
			return;
		}
		window.location.href = '/';
	}

	function addExamQuestion(sectionIndex: number) {
		item.examSections[sectionIndex].questions = [
			...item.examSections[sectionIndex].questions,
			{
				id: `q-${crypto.randomUUID().slice(0, 8)}`,
				prompt: {
					value: `Question ${item.examSections[sectionIndex].questions.length + 1}`,
					aiNotes: ''
				},
				marks: { value: '', aiNotes: '' }
			}
		];
	}
</script>

<div class="toolbar">
	<a class="btn" href={backHref}>{isStandalone ? '← Overview' : '← Unit plan'}</a>
	<h1 style="margin:0;flex:1">{item.title.value || 'Assessment item'}</h1>
	<a class="btn" href="/api/export/assessment-item/{item.id}" target="_blank">Export Word</a>
	{#if !isStandalone}
		<button class="btn" onclick={detach}>Detach</button>
	{:else}
		<button class="btn" onclick={deleteItem}>Delete</button>
	{/if}
	<EditorAiToggle bind:showAi={showAiPanels} />
	<button class="btn btn-primary" onclick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
	{#if saved}<span class="meta">Saved</span>{/if}
	{#if statusMessage}<span class="meta">{statusMessage}</span>{/if}
</div>

<div class="section-nav">
	<button class:active={section === 'overview'} onclick={() => (section = 'overview')}>Overview</button>
	<button class:active={section === 'conditions'} onclick={() => (section = 'conditions')}>Conditions</button>
	<button class:active={section === 'task'} onclick={() => (section = 'task')}>Task</button>
	<button class:active={section === 'content'} onclick={() => (section = 'content')}>Content descriptions</button>
	<button class:active={section === 'auth'} onclick={() => (section = 'auth')}>Auth & checkpoints</button>
	<button class:active={section === 'rubric'} onclick={() => (section = 'rubric')}>Rubric</button>
	{#if isExam}
		<button class:active={section === 'exam'} onclick={() => (section = 'exam')}>Exam questions</button>
	{/if}
	<button class:active={section === 'notes'} onclick={() => (section = 'notes')}>Notes</button>
</div>

<div class="doc-editor" class:hide-ai-panels={!showAiPanels}>
	{#if section === 'overview'}
		<div class="card">
			<div class="grid-2">
				<FieldEditor label="Title" bind:field={item.title} docType="assessment-item" docId={item.id} fieldPath="title" multiline={false} />
				<FieldEditor label="Instrument number" bind:field={item.instrumentNumber} docType="assessment-item" docId={item.id} fieldPath="instrumentNumber" multiline={false} />
			</div>
			<div class="grid-2">
				<FieldEditor label="Year level" bind:field={item.yearLevel} docType="assessment-item" docId={item.id} fieldPath="yearLevel" multiline={false} />
				<FieldEditor label="Assessment number" bind:field={item.assessmentNumber} docType="assessment-item" docId={item.id} fieldPath="assessmentNumber" multiline={false} />
			</div>
			<div class="grid-2">
				<FieldEditor label="Subject" bind:field={item.subject} docType="assessment-item" docId={item.id} fieldPath="subject" multiline={false} />
				<FieldEditor label="Unit title" bind:field={item.unitTitle} docType="assessment-item" docId={item.id} fieldPath="unitTitle" multiline={false} />
			</div>
			<div class="grid-2">
				<SelectFieldEditor label="Technique" bind:field={item.technique} options={ASSESSMENT_TECHNIQUES} docType="assessment-item" docId={item.id} fieldPath="technique" />
				<SelectFieldEditor label="Mode" bind:field={item.mode} options={ASSESSMENT_MODES} docType="assessment-item" docId={item.id} fieldPath="mode" />
			</div>
			<FieldEditor label="Topics" bind:field={item.topics} docType="assessment-item" docId={item.id} fieldPath="topics" multiline={false} />
			<FieldEditor label="Description (planning summary)" bind:field={item.description} docType="assessment-item" docId={item.id} fieldPath="description" rows={4} />
		</div>
	{/if}

	{#if section === 'conditions'}
		<div class="card">
			<FieldEditor label="Conditions (planning)" bind:field={item.conditions} docType="assessment-item" docId={item.id} fieldPath="conditions" rows={3} />
			<div class="grid-2">
				<FieldEditor label="Duration" bind:field={item.duration} docType="assessment-item" docId={item.id} fieldPath="duration" multiline={false} />
				<FieldEditor label="Length" bind:field={item.length} docType="assessment-item" docId={item.id} fieldPath="length" multiline={false} />
			</div>
			<div class="grid-2">
				<SelectFieldEditor
					label="Individual / group"
					bind:field={item.individualOrGroup}
					options={ASSESSMENT_INDIVIDUAL_OR_GROUP}
					docType="assessment-item"
					docId={item.id}
					fieldPath="individualOrGroup"
				/>
				<FieldEditor label="Other conditions" bind:field={item.conditionsOther} docType="assessment-item" docId={item.id} fieldPath="conditionsOther" multiline={false} />
			</div>
			<FieldEditor label="Resources available" bind:field={item.resourcesAvailable} docType="assessment-item" docId={item.id} fieldPath="resourcesAvailable" rows={3} />
			{#if isExam}
				<div class="grid-2">
					<FieldEditor label="Exam time (minutes)" bind:field={item.examTimeMinutes} docType="assessment-item" docId={item.id} fieldPath="examTimeMinutes" multiline={false} />
					<FieldEditor label="Perusal / planning (minutes)" bind:field={item.perusalMinutes} docType="assessment-item" docId={item.id} fieldPath="perusalMinutes" multiline={false} />
				</div>
				<FieldEditor label="Instructions" bind:field={item.instructions} docType="assessment-item" docId={item.id} fieldPath="instructions" rows={4} />
			{/if}
		</div>
	{/if}

	{#if section === 'task'}
		<div class="card">
			<FieldEditor label="Context" bind:field={item.context} docType="assessment-item" docId={item.id} fieldPath="context" rows={5} />
			<FieldEditor label="Task" bind:field={item.task} docType="assessment-item" docId={item.id} fieldPath="task" rows={8} />
			<FieldEditor label="To complete this task, you must" bind:field={item.toComplete} docType="assessment-item" docId={item.id} fieldPath="toComplete" rows={6} />
			<FieldEditor label="Stimulus" bind:field={item.stimulus} docType="assessment-item" docId={item.id} fieldPath="stimulus" rows={4} />
			<FieldEditor label="Scaffolding" bind:field={item.scaffolding} docType="assessment-item" docId={item.id} fieldPath="scaffolding" rows={4} />
		</div>
	{/if}

	{#if section === 'content'}
		<div class="card">
			<p class="meta">
				Ticking a content description enables its linked rubric row(s), and ticking a rubric row
				selects its content descriptions ({selectedContentDescriptionCodes(item).length} selected).
			</p>
		</div>
		{#if item.contentDescriptions.length}
			<div class="card checkbox-matrix content-descriptions-matrix">
				<table class="data-table">
					<thead>
						<tr>
							<th>Strand</th>
							<th>Text</th>
							<th>Code</th>
							<th class="unit-col">Assessed</th>
						</tr>
					</thead>
					<tbody>
						{#each item.contentDescriptions as cd (cd.id)}
							<tr>
								<td class="content-strand-cell">{cd.strand.value}</td>
								<td class="content-text-cell">{cd.text.value}</td>
								<td class="content-code-cell">{cd.code.value}</td>
								<td class="unit-check-cell">
									<input
										type="checkbox"
										aria-label="{cd.code.value} assessed"
										checked={cd.selected}
										onchange={(e) => onCdToggle(String(cd.code.value), e.currentTarget.checked)}
									/>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else}
			<div class="card">
				<p class="meta">
					No curriculum catalogue for this subject/year. Set year level and subject to Digital
					Technologies 7–8 / 9–10 or Design and Technologies 9–10, then reload.
				</p>
			</div>
		{/if}
	{/if}

	{#if section === 'auth'}
		<div class="card">
			<h2 style="margin-top:0">Checkpoints</h2>
			{#each item.checkpoints as cp, ci (cp.id)}
				<div class="card" style="background:#f8fafc">
					<label class="cd-row">
						<input type="checkbox" bind:checked={cp.checked} />
						<span>{cp.label}</span>
					</label>
					<div class="grid-2">
						<FieldEditor label="Week" bind:field={cp.week} docType="assessment-item" docId={item.id} fieldPath="checkpoints.{ci}.week" multiline={false} />
						<FieldEditor label="Action" bind:field={cp.action} docType="assessment-item" docId={item.id} fieldPath="checkpoints.{ci}.action" multiline={false} />
					</div>
				</div>
			{/each}
		</div>
		<div class="card">
			<h2 style="margin-top:0">Authentication strategies</h2>
			{#each item.authenticationStrategies as strategy (strategy.id)}
				<label class="cd-row">
					<input type="checkbox" bind:checked={strategy.selected} />
					<span>{strategy.label}</span>
				</label>
			{/each}
		</div>
	{/if}

	{#if section === 'rubric'}
		<div class="card" bind:this={rubricPanel}>
			<label class="cd-row" style="margin-bottom:1rem">
				<input type="checkbox" bind:checked={showDisabledCriteria} />
				<span>Show disabled criteria rows</span>
			</label>
			{#each item.criteriaRows as row (row.id)}
				{#if row.enabled || showDisabledCriteria}
					{@const linked = linkedContentDescriptions(row)}
					<div class="card" style="background:#f8fafc">
						<div class="toolbar">
							<label class="cd-row" style="flex:1;margin:0">
								<input
									type="checkbox"
									checked={row.enabled}
									onchange={(e) => onCriteriaToggle(row.id, e.currentTarget.checked)}
								/>
								<span>
									<strong>{row.category}</strong> — {row.strand}
									<span class="meta">({row.contentDescriptionCodes.join(', ')})</span>
								</span>
							</label>
						</div>
						{#if linked.length}
							<ul class="linked-cds">
								{#each linked as cd (cd.id)}
									<li class:selected-cd={cd.selected}>
										<code>{cd.code.value}</code>
										{cd.text.value}
									</li>
								{/each}
							</ul>
						{/if}
						{#if row.enabled || showDisabledCriteria}
							<div class="rubric-grid">
								<label
									>A<textarea
										class="fit-textarea"
										use:fitTextareaHeight
										bind:value={row.descriptors.A}
										rows="2"
									></textarea></label
								>
								<label
									>B<textarea
										class="fit-textarea"
										use:fitTextareaHeight
										bind:value={row.descriptors.B}
										rows="2"
									></textarea></label
								>
								<label
									>C<textarea
										class="fit-textarea"
										use:fitTextareaHeight
										bind:value={row.descriptors.C}
										rows="2"
									></textarea></label
								>
								<label
									>D<textarea
										class="fit-textarea"
										use:fitTextareaHeight
										bind:value={row.descriptors.D}
										rows="2"
									></textarea></label
								>
								<label
									>E<textarea
										class="fit-textarea"
										use:fitTextareaHeight
										bind:value={row.descriptors.E}
										rows="2"
									></textarea></label
								>
							</div>
						{/if}
					</div>
				{/if}
			{/each}
			{#if item.criteriaRows.length === 0}
				<p class="meta">No rubric rows yet. Select content descriptions first.</p>
			{/if}
		</div>
	{/if}

	{#if section === 'exam' && isExam}
		{#each item.examSections as examSection, si (examSection.id)}
			<div class="card">
				<div class="toolbar">
					<h2 style="margin:0;flex:1">{examSection.title.value}</h2>
					<button class="btn btn-sm" onclick={() => addExamQuestion(si)}>Add question</button>
				</div>
				<FieldEditor label="Section title" bind:field={examSection.title} docType="assessment-item" docId={item.id} fieldPath="examSections.{si}.title" multiline={false} />
				{#each examSection.questions as q, qi (q.id)}
					<div class="grid-2">
						<FieldEditor label="Prompt" bind:field={q.prompt} docType="assessment-item" docId={item.id} fieldPath="examSections.{si}.questions.{qi}.prompt" rows={2} />
						<FieldEditor label="Marks" bind:field={q.marks} docType="assessment-item" docId={item.id} fieldPath="examSections.{si}.questions.{qi}.marks" multiline={false} />
					</div>
				{/each}
			</div>
		{/each}
	{/if}

	{#if section === 'notes'}
		<div class="card">
			<FieldEditor label="Notes" bind:field={item.notes} docType="assessment-item" docId={item.id} fieldPath="notes" rows={6} />
		</div>
	{/if}
</div>

<FloatingSaveButton {dirty} {saving} {saved} onclick={save} />

<style>
	.cd-row {
		display: flex;
		gap: 0.6rem;
		align-items: flex-start;
		margin: 0.45rem 0;
		cursor: pointer;
	}
	.cd-row input {
		margin-top: 0.2rem;
	}
	.rubric-grid {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: 0.5rem;
	}
	.rubric-grid label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.85rem;
		font-weight: 600;
	}
	.rubric-grid textarea {
		width: 100%;
		font-weight: 400;
		overflow: hidden;
		resize: none;
		min-height: 2.75rem;
	}
	.linked-cds {
		margin: 0 0 0.75rem;
		padding-left: 1.25rem;
		font-size: 0.85rem;
		color: #475569;
	}
	.linked-cds li {
		margin: 0.2rem 0;
	}
	.linked-cds li.selected-cd {
		color: #0f172a;
		font-weight: 500;
	}
	.linked-cds code {
		font-size: 0.8rem;
		margin-right: 0.35rem;
	}
</style>
