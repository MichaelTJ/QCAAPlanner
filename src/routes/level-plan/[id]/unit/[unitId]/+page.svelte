<script lang="ts">
	import type { PageData } from './$types';
	import FieldEditor from '$lib/components/FieldEditor.svelte';
	import SelectFieldEditor from '$lib/components/SelectFieldEditor.svelte';
	import {
		ASSESSMENT_MODES,
		ASSESSMENT_TECHNIQUES,
		PLAN_STATUSES,
		STANDALONE_LEVEL_PLAN_ID,
		createId
	} from '$lib/defaults';
	import type { UnitPlan, UnitAssessment } from '$lib/types';
	import type { GenerationUsage } from '$lib/gemini-models';
	import ModelFeedback from '$lib/components/ModelFeedback.svelte';
	import EditorAiToggle from '$lib/components/EditorAiToggle.svelte';
	import CapabilityCheckboxTree from '$lib/components/CapabilityCheckboxTree.svelte';
	import {
		applyCheckedSubElementIds,
		ensureUnitCapabilityChecks,
		formatCheckedSubElements,
		validSubElementIds
	} from '$lib/general-capabilities';
	import { learningGuideFromUnitPlan, learningGuideTitle } from '$lib/learning-guide-data';

	let { data }: { data: PageData } = $props();
	let plan = $state<UnitPlan>(structuredClone(data.plan));
	for (const cap of plan.generalCapabilities) {
		cap.subElementChecks = ensureUnitCapabilityChecks(cap);
	}
	let section = $state<
		'overview' | 'assessments' | 'capabilities' | 'scope' | 'sequence' | 'evaluation'
	>('overview');
	let saving = $state(false);
	let saved = $state(false);
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
			const res = await fetch(`/api/import/unit-plan/${plan.levelPlanId}/${plan.id}`, {
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
				'Import as a new unit plan copy? Your current plan will not be changed, and you will be taken to the imported copy.'
			)
		) {
			input.value = '';
			return;
		}
		void importWord(file);
	}

	async function importLearningGuide(file: File) {
		learningGuideImporting = true;
		learningGuideImportError = '';
		try {
			const form = new FormData();
			form.append('file', file);
			const res = await fetch(
				`/api/import/learning-guide/${plan.levelPlanId}/${plan.id}`,
				{ method: 'POST', body: form }
			);
			const body = await res.json().catch(() => ({}));
			if (!res.ok) {
				throw new Error(body.message || 'Learning guide import failed');
			}
			if (body.redirectTo) {
				window.location.href = body.redirectTo;
				return;
			}
		} catch (e) {
			learningGuideImportError =
				e instanceof Error ? e.message : 'Learning guide import failed';
		} finally {
			learningGuideImporting = false;
			if (learningGuideImportInput) learningGuideImportInput.value = '';
		}
	}

	function onLearningGuideImportSelected(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		if (
			!confirm(
				'Import as a new unit plan copy with updated learning guide content? Your current plan will not be changed.'
			)
		) {
			input.value = '';
			return;
		}
		void importLearningGuide(file);
	}

	let chunkMode = $state<'outline' | 'weekly'>('outline');
	let chunkSize = $state(3);
	let chunkStart = $state(1);
	let chunkEnd = $state(3);
	let chunkNotes = $state('');
	let chunkGenerating = $state(false);
	let chunkError = $state('');
	let chunkUsage = $state<GenerationUsage | null>(null);
	let batchGenerating = $state(false);
	let batchStatus = $state('');
	let batchFinished = $state(false);

	let capGenerating = $state(false);
	let capGeneratingName = $state<string | null>(null);
	let capError = $state('');
	let capUsage = $state<GenerationUsage | null>(null);
	let capNotes = $state('');

	let learningGuideExporting = $state(false);
	let learningGuideExportMode = $state<'summary' | 'detailed' | null>(null);
	let learningGuideExportError = $state('');
	let learningGuideImporting = $state(false);
	let learningGuideImportError = $state('');
	let learningGuideImportInput: HTMLInputElement | undefined = $state();

	function scopeGuideFromPlan(unit: UnitPlan) {
		return learningGuideFromUnitPlan(unit);
	}

	let scopeGuide = $derived.by(() => {
		// Establish reactive dependencies on fields that feed the learning guide.
		for (const week of plan.teachingSequence) {
			week.week.value;
			week.outlineTheme?.value;
			week.theory.value;
			week.prac.value;
			week.keyTeachingExperiences.value;
		}
		plan.yearLevel.value;
		plan.subject.value;
		plan.unitTitle.value;
		plan.startWeek.value;
		plan.finishWeek.value;
		return scopeGuideFromPlan(plan);
	});
	let scopeTitle = $derived(learningGuideTitle(scopeGuide));

	async function exportLearningGuide(detail: 'summary' | 'detailed') {
		learningGuideExporting = true;
		learningGuideExportMode = detail;
		learningGuideExportError = '';
		const query = detail === 'detailed' ? '?detail=detailed' : '';
		const suffix = detail === 'detailed' ? '-learning-guide-detailed' : '-learning-guide';
		try {
			const res = await fetch(`/api/export/learning-guide/${plan.levelPlanId}/${plan.id}${query}`);
			if (!res.ok) {
				let message = 'Learning guide export failed';
				try {
					const body = await res.json();
					message = body.message ?? message;
				} catch {
					message = (await res.text()) || message;
				}
				throw new Error(message);
			}
			const blob = await res.blob();
			const url = URL.createObjectURL(blob);
			const anchor = document.createElement('a');
			anchor.href = url;
			anchor.download = `${plan.id}${suffix}.docx`;
			anchor.click();
			URL.revokeObjectURL(url);
		} catch (e) {
			learningGuideExportError = e instanceof Error ? e.message : 'Learning guide export failed';
		} finally {
			learningGuideExporting = false;
			learningGuideExportMode = null;
		}
	}

	async function save() {
		saving = true;
		saved = false;
		for (const cap of plan.generalCapabilities) {
			cap.subElements.value = formatCheckedSubElements(cap.name.value, cap.subElementChecks);
		}
		const res = await fetch(`/api/unit-plan/${plan.levelPlanId}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(plan)
		});
		if (res.ok) {
			saved = true;
			plan.teachingSequence = plan.teachingSequence.slice();
		}
		saving = false;
	}

	async function deletePlan() {
		if (plan.levelPlanId !== STANDALONE_LEVEL_PLAN_ID) return;
		if (!confirm('Delete this standalone unit plan? This cannot be undone.')) return;
		const res = await fetch(`/api/unit-plan/${plan.levelPlanId}?unitId=${plan.id}`, {
			method: 'DELETE'
		});
		if (res.ok) {
			window.location.href = '/';
		} else {
			const data = await res.json().catch(() => ({}));
			alert(data.message || 'Failed to delete unit plan.');
		}
	}

	function ensureWeekThrough(maxWeek: number, minWeek = 1) {
		for (let weekNum = minWeek; weekNum <= maxWeek; weekNum++) {
			if (!plan.teachingSequence.some((w) => Number(w.week.value) === weekNum)) {
				plan.teachingSequence.push({
					id: createId('week'),
					week: { value: weekNum, aiNotes: '' },
					keyTeachingExperiences: { value: '', aiNotes: '' },
					adjustments: { value: '', aiNotes: '' },
					resources: { value: '', aiNotes: '' },
					theory: { value: '', aiNotes: '' },
					prac: { value: '', aiNotes: '' },
					assessment: { value: '', aiNotes: '' },
					outlineTheme: { value: '', aiNotes: '' }
				});
			}
		}
		plan.teachingSequence.sort((a, b) => Number(a.week.value) - Number(b.week.value));
		plan.teachingSequence = plan.teachingSequence.slice();
	}

	function ensureWeeks(count: number, startAt = 1) {
		ensureWeekThrough(startAt + count - 1, startAt);
	}

	function weekRow(weekNum: number) {
		let row = plan.teachingSequence.find((w) => Number(w.week.value) === weekNum);
		if (!row) {
			row = {
				id: createId('week'),
				week: { value: weekNum, aiNotes: '' },
				keyTeachingExperiences: { value: '', aiNotes: '' },
				adjustments: { value: '', aiNotes: '' },
				resources: { value: '', aiNotes: '' },
				theory: { value: '', aiNotes: '' },
				prac: { value: '', aiNotes: '' },
				assessment: { value: '', aiNotes: '' },
				outlineTheme: { value: '', aiNotes: '' }
			};
			plan.teachingSequence.push(row);
		}
		return row;
	}

	function addAssessment() {
		plan.assessments = [
			...plan.assessments,
			{
				id: createId('uassess'),
				assessmentNumber: { value: plan.assessments.length + 1, aiNotes: '' },
				yearLevel: { value: plan.yearLevel.value, aiNotes: '' },
				title: { value: '', aiNotes: '' },
				description: { value: '', aiNotes: '' },
				technique: { value: '', aiNotes: '' },
				mode: { value: '', aiNotes: '' },
				conditions: { value: '', aiNotes: '' },
				timing: { value: '', aiNotes: '' },
				achievementStandard: { value: '', aiNotes: '' },
				moderation: { value: '', aiNotes: '' },
				contentDescriptions: []
			}
		];
	}

	function removeAssessment(index: number) {
		if (!confirm('Remove this assessment?')) return;
		plan.assessments = plan.assessments.filter((_, i) => i !== index);
	}

	function addAdjustment() {
		plan.adjustments = [
			...plan.adjustments,
			{
				id: createId('adj'),
				studentIdentifier: { value: '', aiNotes: '' },
				assessmentBand: { value: '', aiNotes: '' },
				categoryOfNeed: { value: '', aiNotes: '' },
				adjustments: { value: '', aiNotes: '' },
				review: { value: '', aiNotes: '' }
			}
		];
	}

	async function suggestCapabilities(capabilityName: string | undefined = undefined) {
		capGenerating = true;
		capGeneratingName = capabilityName ?? null;
		capError = '';
		capUsage = null;
		try {
			const res = await fetch('/api/generate/capabilities', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					levelPlanId: plan.levelPlanId,
					unitId: plan.id,
					capabilityName,
					aiNotes: capNotes
				})
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.message || 'Generation failed');

			const checkedIds = data.checkedSubElementIds as string[];
			if (capabilityName) {
				const cap = plan.generalCapabilities.find((row) => row.name.value === capabilityName);
				if (cap) {
					applyCheckedSubElementIds(
						cap.subElementChecks,
						checkedIds,
						validSubElementIds(capabilityName)
					);
				}
			} else {
				for (const cap of plan.generalCapabilities) {
					const scopeIds = validSubElementIds(cap.name.value);
					const idsForCap = checkedIds.filter((id) => scopeIds.includes(id));
					applyCheckedSubElementIds(cap.subElementChecks, idsForCap, scopeIds);
				}
			}

			capUsage = {
				model: data.model,
				modelLabel: data.modelLabel,
				attemptedModels: data.attemptedModels ?? [],
				usedFallback: data.usedFallback ?? false
			};
		} catch (e) {
			capError = e instanceof Error ? e.message : 'Generation failed';
		} finally {
			capGenerating = false;
			capGeneratingName = null;
		}
	}

	const BATCH_CHUNK_SIZE = 3;
	const BATCH_CHUNK_RETRIES = 3;

	function batchWeekRange(): { start: number; end: number } | null {
		const nums = plan.teachingSequence
			.map((w) => Number(w.week.value))
			.filter((n) => !Number.isNaN(n) && n > 0);
		if (!nums.length) return null;
		return { start: Math.min(...nums), end: Math.max(...nums) };
	}

	async function generateChunkRange(
		startWeek: number,
		endWeek: number,
		size: number
	): Promise<{ ok: true; usage: GenerationUsage } | { ok: false; error: string }> {
		ensureWeekThrough(endWeek, 1);
		try {
			const res = await fetch('/api/generate/chunk', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					levelPlanId: plan.levelPlanId,
					unitId: plan.id,
					mode: chunkMode,
					chunkSize: size,
					startWeek,
					endWeek,
					aiNotes: chunkNotes
				})
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.message);

			for (let i = 0; i < data.weeks.length; i++) {
				const weekData = data.weeks[i];
				const weekNum = startWeek + i;
				const row = weekRow(weekNum);
				if (chunkMode === 'outline') {
					row.outlineTheme = {
						...row.outlineTheme!,
						value: String(weekData.outlineTheme ?? ''),
						lastGenerated: data.lastGenerated
					};
				} else {
					row.keyTeachingExperiences.value = String(weekData.keyTeachingExperiences ?? '');
					row.theory.value = String(weekData.theory ?? '');
					row.prac.value = String(weekData.prac ?? '');
					row.assessment.value = String(weekData.assessment ?? '');
					row.resources.value = String(weekData.resources ?? '');
				}
			}
			plan.teachingSequence.sort(
				(a, b) => Number(a.week.value) - Number(b.week.value)
			);
			plan.teachingSequence = plan.teachingSequence.slice();
			return {
				ok: true,
				usage: {
					model: data.model,
					modelLabel: data.modelLabel,
					attemptedModels: data.attemptedModels ?? [],
					usedFallback: data.usedFallback ?? false
				}
			};
		} catch (e) {
			return {
				ok: false,
				error: e instanceof Error ? e.message : 'Chunk generation failed'
			};
		}
	}

	async function generateChunk() {
		chunkGenerating = true;
		chunkError = '';
		chunkUsage = null;
		batchFinished = false;
		const result = await generateChunkRange(chunkStart, chunkEnd, chunkSize);
		if (result.ok) {
			chunkUsage = result.usage;
		} else {
			chunkError = result.error;
		}
		chunkGenerating = false;
	}

	async function generateChunkRangeWithRetries(
		from: number,
		to: number,
		count: number
	): Promise<{ ok: true; usage: GenerationUsage } | { ok: false; error: string }> {
		let lastError = '';
		for (let attempt = 1; attempt <= BATCH_CHUNK_RETRIES; attempt++) {
			batchStatus =
				attempt === 1
					? `Generating weeks ${from}–${to}…`
					: `Generating weeks ${from}–${to}… (retry ${attempt}/${BATCH_CHUNK_RETRIES})`;

			const result = await generateChunkRange(from, to, count);
			if (result.ok) return result;
			lastError = result.error;
		}
		return { ok: false, error: lastError };
	}

	async function generateAllChunksSequentially() {
		const range = batchWeekRange();
		if (!range) {
			chunkError = 'Add teaching weeks first (e.g. Ensure 10 weeks).';
			return;
		}

		batchGenerating = true;
		batchFinished = false;
		batchStatus = '';
		chunkError = '';
		chunkUsage = null;
		ensureWeekThrough(range.end, range.start);

		try {
			for (let from = range.start; from <= range.end; from += BATCH_CHUNK_SIZE) {
				const to = Math.min(from + BATCH_CHUNK_SIZE - 1, range.end);
				const count = to - from + 1;

				const result = await generateChunkRangeWithRetries(from, to, count);
				if (!result.ok) {
					chunkError = result.error;
					batchStatus = `Stopped at weeks ${from}–${to} after ${BATCH_CHUNK_RETRIES} attempts`;
					return;
				}
				chunkUsage = result.usage;
			}
			batchFinished = true;
			batchStatus = 'Finished';
		} finally {
			batchGenerating = false;
		}
	}

	async function createAssessmentItem(assess: UnitAssessment) {
		const res = await fetch('/api/assessment-items', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				levelPlanId: plan.levelPlanId,
				unitPlanId: plan.id,
				title: assess.title.value || 'Assessment item'
			})
		});
		const item = await res.json();
		window.location.href = `/assessment-item/${item.id}`;
	}
</script>

<div class="toolbar">
	<a class="btn" href={plan.levelPlanId === STANDALONE_LEVEL_PLAN_ID ? '/' : `/level-plan/${plan.levelPlanId}`}>
		{plan.levelPlanId === STANDALONE_LEVEL_PLAN_ID ? '← Overview' : '← Level plan'}
	</a>
	<h1 style="margin:0;flex:1">{plan.unitTitle.value || 'Unit plan'}</h1>
	<a class="btn" href="/api/export/unit-plan/{plan.levelPlanId}/{plan.id}" target="_blank">Export Word</a>
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
	{#if plan.levelPlanId === STANDALONE_LEVEL_PLAN_ID}
		<button class="btn" onclick={deletePlan}>Delete</button>
	{/if}
	<EditorAiToggle bind:showAi={showAiPanels} />
	<button class="btn btn-primary" onclick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
	{#if saved}<span class="meta">Saved</span>{/if}
	{#if importError}<span class="meta" style="color:var(--danger,#c00)">{importError}</span>{/if}
</div>

<div class="section-nav">
	<button class:active={section === 'overview'} onclick={() => (section = 'overview')}>Overview</button>
	<button class:active={section === 'assessments'} onclick={() => (section = 'assessments')}>Assessments</button>
	<button class:active={section === 'capabilities'} onclick={() => (section = 'capabilities')}>Capabilities</button>
	<button class:active={section === 'scope'} onclick={() => (section = 'scope')}>Scope and sequence</button>
	<button class:active={section === 'sequence'} onclick={() => (section = 'sequence')}>Teaching sequence</button>
	<button class:active={section === 'evaluation'} onclick={() => (section = 'evaluation')}>Evaluation</button>
</div>

<div class="doc-editor" class:hide-ai-panels={!showAiPanels}>
{#if section === 'overview'}
	<div class="card">
		<div class="grid-2">
			<FieldEditor label="Year level" bind:field={plan.yearLevel} docType="unit-plan" docId={plan.id} levelPlanId={plan.levelPlanId} fieldPath="yearLevel" multiline={false} />
			<FieldEditor label="Unit number" bind:field={plan.unitNumber} docType="unit-plan" docId={plan.id} levelPlanId={plan.levelPlanId} fieldPath="unitNumber" multiline={false} />
		</div>
		<FieldEditor label="Subject" bind:field={plan.subject} docType="unit-plan" docId={plan.id} levelPlanId={plan.levelPlanId} fieldPath="subject" multiline={false} />
		<FieldEditor label="Unit title" bind:field={plan.unitTitle} docType="unit-plan" docId={plan.id} levelPlanId={plan.levelPlanId} fieldPath="unitTitle" multiline={false} />
		<div class="grid-2">
			<FieldEditor label="Start week" bind:field={plan.startWeek} docType="unit-plan" docId={plan.id} levelPlanId={plan.levelPlanId} fieldPath="startWeek" multiline={false} />
			<FieldEditor label="Finish week" bind:field={plan.finishWeek} docType="unit-plan" docId={plan.id} levelPlanId={plan.levelPlanId} fieldPath="finishWeek" multiline={false} />
		</div>
		<SelectFieldEditor label="Status" bind:field={plan.status} options={PLAN_STATUSES} docType="unit-plan" docId={plan.id} levelPlanId={plan.levelPlanId} fieldPath="status" />
		<FieldEditor label="Unit description" bind:field={plan.unitDescription} docType="unit-plan" docId={plan.id} levelPlanId={plan.levelPlanId} fieldPath="unitDescription" rows={6} />
		<FieldEditor label="Cohort and class considerations" bind:field={plan.cohortAndClassConsiderations} docType="unit-plan" docId={plan.id} levelPlanId={plan.levelPlanId} fieldPath="cohortAndClassConsiderations" rows={4} />
	</div>

	<div class="card">
		<div class="toolbar">
			<h2 style="margin:0">Adjustments</h2>
			<button class="btn btn-sm" onclick={addAdjustment}>Add row</button>
		</div>
		{#each plan.adjustments as adj, ai (adj.id)}
			<div class="card" style="background:#f8fafc">
				<FieldEditor label="Student identifier" bind:field={adj.studentIdentifier} docType="unit-plan" docId={plan.id} levelPlanId={plan.levelPlanId} fieldPath="adjustments.{ai}.studentIdentifier" multiline={false} />
				<FieldEditor label="Assessment band" bind:field={adj.assessmentBand} docType="unit-plan" docId={plan.id} levelPlanId={plan.levelPlanId} fieldPath="adjustments.{ai}.assessmentBand" multiline={false} />
				<FieldEditor label="Category of need" bind:field={adj.categoryOfNeed} docType="unit-plan" docId={plan.id} levelPlanId={plan.levelPlanId} fieldPath="adjustments.{ai}.categoryOfNeed" />
				<FieldEditor label="Adjustments" bind:field={adj.adjustments} docType="unit-plan" docId={plan.id} levelPlanId={plan.levelPlanId} fieldPath="adjustments.{ai}.adjustments" />
				<FieldEditor label="Review" bind:field={adj.review} docType="unit-plan" docId={plan.id} levelPlanId={plan.levelPlanId} fieldPath="adjustments.{ai}.review" />
			</div>
		{/each}
	</div>
{/if}

{#if section === 'assessments'}
	<div class="toolbar"><button class="btn" onclick={addAssessment}>Add assessment</button></div>
	{#each plan.assessments as assess, ai (assess.id)}
		<div class="card">
			<div class="toolbar">
				<h2 style="margin:0;flex:1">{assess.title.value || `Assessment ${ai + 1}`}</h2>
				<button class="btn btn-sm" onclick={() => removeAssessment(ai)}>Remove</button>
			</div>
			<FieldEditor label="Title" bind:field={assess.title} docType="unit-plan" docId={plan.id} levelPlanId={plan.levelPlanId} fieldPath="assessments.{ai}.title" multiline={false} />
			<FieldEditor label="Description" bind:field={assess.description} docType="unit-plan" docId={plan.id} levelPlanId={plan.levelPlanId} fieldPath="assessments.{ai}.description" rows={5} />
			<div class="grid-2">
				<SelectFieldEditor label="Technique" bind:field={assess.technique} options={ASSESSMENT_TECHNIQUES} docType="unit-plan" docId={plan.id} levelPlanId={plan.levelPlanId} fieldPath="assessments.{ai}.technique" />
				<SelectFieldEditor label="Mode" bind:field={assess.mode} options={ASSESSMENT_MODES} docType="unit-plan" docId={plan.id} levelPlanId={plan.levelPlanId} fieldPath="assessments.{ai}.mode" />
			</div>
			<FieldEditor label="Conditions" bind:field={assess.conditions} docType="unit-plan" docId={plan.id} levelPlanId={plan.levelPlanId} fieldPath="assessments.{ai}.conditions" />
			<FieldEditor label="Timing" bind:field={assess.timing} docType="unit-plan" docId={plan.id} levelPlanId={plan.levelPlanId} fieldPath="assessments.{ai}.timing" multiline={false} />
			<FieldEditor label="Achievement standard" bind:field={assess.achievementStandard} docType="unit-plan" docId={plan.id} levelPlanId={plan.levelPlanId} fieldPath="assessments.{ai}.achievementStandard" rows={5} />
			<FieldEditor label="Moderation" bind:field={assess.moderation} docType="unit-plan" docId={plan.id} levelPlanId={plan.levelPlanId} fieldPath="assessments.{ai}.moderation" />
			<button class="btn btn-sm" onclick={() => createAssessmentItem(assess)}>Create assessment item</button>
		</div>
	{/each}
{/if}

{#if section === 'capabilities'}
	<div class="chunk-panel">
		<h2 style="margin-top:0">AI capability mapping</h2>
		<p class="meta">
			Suggests checkboxes from the unit description and assessment descriptions. Review and adjust
			before saving.
		</p>
		<label>
			AI notes (optional)
			<textarea bind:value={capNotes} rows="2" style="width:100%"></textarea>
		</label>
		<button
			class="btn btn-primary"
			onclick={() => suggestCapabilities()}
			disabled={capGenerating}
		>
			{capGenerating && !capGeneratingName ? 'Suggesting…' : 'AI suggest all capabilities'}
		</button>
		<ModelFeedback usage={capUsage} />
		{#if capError}<p class="error">{capError}</p>{/if}
	</div>
	{#each plan.generalCapabilities as cap, ci (cap.id)}
		<div class="card checkbox-matrix">
			<div class="toolbar" style="margin-bottom:0.75rem">
				<h2 style="margin:0;flex:1">{cap.name.value}</h2>
				<button
					class="btn btn-sm btn-primary"
					onclick={() => suggestCapabilities(cap.name.value)}
					disabled={capGenerating}
				>
					{capGenerating && capGeneratingName === cap.name.value ? 'Suggesting…' : 'AI suggest'}
				</button>
			</div>
			<CapabilityCheckboxTree capabilityName={cap.name.value} bind:checks={cap.subElementChecks} />
			<FieldEditor label="Evidence notes" bind:field={cap.evidenceNotes} docType="unit-plan" docId={plan.id} levelPlanId={plan.levelPlanId} fieldPath="generalCapabilities.{ci}.evidenceNotes" />
		</div>
	{/each}
{/if}

{#if section === 'scope'}
	<div class="card scope-sequence-card">
		<p class="scope-readonly-note">
			This view is read-only and shows how weekly content will appear in the Learning Guide.
			To change week themes or dot points, edit them in
			<button type="button" class="linkish" onclick={() => (section = 'sequence')}>Teaching sequence</button>.
		</p>

		<div class="toolbar scope-toolbar">
			<div>
				<h2 style="margin:0">Learning Guide</h2>
				<p class="meta" style="margin:0.35rem 0 0">{scopeTitle}</p>
			</div>
			<div class="scope-export-actions">
				<button
					class="btn btn-primary"
					onclick={() => exportLearningGuide('summary')}
					disabled={learningGuideExporting || scopeGuide.weeks.length === 0}
				>
					{learningGuideExporting && learningGuideExportMode === 'summary'
						? 'Generating…'
						: 'Export Learning Guide'}
				</button>
				<button
					class="btn"
					onclick={() => exportLearningGuide('detailed')}
					disabled={learningGuideExporting || scopeGuide.weeks.length === 0}
				>
					{learningGuideExporting && learningGuideExportMode === 'detailed'
						? 'Generating…'
						: 'Export Detailed Learning Guide'}
				</button>
				<input
					bind:this={learningGuideImportInput}
					type="file"
					accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
					hidden
					onchange={onLearningGuideImportSelected}
				/>
				<button
					class="btn"
					onclick={() => learningGuideImportInput?.click()}
					disabled={learningGuideImporting}
				>
					{learningGuideImporting ? 'Importing…' : 'Import Learning Guide'}
				</button>
			</div>
		</div>

		{#if learningGuideExportError}
			<p class="error">{learningGuideExportError}</p>
		{/if}
		{#if learningGuideImportError}
			<p class="error">{learningGuideImportError}</p>
		{/if}

		{#if learningGuideExporting}
			<p class="meta">
				{#if learningGuideExportMode === 'detailed'}
					Generating vocabulary with AI and building the detailed Word document — this may take a moment.
				{:else}
					Summarising weekly objectives and vocabulary with AI, then building the Word document — this may take a moment.
				{/if}
			</p>
		{/if}

		{#if scopeGuide.weeks.length === 0}
			<p class="meta">No teaching weeks yet. Add content in Teaching sequence first.</p>
		{:else}
			<div class="scope-table-wrap">
				<table class="data-table scope-table">
					<thead>
						<tr>
							<th class="scope-wk-col">WK</th>
							<th>CONTENT</th>
						</tr>
					</thead>
					<tbody>
						{#each scopeGuide.weeks as week, weekIndex (`${week.week}-${weekIndex}`)}
							<tr>
								<td class="scope-wk-col">{week.week}</td>
								<td class="scope-content-cell">
									{#if week.title}
										<div class="scope-week-title">{week.title}</div>
									{/if}
									{#if week.bullets.length}
										<ul class="scope-bullets">
											{#each week.bullets as bullet}
												<li>{bullet}</li>
											{/each}
										</ul>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<p class="meta scope-vocab-note">
				Export Learning Guide summarises weekly objectives for a one-page printout. Export Detailed Learning Guide
				keeps the full objectives shown above and still generates vocabulary automatically.
			</p>
		{/if}
	</div>
{/if}

{#if section === 'sequence'}
	{@const batchRange = batchWeekRange()}
	<div class="sequence-batch-bar">
		<button
			class="btn btn-primary"
			onclick={generateAllChunksSequentially}
			disabled={batchGenerating || chunkGenerating || !batchRange}
		>
			{#if batchGenerating}
				{batchStatus}
			{:else if batchRange}
				Generate all weeks {batchRange.start}–{batchRange.end} ({BATCH_CHUNK_SIZE} at a time)
			{:else}
				Generate all (add weeks first)
			{/if}
		</button>
		{#if batchFinished && !batchGenerating}
			<span class="meta batch-finished">Finished</span>
		{/if}
		{#if batchRange && !batchGenerating}
			<span class="meta">
				Uses {chunkMode === 'outline' ? 'outline' : 'weekly detail'} mode
			</span>
		{/if}
		<ModelFeedback usage={batchGenerating || batchFinished ? chunkUsage : null} />
	</div>

	<div class="chunk-panel">
		<h2>Chunked generation</h2>
		<p class="meta">Outline mode: high-level week themes (3–5 weeks). Weekly mode: theory, prac, assessment detail (3 weeks at a time).</p>
		<div class="form-row">
			<label>
				Mode
				<select bind:value={chunkMode}>
					<option value="outline">Outline (planning pass)</option>
					<option value="weekly">Weekly detail (content pass)</option>
				</select>
			</label>
			<label>
				Chunk size
				<select bind:value={chunkSize} onchange={() => { chunkEnd = chunkStart + chunkSize - 1; }}>
					{#each chunkMode === 'outline' ? [3, 4, 5] : [3] as size}
						<option value={size}>{size} weeks</option>
					{/each}
				</select>
			</label>
			<label>
				From week
				<input type="number" min="1" bind:value={chunkStart} onchange={() => { chunkEnd = chunkStart + chunkSize - 1; }} />
			</label>
			<label>
				To week
				<input type="number" min="1" bind:value={chunkEnd} />
			</label>
		</div>
		<label>
			AI notes for this chunk
			<textarea bind:value={chunkNotes} rows="2" style="width:100%"></textarea>
		</label>
		<button class="btn btn-primary" onclick={generateChunk} disabled={chunkGenerating}>
			{chunkGenerating ? 'Generating…' : `Generate weeks ${chunkStart}–${chunkEnd}`}
		</button>
		<ModelFeedback usage={chunkUsage} />
		{#if chunkError}<p class="error">{chunkError}</p>{/if}
	</div>

	<div class="toolbar">
		<button class="btn" onclick={() => ensureWeeks(10)}>Ensure 10 weeks</button>
		<button class="btn" onclick={() => ensureWeeks(20)}>Ensure 20 weeks</button>
	</div>

	{#each plan.teachingSequence as week, wi (week.id)}
		<div class="card">
			<h2>Week {week.week.value}</h2>
			{#if week.outlineTheme}
				<FieldEditor label="Outline theme" bind:field={week.outlineTheme} docType="unit-plan" docId={plan.id} levelPlanId={plan.levelPlanId} fieldPath="teachingSequence.{wi}.outlineTheme" />
			{/if}
			<FieldEditor label="Key teaching experiences" bind:field={week.keyTeachingExperiences} docType="unit-plan" docId={plan.id} levelPlanId={plan.levelPlanId} fieldPath="teachingSequence.{wi}.keyTeachingExperiences" />
			<FieldEditor label="Theory" bind:field={week.theory} docType="unit-plan" docId={plan.id} levelPlanId={plan.levelPlanId} fieldPath="teachingSequence.{wi}.theory" />
			<FieldEditor label="Prac" bind:field={week.prac} docType="unit-plan" docId={plan.id} levelPlanId={plan.levelPlanId} fieldPath="teachingSequence.{wi}.prac" />
			<FieldEditor label="Assessment" bind:field={week.assessment} docType="unit-plan" docId={plan.id} levelPlanId={plan.levelPlanId} fieldPath="teachingSequence.{wi}.assessment" />
			<FieldEditor label="Resources" bind:field={week.resources} docType="unit-plan" docId={plan.id} levelPlanId={plan.levelPlanId} fieldPath="teachingSequence.{wi}.resources" />
			<FieldEditor label="Adjustments" bind:field={week.adjustments} docType="unit-plan" docId={plan.id} levelPlanId={plan.levelPlanId} fieldPath="teachingSequence.{wi}.adjustments" />
		</div>
	{/each}
{/if}

{#if section === 'evaluation'}
	<div class="card">
		<FieldEditor label="Evaluation" bind:field={plan.evaluation} docType="unit-plan" docId={plan.id} levelPlanId={plan.levelPlanId} fieldPath="evaluation" rows={6} />
	</div>
{/if}
</div>
