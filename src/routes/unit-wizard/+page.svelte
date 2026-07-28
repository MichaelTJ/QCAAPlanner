<script lang="ts">
	import type { PageData } from './$types';
	import {
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
	import { getAchievementStandardForPlanType } from '$lib/curriculum/curriculum-catalogue';
	import { durationFromWeekCount } from '$lib/unit-duration';

	let { data }: { data: PageData } = $props();

	type Step = 'brief' | 'descriptors' | 'finish';
	const STEPS: { id: Step; label: string }[] = [
		{ id: 'brief', label: 'Brief' },
		{ id: 'descriptors', label: 'Content' },
		{ id: 'finish', label: 'Finish' }
	];

	const WEEK_OPTIONS = [3, 4, 5, 6, 7, 8, 9, 10];
	const ASSESSMENT_COUNT_OPTIONS = [1, 2, 3, 4];
	const WIZARD_PIPELINE_KEY = (unitId: string) => `qcaa-wizard-pipeline:${unitId}`;
	const weekOutlinePlaceholder = 'Week 1: …\nWeek 2: …\nWeek 3: …';

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

	let step = $state<Step>('brief');
	let idea = $state(prefill?.idea || '');
	let subjectFamily = $state<WizardSubjectFamily | ''>(prefill?.subjectFamily || '');
	let yearBand = $state<WizardYearBand | ''>(prefill?.yearBand || '');
	let durationWeeks = $state(
		prefill?.durationWeeks && prefill.durationWeeks > 0 ? prefill.durationWeeks : 10
	);
	let unitTitle = $state(prefill?.slotTitle || '');
	let unitDescription = $state('');
	let weekOutline = $state('');
	let selectedCodes = $state<string[]>([]);
	let assessmentCount = $state(2);
	let assessments = $state<WizardAssessment[]>([
		{
			id: createId('wizassess'),
			title: 'Assessment 1',
			description: '',
			technique: 'Project',
			mode: 'Multimodal',
			contentCodes: []
		},
		{
			id: createId('wizassess'),
			title: 'Assessment 2',
			description: '',
			technique: 'Project',
			mode: 'Multimodal',
			contentCodes: []
		}
	]);
	let createItems = $state(true);
	let autoGeneratePipeline = $state(true);
	let destinationMode = $state<'standalone' | 'level-plan'>(
		prefill ? 'level-plan' : 'standalone'
	);
	let destinationLevelPlanId = $state(prefill?.levelPlanId || '');

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

	const compatibleLevelPlans = $derived(
		planType
			? data.levelPlanOptions.filter((p) => p.curriculumPlanType === planType)
			: data.levelPlanOptions
	);

	const selectedDestination = $derived(
		compatibleLevelPlans.find((p) => p.id === destinationLevelPlanId) ?? null
	);

	const effectiveDestinationId = $derived(selectedDestination?.id ?? '');

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

	function canProceedFromBrief() {
		return Boolean(
			idea.trim() &&
				planType &&
				durationWeeks > 0 &&
				unitTitle.trim() &&
				unitDescription.trim() &&
				assessments.length > 0 &&
				assessments.every((a) => a.title.trim())
		);
	}

	function canProceedFromDescriptors() {
		return selectedCodes.length > 0;
	}

	function assessmentsReadyToSave() {
		return (
			assessments.length > 0 &&
			assessments.every(
				(a) => a.title.trim() && a.technique && a.mode && a.contentCodes.length > 0
			)
		);
	}

	/** Carry Content-step selections onto assessments so criteria aren't blank by default. */
	function applySelectedCodesToAssessments() {
		assessments = resizeAssessments(assessments, assessmentCount).map((a) => {
			const kept = a.contentCodes.filter((code) => selectedCodes.includes(code));
			return {
				...a,
				technique: a.technique || 'Project',
				mode: a.mode || 'Multimodal',
				contentCodes: kept.length > 0 ? kept : [...selectedCodes]
			};
		});
	}

	function goNext() {
		errorMessage = '';
		if (step === 'brief' && !canProceedFromBrief()) {
			errorMessage =
				'Enter an idea, subject, year band, duration, unit title, unit description, and assessment titles.';
			return;
		}
		if (step === 'descriptors' && !canProceedFromDescriptors()) {
			errorMessage = 'Select at least one content descriptor.';
			return;
		}
		const next = STEPS[stepIndex + 1];
		if (next) {
			if (step === 'brief') {
				assessments = resizeAssessments(assessments, assessmentCount);
			}
			if (step === 'descriptors') {
				applySelectedCodesToAssessments();
			}
			step = next.id;
		}
	}

	function goBack() {
		errorMessage = '';
		const prev = STEPS[stepIndex - 1];
		if (prev) step = prev.id;
	}

	async function postSuggest(stage: 'draft-unit' | 'suggest-descriptors') {
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
		const achievementStandard = planType
			? getAchievementStandardForPlanType(planType)
			: '';
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
			achievementStandard: aiField(achievementStandard),
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

	async function createUnitOnLevelPlan(levelPlanId: string, unitIndex: number): Promise<UnitPlan> {
		const levelRes = await fetch(`/api/level-plan/${levelPlanId}`);
		const levelPlan = (await levelRes.json()) as LevelPlan & { message?: string };
		if (!levelRes.ok) throw new Error(levelPlan.message || 'Failed to load level plan');

		const res = await fetch(`/api/unit-plan/${levelPlanId}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ unitNumber: unitIndex + 1 })
		});
		const created = await res.json();
		if (!res.ok) {
			throw new Error(
				res.status === 409
					? 'A unit plan already exists for this slot.'
					: created.message || 'Failed to create unit'
			);
		}
		seedUnitPlanFromLevelPlan(levelPlan, created, unitIndex);
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
		return putRes.json();
	}

	async function saveUnitPlan() {
		saving = true;
		errorMessage = '';
		try {
			if (!planType || !yearBand) throw new Error('Choose subject and year band first');
			applySelectedCodesToAssessments();
			if (!assessmentsReadyToSave()) {
				throw new Error(
					'Each assessment needs a title and at least one content descriptor before saving'
				);
			}

			let plan: UnitPlan;

			if (prefill) {
				plan = await createUnitOnLevelPlan(prefill.levelPlanId, prefill.unitIndex);
			} else if (destinationMode === 'level-plan') {
				if (!effectiveDestinationId) {
					throw new Error('Choose a level band plan to add this unit to');
				}
				const slotRes = await fetch(`/api/level-plan/${effectiveDestinationId}/units`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						title: unitTitle.trim() || undefined,
						reuseEmptySlot: true
					})
				});
				const slotBody = await slotRes.json();
				if (!slotRes.ok) {
					throw new Error(slotBody.message || 'Failed to reserve a unit slot on the level plan');
				}
				const unitIndex = Number(slotBody.unitIndex);
				if (!Number.isInteger(unitIndex) || unitIndex < 0) {
					throw new Error('Level plan did not return a valid unit slot');
				}
				plan = await createUnitOnLevelPlan(effectiveDestinationId, unitIndex);
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

			if (autoGeneratePipeline) {
				try {
					sessionStorage.setItem(
						WIZARD_PIPELINE_KEY(plan.id),
						JSON.stringify({ weekOutline })
					);
				} catch {
					/* sessionStorage may be unavailable */
				}
				window.location.href = `/level-plan/${plan.levelPlanId}/unit/${plan.id}?autoGenerate=1`;
			} else if (firstItemId) {
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

{#if step === 'brief'}
	<div class="card">
		<h2 style="margin-top:0">Unit brief</h2>
		<p class="meta">
			Capture the idea, subject context, draft unit text, assessments, and a rough week outline.
		</p>
		<label>
			Idea
			<textarea
				bind:value={idea}
				rows="5"
				style="width:100%"
				placeholder="e.g. Students design and build a simple website for a local community group…"
			></textarea>
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

	<div class="card">
		<div class="toolbar">
			<h2 style="margin:0;flex:1">Unit title &amp; description</h2>
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

	<div class="card">
		<h2 style="margin-top:0">Assessments</h2>
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
			Add titles and descriptions now. Technique, mode, and content codes are set on the Assessments
			step.
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
				<button
					class="btn btn-sm"
					onclick={() => removeAssessment(assess.id)}
					disabled={assessments.length <= 1}
				>
					Remove
				</button>
			</div>
			<label style="display:block;margin-top:0.5rem">
				Description
				<textarea bind:value={assess.description} rows="4" style="width:100%"></textarea>
			</label>
		</div>
	{/each}

	<div class="card">
		<label>
			{durationWeeks}-week outline
			<textarea
				bind:value={weekOutline}
				rows="10"
				style="width:100%"
				placeholder={weekOutlinePlaceholder}
			></textarea>
		</label>
		<p class="meta" style="margin-top:0.5rem">
			Paste your rough week-by-week plan here. When auto-generate is on, this is used as the AI notes
			for Teaching Sequence → Unit outline (planning pass).
		</p>
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
		<p class="meta">
			Tick the descriptors this unit will cover. They are applied to every assessment when you continue.
			AI can suggest a starting set.
		</p>
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
		</p>

		{#if prefill}
			<p class="meta">
				Slot {prefill.unitIndex + 1} on {prefill.levelPlanTitle || 'level plan'}
			</p>
		{:else}
			<fieldset class="destination-fieldset">
				<legend>Where should this unit go?</legend>
				<label class="destination-option">
					<input type="radio" bind:group={destinationMode} value="standalone" />
					<span>
						<strong>Standalone</strong>
						<span class="meta">Keep it unattached; you can add it to a level plan later.</span>
					</span>
				</label>
				<label class="destination-option">
					<input
						type="radio"
						bind:group={destinationMode}
						value="level-plan"
						disabled={!compatibleLevelPlans.length}
					/>
					<span>
						<strong>Existing level band plan</strong>
						<span class="meta">
							{#if compatibleLevelPlans.length}
								Uses an empty slot if available, otherwise adds a new unit column.
							{:else}
								No level plans match this subject and year band yet.
							{/if}
						</span>
					</span>
				</label>
				{#if destinationMode === 'level-plan'}
					<label style="display:block;margin-top:0.75rem;max-width:28rem">
						Level band plan
						<select bind:value={destinationLevelPlanId}>
							<option value="">Select…</option>
							{#each compatibleLevelPlans as plan}
								<option value={plan.id}>
									{plan.title}
									({plan.emptySlotCount} empty · {plan.unitCount} units)
								</option>
							{/each}
						</select>
					</label>
					{#if selectedDestination}
						<p class="meta" style="margin-top:0.5rem">
							{selectedDestination.learningAreaSubject}
							· {selectedDestination.yearLevelBand}
						</p>
					{/if}
				{/if}
			</fieldset>
		{/if}

		<label style="display:flex;align-items:center;gap:0.5rem;margin:1rem 0">
			<input type="checkbox" bind:checked={createItems} />
			Also create assessment item instruments for each assessment
		</label>
		<label style="display:flex;align-items:flex-start;gap:0.5rem;margin:0 0 1rem">
			<input type="checkbox" bind:checked={autoGeneratePipeline} style="margin-top:0.2rem" />
			<span>
				After save, auto-generate cohort, conditions, moderation, capabilities, and teaching
				sequence
				<span class="meta" style="display:block;font-weight:400">
					Opens the unit plan and runs the AI pipeline (uses your week outline for the planning
					pass).
				</span>
			</span>
		</label>
		<button
			class="btn btn-primary"
			onclick={saveUnitPlan}
			disabled={saving ||
				(!prefill && destinationMode === 'level-plan' && !effectiveDestinationId)}
		>
			{saving
				? 'Saving…'
				: autoGeneratePipeline
					? 'Save & auto-generate'
					: createItems
						? 'Save unit & create items'
						: 'Save unit plan'}
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

	.destination-fieldset {
		margin: 1rem 0 0;
		padding: 0.85rem 1rem;
		border: 1px solid #c5d0dc;
		border-radius: 6px;
	}

	.destination-fieldset legend {
		padding: 0 0.35rem;
		font-size: 0.9rem;
		font-weight: 600;
	}

	.destination-option {
		display: flex;
		align-items: flex-start;
		gap: 0.6rem;
		margin-top: 0.65rem;
		font-weight: 400;
	}

	.destination-option span {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}
</style>
