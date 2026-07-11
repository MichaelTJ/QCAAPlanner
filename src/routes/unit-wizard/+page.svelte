<script lang="ts">
	import type { PageData } from './$types';
	import {
		ASSESSMENT_MODES,
		ASSESSMENT_TECHNIQUES,
		STANDALONE_LEVEL_PLAN_ID,
		createId
	} from '$lib/defaults';
	import { seedUnitPlanFromLevelPlan } from '$lib/plan-sync';
	import {
		aiField,
		type AssessmentMode,
		type AssessmentTechnique,
		type LevelPlan,
		type UnitAssessment,
		type UnitAssessmentContentDescription,
		type UnitPlan
	} from '$lib/types';
	import type { GenerationUsage } from '$lib/gemini-models';
	import ModelFeedback from '$lib/components/ModelFeedback.svelte';
	import {
		resolveWizardPlanType,
		subjectLabelForPlanType,
		yearLevelForBand,
		type WizardSubjectFamily,
		type WizardYearBand
	} from '$lib/unit-wizard-client';
	import { durationFromWeekCount } from '$lib/unit-duration';

	let { data }: { data: PageData } = $props();

	type Step = 'idea' | 'draft' | 'descriptors' | 'assessments' | 'finish';
	const STEPS: { id: Step; label: string }[] = [
		{ id: 'idea', label: 'Idea' },
		{ id: 'draft', label: 'Draft unit' },
		{ id: 'descriptors', label: 'Content' },
		{ id: 'assessments', label: 'Assessments' },
		{ id: 'finish', label: 'Finish' }
	];

	const WEEK_OPTIONS = [3, 4, 5, 6, 7, 8, 9, 10];
	const ASSESSMENT_COUNT_OPTIONS = [1, 2, 3, 4];

	interface WizardAssessment {
		id: string;
		title: string;
		description: string;
		technique: AssessmentTechnique | '';
		mode: AssessmentMode | '';
		contentCodes: string[];
	}

	interface PickerDescriptor {
		id: string;
		strand: string;
		subStrand: string;
		text: string;
		code: string;
	}

	const prefill = data.prefill;
	const slotLocked = Boolean(prefill);

	let step = $state<Step>('idea');
	let idea = $state(prefill?.idea || '');
	let subjectFamily = $state<WizardSubjectFamily | ''>(prefill?.subjectFamily || '');
	let yearBand = $state<WizardYearBand | ''>(prefill?.yearBand || '');
	let durationWeeks = $state(
		prefill?.durationWeeks && prefill.durationWeeks > 0 ? prefill.durationWeeks : 5
	);
	let unitTitle = $state(prefill?.slotTitle || '');
	let unitDescription = $state('');
	let selectedCodes = $state<string[]>([]);
	let assessmentCount = $state(2);
	let assessments = $state<WizardAssessment[]>([]);
	let createItems = $state(true);

	const weekSelectOptions = $derived(
		WEEK_OPTIONS.includes(durationWeeks)
			? WEEK_OPTIONS
			: [...WEEK_OPTIONS, durationWeeks].sort((a, b) => a - b)
	);

	let busy = $state(false);
	let errorMessage = $state('');
	let usage = $state<GenerationUsage | null>(null);
	let saving = $state(false);

	const planType = $derived(
		subjectFamily && yearBand ? resolveWizardPlanType(subjectFamily, yearBand) : null
	);

	const curriculum = $derived(
		planType ? data.planTypes.find((p) => p.id === planType) ?? null : null
	);

	const pickerDescriptors = $derived.by((): PickerDescriptor[] => {
		if (!curriculum) return [];
		return curriculum.contentDescriptors.map((cd) => {
			const isCategory =
				cd.category === 'Knowledge and understanding' ||
				cd.category === 'Processes and production skills';
			return {
				id: cd.id,
				strand: isCategory ? cd.category : cd.strand || cd.category,
				subStrand: isCategory ? cd.strand : cd.subStrand,
				text: cd.text,
				code: cd.code || cd.id
			};
		});
	});

	const selectedDescriptors = $derived(
		pickerDescriptors.filter((d) => selectedCodes.includes(d.code))
	);

	const stepIndex = $derived(STEPS.findIndex((s) => s.id === step));

	function canProceedFromIdea() {
		return Boolean(idea.trim() && planType && durationWeeks > 0);
	}

	function canProceedFromDraft() {
		return Boolean(unitTitle.trim() && unitDescription.trim());
	}

	function canProceedFromDescriptors() {
		return selectedCodes.length > 0;
	}

	function canProceedFromAssessments() {
		return (
			assessments.length > 0 &&
			assessments.every((a) => a.title.trim() && a.technique && a.mode)
		);
	}

	function goNext() {
		errorMessage = '';
		if (step === 'idea' && !canProceedFromIdea()) {
			errorMessage = 'Enter an idea, choose subject and year band, and set duration.';
			return;
		}
		if (step === 'draft' && !canProceedFromDraft()) {
			errorMessage = 'Add a unit title and description before continuing.';
			return;
		}
		if (step === 'descriptors' && !canProceedFromDescriptors()) {
			errorMessage = 'Select at least one content descriptor.';
			return;
		}
		if (step === 'assessments' && !canProceedFromAssessments()) {
			errorMessage = 'Each assessment needs a title, technique, and mode.';
			return;
		}
		const next = STEPS[stepIndex + 1];
		if (next) {
			if (next.id === 'assessments' && assessments.length !== assessmentCount) {
				assessments = resizeAssessments(assessments, assessmentCount);
			}
			step = next.id;
		}
	}

	function goBack() {
		errorMessage = '';
		const prev = STEPS[stepIndex - 1];
		if (prev) step = prev.id;
	}

	async function postSuggest(stage: 'draft-unit' | 'suggest-descriptors' | 'suggest-assessments') {
		if (!planType) throw new Error('Choose subject and year band first');
		const res = await fetch('/api/unit-wizard/suggest', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				stage,
				planType,
				idea,
				unitTitle,
				unitDescription,
				durationWeeks,
				assessmentCount,
				selectedDescriptors: selectedDescriptors.map((d) => ({
					code: d.code,
					text: d.text,
					strand: d.strand
				}))
			})
		});
		const body = await res.json().catch(() => ({}));
		if (!res.ok) throw new Error(body.message || 'AI suggestion failed');
		usage = {
			model: body.model,
			modelLabel: body.modelLabel,
			attemptedModels: body.attemptedModels ?? [],
			usedFallback: body.usedFallback ?? false
		};
		return body;
	}

	async function suggestDraft() {
		busy = true;
		errorMessage = '';
		try {
			const body = await postSuggest('draft-unit');
			if (body.unitTitle) unitTitle = body.unitTitle;
			if (body.unitDescription) unitDescription = body.unitDescription;
		} catch (e) {
			errorMessage = e instanceof Error ? e.message : 'Draft failed';
		} finally {
			busy = false;
		}
	}

	async function suggestDescriptorCodes() {
		busy = true;
		errorMessage = '';
		try {
			const body = await postSuggest('suggest-descriptors');
			const codes = Array.isArray(body.codes) ? (body.codes as string[]) : [];
			const allowed = new Set(pickerDescriptors.map((d) => d.code));
			selectedCodes = codes.filter((c) => allowed.has(c));
			if (!selectedCodes.length) {
				errorMessage = 'No matching descriptors were returned. Select some manually.';
			}
		} catch (e) {
			errorMessage = e instanceof Error ? e.message : 'Suggest failed';
		} finally {
			busy = false;
		}
	}

	async function suggestAssessmentRows() {
		busy = true;
		errorMessage = '';
		try {
			const body = await postSuggest('suggest-assessments');
			const rows = Array.isArray(body.assessments) ? body.assessments : [];
			const mapped = rows.map((row: Record<string, unknown>) => ({
				id: createId('wizassess'),
				title: typeof row.title === 'string' ? row.title : '',
				description: typeof row.description === 'string' ? row.description : '',
				technique: (ASSESSMENT_TECHNIQUES as readonly string[]).includes(
					String(row.technique || '')
				)
					? (row.technique as AssessmentTechnique)
					: '',
				mode: (ASSESSMENT_MODES as readonly string[]).includes(String(row.mode || ''))
					? (row.mode as AssessmentMode)
					: '',
				contentCodes: Array.isArray(row.contentCodes)
					? (row.contentCodes as string[]).filter((c) => selectedCodes.includes(c))
					: []
			}));
			assessments = resizeAssessments(mapped, assessmentCount);
		} catch (e) {
			errorMessage = e instanceof Error ? e.message : 'Suggest failed';
		} finally {
			busy = false;
		}
	}

	function emptyAssessment(index: number): WizardAssessment {
		return {
			id: createId('wizassess'),
			title: `Assessment ${index + 1}`,
			description: '',
			technique: 'Project',
			mode: 'Multimodal',
			contentCodes: [...selectedCodes]
		};
	}

	function resizeAssessments(current: WizardAssessment[], count: number): WizardAssessment[] {
		const next = current.slice(0, count);
		while (next.length < count) {
			next.push(emptyAssessment(next.length));
		}
		return next;
	}

	function onAssessmentCountChange(value: number) {
		assessmentCount = value;
		assessments = resizeAssessments(assessments, value);
	}

	function addAssessment() {
		if (assessmentCount >= 4) return;
		onAssessmentCountChange(assessmentCount + 1);
	}

	function removeAssessment(id: string) {
		if (assessments.length <= 1) return;
		assessments = assessments.filter((a) => a.id !== id);
		assessmentCount = assessments.length;
	}

	function toggleCode(code: string, checked: boolean) {
		if (checked) {
			if (!selectedCodes.includes(code)) selectedCodes = [...selectedCodes, code];
		} else {
			selectedCodes = selectedCodes.filter((c) => c !== code);
			assessments = assessments.map((a) => ({
				...a,
				contentCodes: a.contentCodes.filter((c) => c !== code)
			}));
		}
	}

	function toggleAssessmentCode(assessmentId: string, code: string, checked: boolean) {
		assessments = assessments.map((a) => {
			if (a.id !== assessmentId) return a;
			if (checked) {
				return a.contentCodes.includes(code)
					? a
					: { ...a, contentCodes: [...a.contentCodes, code] };
			}
			return { ...a, contentCodes: a.contentCodes.filter((c) => c !== code) };
		});
	}

	function descriptorToUnitCd(code: string): UnitAssessmentContentDescription | null {
		const d = pickerDescriptors.find((row) => row.code === code);
		if (!d) return null;
		return {
			id: createId('ucd'),
			strand: aiField(d.strand),
			subStrand: aiField(d.subStrand),
			text: aiField(d.text),
			code: aiField(d.code)
		};
	}

	function buildAssessmentsForPlan(yearLevel: number): UnitAssessment[] {
		return assessments.map((a, index) => ({
			id: createId('uassess'),
			assessmentNumber: aiField(index + 1),
			yearLevel: aiField(yearLevel),
			title: aiField(a.title.trim()),
			description: aiField(a.description.trim()),
			technique: aiField(a.technique),
			mode: aiField(a.mode),
			conditions: aiField(''),
			timing: aiField(''),
			achievementStandard: aiField(''),
			moderation: aiField(''),
			contentDescriptions: a.contentCodes
				.map(descriptorToUnitCd)
				.filter((cd): cd is UnitAssessmentContentDescription => Boolean(cd))
		}));
	}

	function applyWizardFields(plan: UnitPlan) {
		if (!planType || !yearBand || !subjectFamily) {
			throw new Error('Subject and year band are required');
		}
		const yearLevel = yearLevelForBand(yearBand);
		plan.unitTitle.value = unitTitle.trim();
		plan.unitDescription.value = unitDescription.trim();
		plan.subject.value = subjectLabelForPlanType(planType);
		plan.yearLevel.value = yearLevel;
		plan.duration.value = durationFromWeekCount(durationWeeks);
		plan.status.value = 'Draft';
		plan.assessments = buildAssessmentsForPlan(yearLevel);
	}

	async function saveUnitPlan() {
		saving = true;
		errorMessage = '';
		try {
			if (!planType || !yearBand) throw new Error('Choose subject and year band first');
			if (!canProceedFromAssessments()) {
				throw new Error('Complete assessment details before saving');
			}

			let plan: UnitPlan;
			let levelPlanId: string;

			if (prefill) {
				levelPlanId = prefill.levelPlanId;
				const levelRes = await fetch(`/api/level-plan/${levelPlanId}`);
				const levelPlan = (await levelRes.json()) as LevelPlan & { message?: string };
				if (!levelRes.ok) throw new Error(levelPlan.message || 'Failed to load level plan');

				const res = await fetch(`/api/unit-plan/${levelPlanId}`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ unitNumber: prefill.unitIndex + 1 })
				});
				const created = await res.json();
				if (!res.ok) {
					throw new Error(
						res.status === 409
							? 'A unit plan already exists for this slot.'
							: created.message || 'Failed to create unit'
					);
				}
				seedUnitPlanFromLevelPlan(levelPlan, created, prefill.unitIndex);
				applyWizardFields(created);
				const putRes = await fetch(`/api/unit-plan/${levelPlanId}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(created)
				});
				if (!putRes.ok) {
					await fetch(`/api/unit-plan/${levelPlanId}?unitId=${created.id}&internal=1`, {
						method: 'DELETE'
					});
					const err = await putRes.json().catch(() => ({}));
					throw new Error(err.message || 'Failed to save unit plan');
				}
				plan = await putRes.json();
			} else {
				const res = await fetch('/api/unit-plans', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ title: unitTitle.trim() || undefined })
				});
				const created = await res.json();
				if (!res.ok) throw new Error(created.message || 'Failed to create unit');
				applyWizardFields(created);
				const putRes = await fetch(`/api/unit-plan/${created.levelPlanId}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(created)
				});
				if (!putRes.ok) {
					const err = await putRes.json().catch(() => ({}));
					throw new Error(err.message || 'Failed to save unit plan');
				}
				plan = await putRes.json();
				levelPlanId = plan.levelPlanId || STANDALONE_LEVEL_PLAN_ID;
			}

			let firstItemId: string | null = null;
			if (createItems) {
				for (let i = 0; i < plan.assessments.length; i++) {
					const assess = plan.assessments[i];
					const itemRes = await fetch('/api/assessment-items', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							levelPlanId: plan.levelPlanId,
							unitPlanId: plan.id,
							title: assess.title.value || `Assessment ${i + 1}`,
							assessmentIndex: i
						})
					});
					const item = await itemRes.json();
					if (!itemRes.ok) {
						throw new Error(item.message || 'Failed to create assessment item');
					}
					if (!firstItemId) firstItemId = item.id;
				}
			}

			if (firstItemId) {
				window.location.href = `/assessment-item/${firstItemId}`;
			} else {
				window.location.href = `/level-plan/${plan.levelPlanId}/unit/${plan.id}`;
			}
		} catch (e) {
			errorMessage = e instanceof Error ? e.message : 'Save failed';
			saving = false;
		}
	}
