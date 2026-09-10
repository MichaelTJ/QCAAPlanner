<script lang="ts">
	import type {
		LessonActivity,
		LessonActivityStage,
		LessonEnhancePath,
		LessonPlan,
		TeachingWeek,
		UnitPlan
	} from '$lib/types';
	import type { GenerationUsage } from '$lib/gemini-models';
	import ModelFeedback from '$lib/components/ModelFeedback.svelte';
	import {
		createId,
		LESSONS_PER_WEEK,
		LESSON_DURATION_MINUTES,
		LESSON_ACTIVITY_MAX_MINUTES
	} from '$lib/defaults';
	import { resolve } from '$app/paths';
	import {
		WORKBOOK_ACTIVITY_CATALOG,
		WORKBOOK_ACTIVITY_KINDS,
		type WorkbookActivityKind
	} from '$lib/workbook/types';
	import { parseWorkbookActivity } from '$lib/workbook/parse';

	interface Props {
		plan: UnitPlan;
		/** True when outline/weekly generation is running on parent */
		parentBusy?: boolean;
		onBusyChange?: (busy: boolean) => void;
	}

	let { plan = $bindable(), parentBusy = false, onBusyChange }: Props = $props();

	const BATCH_CHUNK_RETRIES = 3;

	const ENHANCE_PATHS: { value: LessonEnhancePath; label: string }[] = [
		{ value: 'skill-building', label: 'Skill-building' },
		{ value: 'knowledge-building', label: 'Knowledge-building' }
	];

	const ACTIVITY_STAGES: { value: LessonActivityStage; label: string }[] = [
		{ value: 'i-do', label: 'I do' },
		{ value: 'we-do', label: 'We do' },
		{ value: 'you-do', label: 'You do' },
		{ value: 'vocabulary', label: 'Vocabulary' },
		{ value: 'guided-notes', label: 'Guided notes' },
		{ value: 'generative', label: 'Generative' }
	];

	let generating = $state(false);
	let status = $state('');
	let error = $state('');
	let usage = $state<GenerationUsage | null>(null);
	let finished = $state(false);
	let aiNotes = $state('');

	let rangeStart = $state(1);
	let rangeEnd = $state(3);
	let rangeNotes = $state('');
	let rangeStatus = $state('');
	let rangeError = $state('');
	let rangeUsage = $state<GenerationUsage | null>(null);
	let rangeFinished = $state(false);

	let generatingLessonId = $state<string | null>(null);
	let runMode = $state<'idle' | 'all' | 'range' | 'lesson' | 'enrich-all' | 'enrich-range' | 'enrich-lesson'>(
		'idle'
	);
	let lessonError = $state('');

	let enrichNotes = $state('');
	let enrichStatus = $state('');
	let enrichError = $state('');
	let enrichUsage = $state<GenerationUsage | null>(null);
	let enrichFinished = $state(false);
	let enrichRangeStart = $state(1);
	let enrichRangeEnd = $state(3);
	let enrichRangeNotes = $state('');
	let enrichRangeStatus = $state('');
	let enrichRangeError = $state('');
	let enrichRangeUsage = $state<GenerationUsage | null>(null);
	let enrichRangeFinished = $state(false);

	const busy = $derived(parentBusy || generating);
	const hasWeeks = $derived(plan.teachingSequence.length > 0);
	const hasWeeklyDetail = $derived(
		plan.teachingSequence.some((week) =>
			[
				week.keyTeachingExperiences?.value,
				week.theory?.value,
				week.prac?.value,
				week.assessment?.value,
				week.resources?.value
			].some((value) => String(value ?? '').trim() !== '')
		)
	);
	const canGenerateAll = $derived(hasWeeks && hasWeeklyDetail && !busy);
	const hasAnyLessons = $derived(
		plan.teachingSequence.some((week) => (week.lessons?.length ?? 0) > 0)
	);

	function weekNumberOf(week: TeachingWeek): number {
		return Number(week.week.value);
	}

	function findWeek(weekNumber: number): TeachingWeek | undefined {
		return plan.teachingSequence.find((week) => weekNumberOf(week) === weekNumber);
	}

	function touchSequence() {
		plan.teachingSequence = plan.teachingSequence.slice();
	}

	function pathLabel(path: LessonEnhancePath): string {
		return ENHANCE_PATHS.find((row) => row.value === path)?.label ?? path;
	}

	function sortedLessons(week: TeachingWeek): LessonPlan[] {
		return [...(week.lessons ?? [])].sort((a, b) => a.lessonNumber - b.lessonNumber);
	}

	function emptyActivity(path: LessonEnhancePath): LessonActivity {
		return {
			id: createId('lact'),
			minutes: 10,
			timeLabel: '',
			title: '',
			stage: path === 'knowledge-building' ? 'guided-notes' : 'we-do',
			teacherDoes: '',
			studentsDo: '',
			visibleInstructions: '',
			questioning: '',
			scaffolding: '',
			eLearning: '',
			transition: '',
			workbookKind: undefined,
			workbookSpec: undefined,
			workbookMaterials: '',
			teacherAnswerKey: ''
		};
	}

	function workbookSpecText(activity: LessonActivity): string {
		if (!activity.workbookSpec) return '';
		try {
			return JSON.stringify(activity.workbookSpec, null, 2);
		} catch {
			return '';
		}
	}

	function setWorkbookKind(activity: LessonActivity, value: string) {
		activity.workbookKind = (WORKBOOK_ACTIVITY_KINDS as readonly string[]).includes(value)
			? (value as WorkbookActivityKind)
			: undefined;
	}

	function setWorkbookSpecFromJson(activity: LessonActivity, raw: string) {
		const trimmed = raw.trim();
		if (!trimmed) {
			activity.workbookSpec = undefined;
			return;
		}
		try {
			const parsed = parseWorkbookActivity(JSON.parse(trimmed));
			activity.workbookSpec = parsed ?? undefined;
		} catch {
			// Keep typing; leave previous spec until valid JSON is entered.
		}
	}

	function clearAllLessons() {
		if (!hasAnyLessons) return;
		if (
			!confirm(
				'Clear all lesson plans? This removes every ASPIRE lesson from all weeks. Weekly detail is kept.'
			)
		) {
			return;
		}
		for (const week of plan.teachingSequence) {
			week.lessons = [];
		}
		finished = false;
		error = '';
		usage = null;
		status = '';
		rangeFinished = false;
		rangeError = '';
		rangeUsage = null;
		rangeStatus = '';
		lessonError = '';
		enrichFinished = false;
		enrichError = '';
		enrichUsage = null;
		enrichStatus = '';
		enrichRangeFinished = false;
		enrichRangeError = '';
		enrichRangeUsage = null;
		enrichRangeStatus = '';
		touchSequence();
	}

	function addActivity(lesson: LessonPlan) {
		if (!lesson.enhance) lesson.enhance = { activities: [] };
		lesson.enhance.activities.push(emptyActivity(lesson.enhancePath));
		touchSequence();
	}

	function removeActivity(lesson: LessonPlan, activityId: string) {
		lesson.enhance.activities = lesson.enhance.activities.filter((row) => row.id !== activityId);
		touchSequence();
	}

	function unitSnapshot() {
		return {
			unitTitle: String(plan.unitTitle.value),
			description: String(plan.unitDescription.value),
			assessments: plan.assessments.map((assess) => ({
				title: String(assess.title.value),
				description: String(assess.description.value),
				timing: String(assess.timing.value),
				technique: String(assess.technique.value)
			}))
		};
	}

	function weekContext(week: TeachingWeek) {
		return {
			week: week.week.value,
			outlineTheme: String(week.outlineTheme?.value ?? ''),
			keyTeachingExperiences: String(week.keyTeachingExperiences?.value ?? ''),
			theory: String(week.theory?.value ?? ''),
			prac: String(week.prac?.value ?? ''),
			assessment: String(week.assessment?.value ?? ''),
			resources: String(week.resources?.value ?? '')
		};
	}

	function collectPriorLessons(weekNumber: number) {
		const prior: Array<{
			week: number;
			lessonNumber: number;
			title: string;
			learningGoal: string;
		}> = [];
		for (const week of plan.teachingSequence) {
			const num = weekNumberOf(week);
			if (Number.isNaN(num) || num >= weekNumber) continue;
			for (const lesson of sortedLessons(week)) {
				prior.push({
					week: num,
					lessonNumber: lesson.lessonNumber,
					title: lesson.title,
					learningGoal: lesson.learningGoal
				});
			}
		}
		return prior;
	}

	function nextWeekOutlineTheme(weekNumber: number): string | undefined {
		const next = findWeek(weekNumber + 1);
		const theme = String(next?.outlineTheme?.value ?? '').trim();
		return theme || undefined;
	}

	function applyLessons(weekNumber: number, lessons: LessonPlan[]) {
		const week = findWeek(weekNumber);
		if (!week) return;
		if (!Array.isArray(lessons) || lessons.length === 0) {
			throw new Error(`No lessons returned for week ${weekNumber}`);
		}
		week.lessons = lessons;
		touchSequence();
	}

	function usageFrom(data: {
		model?: string;
		modelLabel?: string;
		attemptedModels?: GenerationUsage['attemptedModels'];
		usedFallback?: boolean;
	}): GenerationUsage {
		return {
			model: data.model ?? '',
			modelLabel: data.modelLabel ?? '',
			attemptedModels: data.attemptedModels ?? [],
			usedFallback: data.usedFallback ?? false
		};
	}

	function setBusy(value: boolean) {
		generating = value;
		onBusyChange?.(value);
	}

	async function requestWeekLessons(opts: {
		weekNumber: number;
		aiNotes: string;
		mode?: 'generate' | 'enrich';
		lessonNumber?: number;
		enhancePath?: LessonEnhancePath;
		existingLessons?: LessonPlan[];
	}): Promise<{ ok: true; lessons: LessonPlan[]; usage: GenerationUsage } | { ok: false; error: string }> {
		const week = findWeek(opts.weekNumber);
		if (!week) return { ok: false, error: `Week ${opts.weekNumber} not found` };

		const nextTheme = nextWeekOutlineTheme(opts.weekNumber);
		try {
			const res = await fetch('/api/generate/lessons', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					levelPlanId: plan.levelPlanId,
					unitId: plan.id,
					weekNumber: opts.weekNumber,
					aiNotes: opts.aiNotes,
					mode: opts.mode ?? 'generate',
					...(opts.lessonNumber != null ? { lessonNumber: opts.lessonNumber } : {}),
					...(opts.enhancePath ? { enhancePath: opts.enhancePath } : {}),
					unitSnapshot: unitSnapshot(),
					weekContext: weekContext(week),
					...(nextTheme ? { nextWeekOutlineTheme: nextTheme } : {}),
					priorLessons: collectPriorLessons(opts.weekNumber),
					existingLessons: opts.existingLessons ?? week.lessons ?? []
				})
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.message || 'Lesson generation failed');
			if (!Array.isArray(data.lessons) || data.lessons.length === 0) {
				throw new Error('Lesson response did not include any lessons');
			}
			return {
				ok: true,
				lessons: data.lessons as LessonPlan[],
				usage: usageFrom(data)
			};
		} catch (e) {
			return {
				ok: false,
				error: e instanceof Error ? e.message : 'Lesson generation failed'
			};
		}
	}

	async function generateWeekWithRetries(
		weekNumber: number,
		notes: string,
		setStatus: (value: string) => void,
		extra:
			| {
					mode?: 'generate' | 'enrich';
					lessonNumber?: number;
					enhancePath?: LessonEnhancePath;
					existingLessons?: LessonPlan[];
			  }
			| undefined = undefined
	) {
		const verb = extra?.mode === 'enrich' ? 'Enriching' : 'Generating';
		let lastError = '';
		for (let attempt = 1; attempt <= BATCH_CHUNK_RETRIES; attempt++) {
			setStatus(
				attempt === 1
					? `${verb} week ${weekNumber}…`
					: `${verb} week ${weekNumber}… (retry ${attempt}/${BATCH_CHUNK_RETRIES})`
			);
			const result = await requestWeekLessons({
				weekNumber,
				aiNotes: notes,
				...extra
			});
			if (result.ok) {
				try {
					applyLessons(weekNumber, result.lessons);
					return result;
				} catch (e) {
					lastError = e instanceof Error ? e.message : 'Failed to apply lessons';
					continue;
				}
			}
			lastError = result.error;
		}
		return { ok: false as const, error: lastError };
	}

	async function generateAllWeeks() {
		if (!hasWeeks || !hasWeeklyDetail || busy) return;
		runMode = 'all';
		setBusy(true);
		finished = false;
		error = '';
		usage = null;
		status = '';
		lessonError = '';
		try {
			for (const week of plan.teachingSequence) {
				const weekNumber = weekNumberOf(week);
				if (Number.isNaN(weekNumber) || weekNumber <= 0) continue;
				const result = await generateWeekWithRetries(weekNumber, aiNotes, (value) => (status = value));
				if (!result.ok) {
					error = result.error;
					status = `Stopped at week ${weekNumber} after ${BATCH_CHUNK_RETRIES} attempts`;
					return;
				}
				usage = result.usage;
			}
			finished = true;
			status = 'Finished';
		} finally {
			runMode = 'idle';
			setBusy(false);
		}
	}

	async function generateWeekRange() {
		if (!hasWeeklyDetail || busy) return;
		const from = Math.min(Number(rangeStart) || 1, Number(rangeEnd) || 1);
		const to = Math.max(Number(rangeStart) || 1, Number(rangeEnd) || 1);
		const targets = plan.teachingSequence
			.map(weekNumberOf)
			.filter((num) => !Number.isNaN(num) && num >= from && num <= to)
			.sort((a, b) => a - b);

		if (!targets.length) {
			rangeError = `No teaching weeks found in range ${from}–${to}.`;
			return;
		}

		runMode = 'range';
		setBusy(true);
		rangeFinished = false;
		rangeError = '';
		rangeUsage = null;
		rangeStatus = '';
		error = '';
		lessonError = '';
		try {
			for (const weekNumber of targets) {
				const result = await generateWeekWithRetries(
					weekNumber,
					rangeNotes,
					(value) => (rangeStatus = value)
				);
				if (!result.ok) {
					rangeError = result.error;
					rangeStatus = `Stopped at week ${weekNumber} after ${BATCH_CHUNK_RETRIES} attempts`;
					return;
				}
				rangeUsage = result.usage;
			}
			rangeFinished = true;
			rangeStatus = 'Finished';
		} finally {
			runMode = 'idle';
			setBusy(false);
		}
	}

	async function regenerateLesson(week: TeachingWeek, lesson: LessonPlan) {
		if (busy) return;
		const weekNumber = weekNumberOf(week);
		if (Number.isNaN(weekNumber) || weekNumber <= 0) {
			lessonError = 'This week has no valid week number.';
			return;
		}

		runMode = 'lesson';
		setBusy(true);
		generatingLessonId = lesson.id;
		lessonError = '';
		error = '';
		try {
			const result = await generateWeekWithRetries(
				weekNumber,
				aiNotes,
				(value) => (status = value),
				{
					lessonNumber: lesson.lessonNumber,
					enhancePath: lesson.enhancePath,
					existingLessons: week.lessons ?? []
				}
			);
			if (!result.ok) {
				lessonError = result.error;
				status = `Stopped after ${BATCH_CHUNK_RETRIES} attempts`;
				return;
			}
			usage = result.usage;
			status = `Week ${weekNumber} lesson ${lesson.lessonNumber} updated`;
		} finally {
			generatingLessonId = null;
			runMode = 'idle';
			setBusy(false);
		}
	}

	function weeksWithLessonsInRange(from: number, to: number): number[] {
		return plan.teachingSequence
			.filter((week) => (week.lessons?.length ?? 0) > 0)
			.map(weekNumberOf)
			.filter((num) => !Number.isNaN(num) && num >= from && num <= to)
			.sort((a, b) => a - b);
	}

	async function enrichAllWeeks() {
		if (!hasAnyLessons || busy) return;
		runMode = 'enrich-all';
		setBusy(true);
		enrichFinished = false;
		enrichError = '';
		enrichUsage = null;
		enrichStatus = '';
		lessonError = '';
		try {
			const targets = weeksWithLessonsInRange(1, Number.MAX_SAFE_INTEGER);
			if (!targets.length) {
				enrichError = 'Generate lesson plans first, then enrich materials.';
				return;
			}
			for (const weekNumber of targets) {
				const week = findWeek(weekNumber);
				const result = await generateWeekWithRetries(
					weekNumber,
					enrichNotes,
					(value) => (enrichStatus = value),
					{ mode: 'enrich', existingLessons: week?.lessons ?? [] }
				);
				if (!result.ok) {
					enrichError = result.error;
					enrichStatus = `Stopped at week ${weekNumber} after ${BATCH_CHUNK_RETRIES} attempts`;
					return;
				}
				enrichUsage = result.usage;
			}
			enrichFinished = true;
			enrichStatus = 'Finished';
		} finally {
			runMode = 'idle';
			setBusy(false);
		}
	}

	async function enrichWeekRange() {
		if (!hasAnyLessons || busy) return;
		const from = Math.min(Number(enrichRangeStart) || 1, Number(enrichRangeEnd) || 1);
		const to = Math.max(Number(enrichRangeStart) || 1, Number(enrichRangeEnd) || 1);
		const targets = weeksWithLessonsInRange(from, to);
		if (!targets.length) {
			enrichRangeError = `No lesson plans found in weeks ${from}–${to}.`;
			return;
		}

		runMode = 'enrich-range';
		setBusy(true);
		enrichRangeFinished = false;
		enrichRangeError = '';
		enrichRangeUsage = null;
		enrichRangeStatus = '';
		enrichError = '';
		try {
			for (const weekNumber of targets) {
				const week = findWeek(weekNumber);
				const result = await generateWeekWithRetries(
					weekNumber,
					enrichRangeNotes,
					(value) => (enrichRangeStatus = value),
					{ mode: 'enrich', existingLessons: week?.lessons ?? [] }
				);
				if (!result.ok) {
					enrichRangeError = result.error;
					enrichRangeStatus = `Stopped at week ${weekNumber} after ${BATCH_CHUNK_RETRIES} attempts`;
					return;
				}
				enrichRangeUsage = result.usage;
			}
			enrichRangeFinished = true;
			enrichRangeStatus = 'Finished';
		} finally {
			runMode = 'idle';
			setBusy(false);
		}
	}

	async function enrichLesson(week: TeachingWeek, lesson: LessonPlan) {
		if (busy) return;
		const weekNumber = weekNumberOf(week);
		if (Number.isNaN(weekNumber) || weekNumber <= 0) {
			lessonError = 'This week has no valid week number.';
			return;
		}

		runMode = 'enrich-lesson';
		setBusy(true);
		generatingLessonId = lesson.id;
		lessonError = '';
		try {
			const result = await generateWeekWithRetries(
				weekNumber,
				enrichNotes,
				(value) => (enrichStatus = value),
				{
					mode: 'enrich',
					lessonNumber: lesson.lessonNumber,
					enhancePath: lesson.enhancePath,
					existingLessons: week.lessons ?? []
				}
			);
			if (!result.ok) {
				lessonError = result.error;
				enrichStatus = `Stopped after ${BATCH_CHUNK_RETRIES} attempts`;
				return;
			}
			enrichUsage = result.usage;
			enrichStatus = `Week ${weekNumber} lesson ${lesson.lessonNumber} materials updated`;
		} finally {
			generatingLessonId = null;
			runMode = 'idle';
			setBusy(false);
		}
	}