</script>

<div class="toolbar">
	<a class="btn" href={prefill ? `/level-plan/${prefill.levelPlanId}` : '/'}>← Back</a>
	<h1 style="margin:0;flex:1;font-size:1.35rem">Unit wizard</h1>
</div>

{#if prefill}
	<p class="meta" style="margin:0 0 1rem">
		Targeting {prefill.levelPlanTitle || 'level plan'} · Unit {prefill.unitIndex + 1}
		{#if prefill.slotTitle}({prefill.slotTitle}){/if}
	</p>
{/if}

<nav class="wizard-steps" aria-label="Wizard steps">
	{#each STEPS as s, i (s.id)}
		<button
			type="button"
			class:active={step === s.id}
			class:done={i < stepIndex}
			disabled={busy || saving}
			onclick={() => {
				if (i <= stepIndex) step = s.id;
			}}
		>
			<span class="wizard-step-num">{i + 1}</span>
			{s.label}
		</button>
	{/each}
</nav>

{#if errorMessage}
	<p class="error">{errorMessage}</p>
{/if}
<ModelFeedback usage={usage} />

{#if step === 'idea'}
	<div class="card">
		<h2 style="margin-top:0">What's your idea?</h2>
		<p class="meta">Describe the unit in a sentence or two. Choose the subject and year band.</p>
		<label>
			Idea
			<textarea bind:value={idea} rows="5" style="width:100%" placeholder="e.g. Students design and build a simple website for a local community group…"></textarea>
		</label>
		<div class="grid-2" style="margin-top:0.75rem">
			<label>
				Subject
				<select bind:value={subjectFamily} disabled={slotLocked && Boolean(prefill?.subjectFamily)}>
					<option value="">Select…</option>
					<option value="digital">Digital Technologies</option>
					<option value="design">Design and Technologies</option>
					<option value="engineering">Engineering</option>
				</select>
			</label>
			<label>
				Year band
				<select bind:value={yearBand} disabled={slotLocked && Boolean(prefill?.yearBand)}>
					<option value="">Select…</option>
					<option value="7-8">7–8</option>
					<option value="9-10">9–10</option>
					<option value="10">10</option>
				</select>
			</label>
		</div>
		<label style="display:block;margin-top:0.75rem;max-width:12rem">
			Duration (weeks)
			<select bind:value={durationWeeks}>
				{#each weekSelectOptions as weeks}
					<option value={weeks}>{weeks} week{weeks === 1 ? '' : 's'}</option>
				{/each}
			</select>
		</label>
		{#if planType && curriculum}
			<p class="meta" style="margin-top:0.75rem">Curriculum: {curriculum.label}</p>
		{:else if subjectFamily && yearBand}
			<p class="error">That subject and year band combination is not in the catalogue yet.</p>
		{/if}
	</div>
{/if}

{#if step === 'draft'}
	<div class="card">
		<div class="toolbar">
			<h2 style="margin:0;flex:1">Draft the unit</h2>
			<button class="btn btn-primary" onclick={suggestDraft} disabled={busy || !planType}>
				{busy ? 'Working…' : unitTitle || unitDescription ? 'AI redraft' : 'AI draft'}
			</button>
		</div>
		{#if curriculum}
			<details class="meta" style="margin-bottom:0.75rem">
				<summary>Level description context</summary>
				<p style="white-space:pre-wrap">{curriculum.levelDescription}</p>
			</details>
		{/if}
		<label>
			Unit title
			<input type="text" bind:value={unitTitle} style="width:100%" />
		</label>
		<label style="display:block;margin-top:0.75rem">
			Unit description
			<textarea bind:value={unitDescription} rows="8" style="width:100%"></textarea>
		</label>
	</div>
{/if}

{#if step === 'descriptors'}
	<div class="card">
		<div class="toolbar">
			<h2 style="margin:0;flex:1">Content descriptors</h2>
			<button
				class="btn btn-primary"
				onclick={suggestDescriptorCodes}
				disabled={busy || !planType || !unitDescription.trim()}
			>
				{busy ? 'Suggesting…' : 'AI suggest'}
			</button>
		</div>
		<p class="meta">Tick the descriptors this unit will cover. AI can suggest a starting set.</p>
		{#if !pickerDescriptors.length}
			<p class="error">No catalogue descriptors for this subject/band.</p>
		{:else}
			<table class="data-table">
				<thead>
					<tr>
						<th style="width:2.5rem"></th>
						<th>Code</th>
						<th>Strand</th>
						<th>Text</th>
					</tr>
				</thead>
				<tbody>
					{#each pickerDescriptors as cd (cd.id)}
						<tr>
							<td>
								<input
									type="checkbox"
									checked={selectedCodes.includes(cd.code)}
									onchange={(e) => toggleCode(cd.code, e.currentTarget.checked)}
									aria-label="Include {cd.code}"
								/>
							</td>
							<td class="content-code-cell">{cd.code}</td>
							<td>{cd.strand}{cd.subStrand ? ` · ${cd.subStrand}` : ''}</td>
							<td class="content-text-cell">{cd.text}</td>
						</tr>
					{/each}
				</tbody>
			</table>
			<p class="meta">{selectedCodes.length} selected</p>
		{/if}
	</div>
{/if}

{#if step === 'assessments'}
	<div class="card">
		<div class="toolbar">
			<h2 style="margin:0;flex:1">Assessments</h2>
			<button
				class="btn btn-primary"
				onclick={suggestAssessmentRows}
				disabled={busy || !selectedCodes.length}
			>
				{busy ? 'Suggesting…' : 'AI suggest'}
			</button>
		</div>
		<label style="display:block;max-width:14rem;margin:0.75rem 0">
			Number of assessments
			<select
				value={assessmentCount}
				onchange={(e) => onAssessmentCountChange(Number(e.currentTarget.value))}
			>
				{#each ASSESSMENT_COUNT_OPTIONS as n}
					<option value={n}>{n}</option>
				{/each}
			</select>
		</label>
		<p class="meta">
			Propose assessment titles, techniques, and which selected descriptors each assessment covers.
		</p>
	</div>

	{#each assessments as assess (assess.id)}
		<div class="card">
			<div class="toolbar">
				<input
					type="text"
					bind:value={assess.title}
					placeholder="Assessment title"
					style="flex:1;font-weight:600"
				/>
				<button class="btn btn-sm" onclick={() => removeAssessment(assess.id)}>Remove</button>
			</div>
			<label style="display:block;margin-top:0.5rem">
				Description
				<textarea bind:value={assess.description} rows="4" style="width:100%"></textarea>
			</label>
			<div class="grid-2" style="margin-top:0.5rem">
				<label>
					Technique
					<select bind:value={assess.technique}>
						<option value="">Select…</option>
						{#each ASSESSMENT_TECHNIQUES as t}
							<option value={t}>{t}</option>
						{/each}
					</select>
				</label>
				<label>
					Mode
					<select bind:value={assess.mode}>
						<option value="">Select…</option>
						{#each ASSESSMENT_MODES as m}
							<option value={m}>{m}</option>
						{/each}
					</select>
				</label>
			</div>
			{#if selectedDescriptors.length}
				<table class="data-table" style="margin-top:0.75rem">
					<thead>
						<tr>
							<th style="width:2.5rem"></th>
							<th>Code</th>
							<th>Text</th>
						</tr>
					</thead>
					<tbody>
						{#each selectedDescriptors as cd (cd.code)}
							<tr>
								<td>
									<input
										type="checkbox"
										checked={assess.contentCodes.includes(cd.code)}
										onchange={(e) =>
											toggleAssessmentCode(assess.id, cd.code, e.currentTarget.checked)}
										aria-label="{assess.title || 'Assessment'} includes {cd.code}"
									/>
								</td>
								<td class="content-code-cell">{cd.code}</td>
								<td class="content-text-cell">{cd.text}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</div>
	{/each}
{/if}

{#if step === 'finish'}
	<div class="card">
		<h2 style="margin-top:0">Save this unit</h2>
		<p>
			<strong>{unitTitle || 'Untitled unit'}</strong>
			{#if curriculum}
				<span class="meta"> · {curriculum.label}</span>
			{/if}
		</p>
		<p class="meta">
			{durationWeeks} week{durationWeeks === 1 ? '' : 's'} ·
			{assessments.length} assessment{assessments.length === 1 ? '' : 's'} ·
			{selectedCodes.length} content descriptor{selectedCodes.length === 1 ? '' : 's'}
			{#if prefill}
				· Slot {prefill.unitIndex + 1} on {prefill.levelPlanTitle || 'level plan'}
			{:else}
				· Standalone unit plan
			{/if}
		</p>
		<label style="display:flex;align-items:center;gap:0.5rem;margin:1rem 0">
			<input type="checkbox" bind:checked={createItems} />
			Also create assessment item instruments for each assessment
		</label>
		<button class="btn btn-primary" onclick={saveUnitPlan} disabled={saving}>
			{saving ? 'Saving…' : createItems ? 'Save unit & create items' : 'Save unit plan'}
		</button>
	</div>
{/if}

<div class="toolbar" style="margin-top:1rem">
	<button class="btn" onclick={goBack} disabled={stepIndex === 0 || busy || saving}>Back</button>
	{#if step !== 'finish'}
		<button class="btn btn-primary" onclick={goNext} disabled={busy || saving}>Next</button>
	{/if}
</div>

<style>
	.wizard-steps {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		margin-bottom: 1rem;
	}

	.wizard-steps button {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.4rem 0.7rem;
		border: 1px solid #c5d0dc;
		border-radius: 6px;
		background: #fff;
		font: inherit;
		font-size: 0.9rem;
		cursor: pointer;
		color: inherit;
	}

	.wizard-steps button.active {
		border-color: #1e3a5f;
		background: #eef2f6;
		font-weight: 600;
	}

	.wizard-steps button.done {
		border-color: #9db0c4;
	}

	.wizard-step-num {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.35rem;
		height: 1.35rem;
		border-radius: 999px;
		background: #1e3a5f;
		color: #fff;
		font-size: 0.75rem;
		font-weight: 700;
	}

	label {
		display: block;
		font-size: 0.9rem;
		font-weight: 600;
	}

	label :global(input),
	label :global(textarea),
	label :global(select),
	.card input[type='text'],
	.card select,
	.card textarea {
		margin-top: 0.25rem;
		font: inherit;
		font-weight: 400;
	}

	select {
		width: 100%;
		padding: 0.4rem 0.5rem;
		border: 1px solid #c5d0dc;
		border-radius: 4px;
	}

	input[type='text'] {
		padding: 0.4rem 0.5rem;
		border: 1px solid #c5d0dc;
		border-radius: 4px;
	}
</style>