</script>

<div class="chunk-panel">
	<div class="toolbar" style="margin:0 0 0.75rem">
		<h2 style="margin:0;flex:1">Lesson plans (ASPIRE pass)</h2>
		{#if hasAnyLessons}
			<a
				class="btn btn-sm"
				href={resolve('/api/export/lesson-plans/[levelPlanId]/[unitId]/[kind]', {
					levelPlanId: plan.levelPlanId,
					unitId: plan.id,
					kind: 'teacher'
				})}
				target="_blank"
			>
				Export teacher Word
			</a>
			<a
				class="btn btn-sm"
				href={resolve('/api/export/lesson-plans/[levelPlanId]/[unitId]/[kind]', {
					levelPlanId: plan.levelPlanId,
					unitId: plan.id,
					kind: 'teacher-pptx'
				})}
				target="_blank"
			>
				Export teacher PowerPoint
			</a>
			<a
				class="btn btn-sm"
				href={resolve('/api/export/lesson-plans/[levelPlanId]/[unitId]/[kind]', {
					levelPlanId: plan.levelPlanId,
					unitId: plan.id,
					kind: 'student'
				})}
				target="_blank"
			>
				Export student workbook
			</a>
		{/if}
		<button
			class="btn btn-sm"
			type="button"
			onclick={clearAllLessons}
			disabled={busy || !hasAnyLessons}
		>
			Clear all lessons
		</button>
	</div>
	<p class="meta">
		Generates {LESSONS_PER_WEEK} × {LESSON_DURATION_MINUTES}-min ASPIRE lessons per week after weekly
		detail exists. Keep each Enhance activity to {LESSON_ACTIVITY_MAX_MINUTES} minutes or less. Include
		teacherDoes and studentsDo so teacher and student documents can be derived later.
	</p>

	{#if !hasWeeks || !hasWeeklyDetail}
		<p class="meta">
			Finish Teaching sequence weekly detail first (key teaching experiences, theory, prac,
			assessment, or resources), then generate lesson plans.
		</p>
	{/if}

	<label>
		AI notes / feedback
		<textarea
			bind:value={aiNotes}
			rows="3"
			style="width:100%"
			placeholder="e.g. More prac in lesson 2; keep lesson 1 knowledge-building; stronger SMART finish…"
			disabled={busy}
		></textarea>
	</label>

	<button class="btn btn-primary" type="button" onclick={generateAllWeeks} disabled={!canGenerateAll}>
		{#if runMode === 'all'}
			{status || 'Generating…'}
		{:else if !hasWeeks}
			Generate all weeks (add weeks first)
		{:else if !hasWeeklyDetail}
			Generate all weeks (finish weekly detail first)
		{:else if hasAnyLessons || finished}
			Regenerate all weeks with notes
		{:else}
			Generate all weeks
		{/if}
	</button>
	{#if finished && !generating}
		<span class="meta batch-finished">Finished — edit notes above and regenerate anytime</span>
	{/if}
	<ModelFeedback {usage} />
	{#if error}<p class="error">{error}</p>{/if}
	{#if lessonError}<p class="error">{lessonError}</p>{/if}

	<div class="chunk-regenerate">
		<h3>Regenerate a week range</h3>
		<p class="meta">Fix a specific set of weeks without regenerating the whole unit.</p>
		<div class="form-row">
			<label>
				From week
				<input type="number" min="1" bind:value={rangeStart} disabled={busy} />
			</label>
			<label>
				To week
				<input type="number" min="1" bind:value={rangeEnd} disabled={busy} />
			</label>
		</div>
		<label>
			AI notes for this range
			<textarea
				bind:value={rangeNotes}
				rows="2"
				style="width:100%"
				disabled={busy}
			></textarea>
		</label>
		<button
			class="btn"
			type="button"
			onclick={generateWeekRange}
			disabled={busy || !hasWeeklyDetail || !hasWeeks}
		>
			{runMode === 'range' ? rangeStatus || 'Generating…' : `Generate weeks ${rangeStart}–${rangeEnd}`}
		</button>
		{#if rangeFinished && !generating}
			<span class="meta batch-finished">Finished</span>
		{/if}
		<ModelFeedback usage={rangeUsage} />
		{#if rangeError}<p class="error">{rangeError}</p>{/if}
	</div>
</div>

<div class="chunk-panel">
	<h2 style="margin-top:0">Materials (enrich pass)</h2>
	<p class="meta">
		Run after lesson scripts exist. Fills scaffolding lists, printable workbook artefacts, modelled
		teacher examples, and answer keys — so student/teacher documents have the actual worksheets, not
		just names of tasks.
	</p>
	{#if !hasAnyLessons}
		<p class="meta">Generate lesson plans first, then enrich materials.</p>
	{/if}
	<label>
		AI notes / feedback
		<textarea
			bind:value={enrichNotes}
			rows="3"
			style="width:100%"
			placeholder="e.g. Stronger workbook matrices; more sample answers; keep scaffolds short…"
			disabled={busy}
		></textarea>
	</label>
	<button
		class="btn btn-primary"
		type="button"
		onclick={enrichAllWeeks}
		disabled={busy || !hasAnyLessons}
	>
		{#if runMode === 'enrich-all'}
			{enrichStatus || 'Enriching…'}
		{:else}
			Enrich all weeks
		{/if}
	</button>
	{#if enrichFinished && !generating}
		<span class="meta batch-finished">Finished — edit notes above and re-run anytime</span>
	{/if}
	<ModelFeedback usage={enrichUsage} />
	{#if enrichError}<p class="error">{enrichError}</p>{/if}

	<div class="chunk-regenerate">
		<h3>Enrich a week range</h3>
		<div class="form-row">
			<label>
				From week
				<input type="number" min="1" bind:value={enrichRangeStart} disabled={busy} />
			</label>
			<label>
				To week
				<input type="number" min="1" bind:value={enrichRangeEnd} disabled={busy} />
			</label>
		</div>
		<label>
			AI notes for this range
			<textarea bind:value={enrichRangeNotes} rows="2" style="width:100%" disabled={busy}></textarea>
		</label>
		<button
			class="btn"
			type="button"
			onclick={enrichWeekRange}
			disabled={busy || !hasAnyLessons}
		>
			{runMode === 'enrich-range'
				? enrichRangeStatus || 'Enriching…'
				: `Enrich weeks ${enrichRangeStart}–${enrichRangeEnd}`}
		</button>
		{#if enrichRangeFinished && !generating}
			<span class="meta batch-finished">Finished</span>
		{/if}
		<ModelFeedback usage={enrichRangeUsage} />
		{#if enrichRangeError}<p class="error">{enrichRangeError}</p>{/if}
	</div>
</div>

{#if !hasWeeks}
	<p class="meta">No teaching weeks yet. Add weeks in Teaching sequence first.</p>
{:else}
	{#each plan.teachingSequence as week (week.id)}
		{@const lessons = sortedLessons(week)}
		<div class="card week-card">
			<details open={lessons.length > 0}>
				<summary class="week-summary">
					<h2>Week {week.week.value}</h2>
					<span class="meta">
						{lessons.length
							? `${lessons.length} lesson${lessons.length === 1 ? '' : 's'}`
							: 'No lessons yet'}
					</span>
				</summary>

				{#if lessons.length === 0}
					<p class="meta">No lessons yet</p>
				{:else}
					{#each lessons as lesson (lesson.id)}
						<article class="lesson-card">
							<div class="lesson-toolbar">
								<h3>
									Lesson {lesson.lessonNumber} · {lesson.durationMinutes || LESSON_DURATION_MINUTES} min
								</h3>
								<label class="lesson-title-field">
									Title
									<input type="text" bind:value={lesson.title} />
								</label>
								<label>
									Enhance path
									<select bind:value={lesson.enhancePath}>
										{#each ENHANCE_PATHS as path (path.value)}
											<option value={path.value}>{path.label}</option>
										{/each}
									</select>
								</label>
								<span class={['path-badge', lesson.enhancePath]}>{pathLabel(lesson.enhancePath)}</span>
								<button
									class="btn btn-sm"
									type="button"
									onclick={() => regenerateLesson(week, lesson)}
									disabled={busy}
								>
									{generating &&
									generatingLessonId === lesson.id &&
									runMode === 'lesson'
										? 'Generating…'
										: 'Regenerate'}
								</button>
								<button
									class="btn btn-sm"
									type="button"
									onclick={() => enrichLesson(week, lesson)}
									disabled={busy}
								>
									{generating &&
									generatingLessonId === lesson.id &&
									runMode === 'enrich-lesson'
										? 'Enriching…'
										: 'Enrich materials'}
								</button>
							</div>

							<label>
								Learning goal
								<textarea bind:value={lesson.learningGoal} rows="2"></textarea>
							</label>

							<h4>Orientate</h4>
							<label>
								SMART start
								<textarea bind:value={lesson.orientate.smartStart} rows="2"></textarea>
							</label>
							<label>
								Learning goal display
								<textarea bind:value={lesson.orientate.learningGoalDisplay} rows="2"></textarea>
							</label>

							<h4>Enhance</h4>
							<p class="meta">Each activity max {LESSON_ACTIVITY_MAX_MINUTES} minutes</p>
							{#each lesson.enhance.activities as activity (activity.id)}
								<div class="activity-row">
									<div class="activity-toolbar">
										<strong>{activity.title || 'Activity'}</strong>
										<button
											class="btn btn-sm"
											type="button"
											onclick={() => removeActivity(lesson, activity.id)}
											disabled={busy}
										>
											Remove
										</button>
									</div>
									<div class="form-row">
										<label>
											Minutes
											<input
												type="number"
												min="1"
												max={LESSON_ACTIVITY_MAX_MINUTES}
												bind:value={activity.minutes}
											/>
										</label>
										<label>
											Time label
											<input type="text" bind:value={activity.timeLabel} />
										</label>
										<label class="grow">
											Title
											<input type="text" bind:value={activity.title} />
										</label>
										<label>
											Stage
											<select bind:value={activity.stage}>
												{#each ACTIVITY_STAGES as stage (stage.value)}
													<option value={stage.value}>{stage.label}</option>
												{/each}
											</select>
										</label>
									</div>
									<label>
										Teacher does
										<textarea bind:value={activity.teacherDoes} rows="3"></textarea>
									</label>
									<label>
										Students do
										<textarea bind:value={activity.studentsDo} rows="3"></textarea>
									</label>
									<label>
										Visible instructions
										<textarea bind:value={activity.visibleInstructions} rows="2"></textarea>
									</label>
									<label>
										Questioning
										<textarea bind:value={activity.questioning} rows="2"></textarea>
									</label>
									<label>
										Scaffolding
										<textarea bind:value={activity.scaffolding} rows="3"></textarea>
									</label>
									<label>
										Workbook kind
										<select
											value={activity.workbookKind ?? ''}
											onchange={(e) => setWorkbookKind(activity, e.currentTarget.value)}
										>
											<option value="">(none)</option>
											{#each WORKBOOK_ACTIVITY_CATALOG as row (row.kind)}
												<option value={row.kind}>{row.label} ({row.kind})</option>
											{/each}
										</select>
									</label>
									<label>
										Workbook spec (JSON)
										<textarea
											value={workbookSpecText(activity)}
											rows="6"
											oninput={(e) => setWorkbookSpecFromJson(activity, e.currentTarget.value)}
										></textarea>
									</label>
									<label>
										Workbook materials
										<textarea
											value={activity.workbookMaterials ?? ''}
											rows="4"
											oninput={(e) => {
												activity.workbookMaterials = e.currentTarget.value;
											}}
										></textarea>
									</label>
									<label>
										Teacher answer key
										<textarea
											value={activity.teacherAnswerKey ?? ''}
											rows="4"
											oninput={(e) => {
												activity.teacherAnswerKey = e.currentTarget.value;
											}}
										></textarea>
									</label>
									<label>
										E-learning
										<textarea bind:value={activity.eLearning} rows="2"></textarea>
									</label>
									<label>
										Transition
										<textarea bind:value={activity.transition} rows="2"></textarea>
									</label>
								</div>
							{/each}
							<button
								class="btn btn-sm"
								type="button"
								onclick={() => addActivity(lesson)}
								disabled={busy}
							>
								Add activity
							</button>

							<h4>Culminate</h4>
							<label>
								SMART finish
								<textarea bind:value={lesson.culminate.smartFinish} rows="2"></textarea>
							</label>
							<label>
								Summarise
								<textarea bind:value={lesson.culminate.summarise} rows="2"></textarea>
							</label>
							<label>
								Next steps
								<textarea bind:value={lesson.culminate.nextSteps} rows="2"></textarea>
							</label>

							<label>
								Resources
								<textarea bind:value={lesson.resources} rows="2"></textarea>
							</label>
						</article>
					{/each}
				{/if}
			</details>
		</div>
	{/each}
{/if}

<style>
	.week-card {
		padding-top: 0.85rem;
	}

	.week-summary {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		cursor: pointer;
	}

	.week-summary h2 {
		margin: 0;
		flex: 1;
		font-size: 1.15rem;
	}

	.lesson-card {
		border-top: 1px solid #dde3ea;
		padding-top: 1rem;
		margin-top: 1rem;
	}

	.lesson-card:first-of-type {
		border-top: none;
		padding-top: 0.25rem;
		margin-top: 0.5rem;
	}

	.lesson-toolbar {
		display: flex;
		flex-wrap: wrap;
		gap: 0.65rem;
		align-items: end;
		margin-bottom: 0.85rem;
	}

	.lesson-toolbar h3 {
		margin: 0;
		flex: 0 0 auto;
		align-self: center;
		font-size: 1rem;
	}

	.lesson-title-field {
		flex: 1 1 12rem;
		min-width: 10rem;
	}

	.lesson-card h4 {
		margin: 1rem 0 0.4rem;
		font-size: 0.95rem;
	}

	.lesson-card label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.85rem;
		font-weight: 600;
		margin-bottom: 0.65rem;
	}

	.lesson-card textarea,
	.lesson-card input[type='text'],
	.lesson-card input[type='number'],
	.lesson-card select {
		width: 100%;
		box-sizing: border-box;
		padding: 0.45rem 0.5rem;
		border: 1px solid #c5d0dc;
		border-radius: 6px;
		font: inherit;
	}

	.lesson-card textarea {
		resize: vertical;
	}

	.activity-row {
		border-left: 3px solid #b8d4f0;
		padding: 0.35rem 0 0.15rem 0.85rem;
		margin: 0.75rem 0 1rem;
	}

	.activity-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}

	.form-row .grow {
		flex: 1 1 12rem;
	}

	.path-badge {
		display: inline-flex;
		align-items: center;
		align-self: center;
		font-size: 0.75rem;
		font-weight: 600;
		padding: 0.2rem 0.45rem;
		border-radius: 4px;
		background: #eef6ff;
		color: #1e3a5f;
		border: 1px solid #b8d4f0;
		white-space: nowrap;
	}

	.path-badge.knowledge-building {
		background: #f4eef8;
		border-color: #d4c4e4;
		color: #5b3a75;
	}
</style>
