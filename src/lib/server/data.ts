import fs from 'node:fs/promises';
import path from 'node:path';
import {
	createEmptyLevelPlan,
	createEmptyUnitPlan,
	createId,
	DEFAULT_SETTINGS,
	formatBandSubjectTitle,
	STANDALONE_LEVEL_PLAN_ID
} from '$lib/defaults';
import {
	createEmptyQuickLevelPlan,
	contentDescriptorsFromLevelPlan,
	exportQuickPlanToLevelPlan,
	importLevelPlanToQuickPlan,
	inferQuickPlanType,
	inferQuickPlanTypeFromTitle,
	syncQuickPlanColumns
} from '$lib/quick-plan';
import { getCurriculumForPlanType } from '$lib/curriculum/quick-plan-data';
import {
	applyUnitPlanToLevelPlan,
	orphanedUnitPlans,
	removeLevelPlanUnitColumn,
	resetLevelPlanUnitSlot,
	syncLevelPlanIntoUnitPlans,
	syncUnitPlansIntoLevelPlan,
	unitPlanForLevelIndex,
	clearLevelPlanSlotMatrix
} from '$lib/plan-sync';
import {
	curriculumMatchFromUnit,
	unitCompatibleWithFaculty
} from '$lib/curriculum-match';
import type {
	AssessmentItem,
	FacultyIndex,
	FacultyRow,
	LevelPlan,
	QuickLevelPlan,
	QuickLevelPlanSummary,
	QuickPlanType,
	Settings,
	UnitPlan,
	UnitPlanSummary,
	FacultyOverviewEntry,
	OverviewUnitEntry
} from '$lib/types';

const DATA_DIR = path.join(process.cwd(), 'data');

const PATHS = {
	settings: path.join(DATA_DIR, 'settings.json'),
	facultyIndex: path.join(DATA_DIR, 'faculty', 'index.json'),
	levelPlans: path.join(DATA_DIR, 'level-plans'),
	unitPlans: path.join(DATA_DIR, 'unit-plans'),
	assessmentItems: path.join(DATA_DIR, 'assessment-items'),
	quickLevelPlans: path.join(DATA_DIR, 'quick-level-plans')
};

async function ensureDataDirs() {
	await fs.mkdir(path.join(DATA_DIR, 'faculty'), { recursive: true });
	await fs.mkdir(PATHS.levelPlans, { recursive: true });
	await fs.mkdir(PATHS.unitPlans, { recursive: true });
	await fs.mkdir(PATHS.assessmentItems, { recursive: true });
	await fs.mkdir(PATHS.quickLevelPlans, { recursive: true });
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
	try {
		const raw = await fs.readFile(filePath, 'utf-8');
		return JSON.parse(raw) as T;
	} catch {
		return fallback;
	}
}

async function writeJson(filePath: string, data: unknown) {
	await fs.mkdir(path.dirname(filePath), { recursive: true });
	await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export async function getSettings(): Promise<Settings> {
	await ensureDataDirs();
	return readJson(PATHS.settings, DEFAULT_SETTINGS);
}

export async function saveSettings(settings: Settings) {
	await writeJson(PATHS.settings, settings);
}

export async function getFacultyIndex(): Promise<FacultyIndex> {
	await ensureDataDirs();
	return readJson(PATHS.facultyIndex, { rows: [] });
}

export async function saveFacultyIndex(index: FacultyIndex) {
	await writeJson(PATHS.facultyIndex, index);
}

export async function touchFacultyRow(levelPlanId: string) {
	const index = await getFacultyIndex();
	const row = index.rows.find((r) => r.id === levelPlanId);
	if (row) {
		row.dateLastModified = new Date().toISOString();
		await saveFacultyIndex(index);
	}
}

export async function getLevelPlan(id: string): Promise<LevelPlan | null> {
	await ensureDataDirs();
	return readJson<LevelPlan | null>(path.join(PATHS.levelPlans, `${id}.json`), null);
}

export async function saveLevelPlan(plan: LevelPlan) {
	await writeJson(path.join(PATHS.levelPlans, `${plan.id}.json`), plan);

	const unitPlans = await listUnitPlans(plan.id);
	await relocateOrphanUnitPlansToStandalone(plan, unitPlans);
	const refreshedUnitPlans = await listUnitPlans(plan.id);
	const updatedUnitPlans = syncLevelPlanIntoUnitPlans(plan, refreshedUnitPlans);
	for (const unitPlan of updatedUnitPlans) {
		await writeJson(unitPlanPath(plan.id, unitPlan.id), unitPlan);
	}

	await touchFacultyRow(plan.id);
}

async function relocateOrphanUnitPlansToStandalone(
	levelPlan: LevelPlan,
	unitPlans: UnitPlan[]
) {
	for (const orphan of orphanedUnitPlans(levelPlan, unitPlans)) {
		await relocateUnitPlan(orphan, STANDALONE_LEVEL_PLAN_ID);
		orphan.unitNumber.value = '';
		await writeJson(unitPlanPath(STANDALONE_LEVEL_PLAN_ID, orphan.id), orphan);
	}
}

export async function createLevelPlanFromFacultyRow(
	row: Omit<FacultyRow, 'dateLastModified'>
): Promise<LevelPlan> {
	const plan = createEmptyLevelPlan(
		row.id,
		row.learningAreaSubject,
		row.yearLevelBand
	);
	await saveLevelPlan(plan);
	return plan;
}

export function unitPlanPath(levelPlanId: string, unitId: string) {
	return path.join(PATHS.unitPlans, levelPlanId, `${unitId}.json`);
}

export async function getUnitPlan(
	levelPlanId: string,
	unitId: string
): Promise<UnitPlan | null> {
	await ensureDataDirs();
	return readJson<UnitPlan | null>(unitPlanPath(levelPlanId, unitId), null);
}

export async function listUnitPlans(levelPlanId: string): Promise<UnitPlan[]> {
	await ensureDataDirs();
	const dir = path.join(PATHS.unitPlans, levelPlanId);
	try {
		const files = await fs.readdir(dir);
		const plans: UnitPlan[] = [];
		for (const file of files) {
			if (!file.endsWith('.json')) continue;
			const plan = await readJson<UnitPlan | null>(
				path.join(dir, file),
				null
			);
			if (plan) plans.push(plan);
		}
		return plans.sort(
			(a, b) => Number(a.unitNumber.value || 0) - Number(b.unitNumber.value || 0)
		);
	} catch {
		return [];
	}
}

export async function listAllUnitPlans(): Promise<UnitPlanSummary[]> {
	await ensureDataDirs();
	const index = await getFacultyIndex();
	const rowById = new Map(index.rows.map((r) => [r.id, r]));
	const summaries: UnitPlanSummary[] = [];

	let levelPlanDirs: string[] = [];
	try {
		levelPlanDirs = await fs.readdir(PATHS.unitPlans);
	} catch {
		return [];
	}

	for (const levelPlanId of levelPlanDirs) {
		const plans = await listUnitPlans(levelPlanId);
		if (plans.length === 0) continue;

		const levelPlan = await getLevelPlan(levelPlanId);
		const row = rowById.get(levelPlanId);
		const levelPlanLabel =
			levelPlanId === STANDALONE_LEVEL_PLAN_ID
				? 'Standalone'
				: levelPlan?.bandSubjectTitle.value ||
					(row ? formatBandSubjectTitle(row.yearLevelBand, row.learningAreaSubject) : levelPlanId);

		for (const plan of plans) {
			const curriculum = curriculumMatchFromUnit(
				String(plan.subject.value || ''),
				plan.yearLevel.value
			);
			summaries.push({
				id: plan.id,
				levelPlanId: plan.levelPlanId,
				levelPlanLabel,
				unitTitle: String(plan.unitTitle.value || 'Untitled unit'),
				unitNumber: plan.unitNumber.value,
				yearLevel: plan.yearLevel.value,
				subject: String(plan.subject.value || ''),
				status: String(plan.status.value || ''),
				isStandalone: levelPlanId === STANDALONE_LEVEL_PLAN_ID,
				curriculumLabel: curriculum.label,
				curriculumSortKey: curriculum.sortKey
			});
		}
	}

	return summaries.sort((a, b) => {
		const byCurriculum = a.curriculumSortKey.localeCompare(b.curriculumSortKey);
		if (byCurriculum !== 0) return byCurriculum;
		if (a.isStandalone !== b.isStandalone) return a.isStandalone ? -1 : 1;
		const byLevel = a.levelPlanLabel.localeCompare(b.levelPlanLabel);
		if (byLevel !== 0) return byLevel;
		return a.unitTitle.localeCompare(b.unitTitle);
	});
}

async function relocateUnitPlan(plan: UnitPlan, newLevelPlanId: string): Promise<UnitPlan> {
	const oldLevelPlanId = plan.levelPlanId;
	if (oldLevelPlanId === newLevelPlanId) return plan;
	plan.levelPlanId = newLevelPlanId;
	await writeJson(unitPlanPath(newLevelPlanId, plan.id), plan);
	try {
		await fs.unlink(unitPlanPath(oldLevelPlanId, plan.id));
	} catch {
		// ignore missing file
	}
	return plan;
}

export async function detachUnitFromLevelPlan(levelPlanId: string, unitIndex: number) {
	const levelPlan = await getLevelPlan(levelPlanId);
	if (!levelPlan) throw new Error('Level plan not found');
	if (unitIndex < 0 || unitIndex >= levelPlan.units.length) {
		throw new Error('Invalid unit slot');
	}

	const unitPlans = await listUnitPlans(levelPlanId);
	const unitPlan = unitPlanForLevelIndex(levelPlan.units[unitIndex], unitIndex, unitPlans);
	if (!unitPlan) throw new Error('No unit plan is attached to this slot');

	await relocateUnitPlan(unitPlan, STANDALONE_LEVEL_PLAN_ID);
	unitPlan.unitNumber.value = '';
	await writeJson(unitPlanPath(STANDALONE_LEVEL_PLAN_ID, unitPlan.id), unitPlan);

	levelPlan.units[unitIndex] = resetLevelPlanUnitSlot(levelPlan.units[unitIndex], unitIndex + 1);
	clearLevelPlanSlotMatrix(levelPlan, unitIndex);
	await writeJson(path.join(PATHS.levelPlans, `${levelPlan.id}.json`), levelPlan);
	await touchFacultyRow(levelPlanId);
	return { levelPlan, unitPlan };
}

export async function attachUnitToLevelPlan(
	levelPlanId: string,
	unitIndex: number,
	unitPlanId: string,
	options?: { replace?: boolean }
) {
	const levelPlan = await getLevelPlan(levelPlanId);
	if (!levelPlan) throw new Error('Level plan not found');
	if (unitIndex < 0 || unitIndex >= levelPlan.units.length) {
		throw new Error('Invalid unit slot');
	}

	const facultyIndex = await getFacultyIndex();
	const facultyRow = facultyIndex.rows.find((row) => row.id === levelPlanId);
	if (!facultyRow) throw new Error('Faculty row not found for this level plan');

	const unitPlan = await getUnitPlan(STANDALONE_LEVEL_PLAN_ID, unitPlanId);
	if (!unitPlan) throw new Error('Standalone unit plan not found');

	const compatible = unitCompatibleWithFaculty(
		String(unitPlan.subject.value),
		unitPlan.yearLevel.value,
		facultyRow.learningAreaSubject,
		facultyRow.yearLevelBand
	);
	if (!compatible) {
		throw new Error(
			'This unit does not match the level plan subject and year band. Check the unit subject/year before attaching.'
		);
	}

	const unitPlans = await listUnitPlans(levelPlanId);
	const existing = unitPlanForLevelIndex(levelPlan.units[unitIndex], unitIndex, unitPlans);
	if (existing) {
		if (!options?.replace) {
			throw new Error('This slot already has a unit plan. Detach it first or choose replace.');
		}
		await detachUnitFromLevelPlan(levelPlanId, unitIndex);
		const refreshed = await getLevelPlan(levelPlanId);
		if (!refreshed) throw new Error('Level plan not found');
		levelPlan.units = refreshed.units;
	}

	const standalonePlan = await getUnitPlan(STANDALONE_LEVEL_PLAN_ID, unitPlanId);
	if (!standalonePlan) throw new Error('Unit plan is no longer available as standalone');

	await relocateUnitPlan(standalonePlan, levelPlanId);
	standalonePlan.unitNumber.value = unitIndex + 1;
	standalonePlan.subject.value =
		levelPlan.bandSubjectTitle.value ||
		formatBandSubjectTitle(facultyRow.yearLevelBand, facultyRow.learningAreaSubject);
	standalonePlan.year.value = levelPlan.year.value;

	applyUnitPlanToLevelPlan(levelPlan, standalonePlan, unitIndex);

	await writeJson(unitPlanPath(levelPlanId, standalonePlan.id), standalonePlan);
	await writeJson(path.join(PATHS.levelPlans, `${levelPlan.id}.json`), levelPlan);
	await touchFacultyRow(levelPlanId);
	return { levelPlan, unitPlan: standalonePlan };
}

export async function removeUnitColumnFromLevelPlan(levelPlanId: string, unitIndex: number) {
	const levelPlan = await getLevelPlan(levelPlanId);
	if (!levelPlan) throw new Error('Level plan not found');

	const unitPlans = await listUnitPlans(levelPlanId);
	const attached = unitPlanForLevelIndex(levelPlan.units[unitIndex], unitIndex, unitPlans);
	if (attached) {
		throw new Error('Detach the unit plan before removing this column.');
	}

	removeLevelPlanUnitColumn(levelPlan, unitIndex);

	const removedNumber = unitIndex + 1;
	for (const unitPlan of unitPlans) {
		const num = Number(unitPlan.unitNumber.value);
		if (num > removedNumber) {
			unitPlan.unitNumber.value = num - 1;
			await writeJson(unitPlanPath(levelPlanId, unitPlan.id), unitPlan);
		}
	}

	await saveLevelPlan(levelPlan);
	return levelPlan;
}

export async function createStandaloneUnitPlan(title?: string): Promise<UnitPlan> {
	await ensureDataDirs();
	const existing = await listUnitPlans(STANDALONE_LEVEL_PLAN_ID);
	const unitNumber = existing.length + 1;
	const plan = createEmptyUnitPlan(createId('unit'), STANDALONE_LEVEL_PLAN_ID, unitNumber);
	if (title?.trim()) plan.unitTitle.value = title.trim();
	await writeJson(unitPlanPath(STANDALONE_LEVEL_PLAN_ID, plan.id), plan);
	return plan;
}

function normalizeTitle(title: string) {
	return title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function matchUnitPlan(
	levelUnit: LevelPlan['units'][number],
	unitIndex: number,
	unitPlans: UnitPlan[],
	usedIds: Set<string>
) {
	const byNumber = unitPlans.find(
		(p) =>
			!usedIds.has(p.id) &&
			p.unitNumber.value !== '' &&
			Number(p.unitNumber.value) === unitIndex + 1
	);
	if (byNumber) return byNumber;

	const levelTitle = normalizeTitle(String(levelUnit.unitTitle.value));
	return unitPlans.find(
		(p) =>
			!usedIds.has(p.id) &&
			(levelTitle === normalizeTitle(String(p.unitTitle.value)) ||
				normalizeTitle(String(p.unitTitle.value)).includes(levelTitle) ||
				levelTitle.includes(normalizeTitle(String(p.unitTitle.value))))
	);
}

export async function getFacultyOverview(): Promise<FacultyOverviewEntry[]> {
	const index = await getFacultyIndex();
	const entries: FacultyOverviewEntry[] = [];

	for (const row of index.rows) {
		const levelPlan = await getLevelPlan(row.id);
		if (levelPlan) {
			const unitPlans = await listUnitPlans(row.id);
			await relocateOrphanUnitPlansToStandalone(levelPlan, unitPlans);
		}
		const unitPlans = await listUnitPlans(row.id);
		const usedPlanIds = new Set<string>();
		const units: OverviewUnitEntry[] = [];

		if (levelPlan) {
			for (const [index, levelUnit] of levelPlan.units.entries()) {
				const matched = matchUnitPlan(levelUnit, index, unitPlans, usedPlanIds);
				if (matched) usedPlanIds.add(matched.id);

				units.push({
					levelUnitId: levelUnit.id,
					unitPlanId: matched?.id ?? null,
					title: String(levelUnit.unitTitle.value || `Unit ${index + 1}`),
					unitNumber: matched?.unitNumber.value ?? (index + 1),
					yearLevel: levelUnit.yearLevel.value,
					duration: String(levelUnit.duration.value || ''),
					status: matched ? String(matched.status.value || '') : 'No unit plan yet',
					hasUnitPlan: !!matched
				});
			}
		}

		units.sort((a, b) => Number(a.unitNumber || 0) - Number(b.unitNumber || 0));

		entries.push({
			...row,
			bandSubjectTitle:
				levelPlan?.bandSubjectTitle.value ||
				formatBandSubjectTitle(row.yearLevelBand, row.learningAreaSubject),
			levelPlanStatus: String(levelPlan?.status.value || ''),
			units
		});
	}

	return entries;
}

export async function saveUnitPlan(plan: UnitPlan) {
	await writeJson(unitPlanPath(plan.levelPlanId, plan.id), plan);

	const levelPlan = await getLevelPlan(plan.levelPlanId);
	if (levelPlan) {
		const unitPlans = await listUnitPlans(plan.levelPlanId);
		const unitIndex = levelPlan.units.findIndex(
			(_unit, index) => unitPlanForLevelIndex(levelPlan.units[index], index, unitPlans)?.id === plan.id
		);
		if (unitIndex >= 0) {
			applyUnitPlanToLevelPlan(levelPlan, plan, unitIndex);
			await writeJson(path.join(PATHS.levelPlans, `${levelPlan.id}.json`), levelPlan);
		}
	}

	await touchFacultyRow(plan.levelPlanId);
}

export async function deleteUnitPlan(
	levelPlanId: string,
	unitId: string,
	options?: { internal?: boolean }
) {
	if (!options?.internal && levelPlanId !== STANDALONE_LEVEL_PLAN_ID) {
		throw new Error(
			'Only standalone units can be deleted. Detach the unit from its level plan on the overview page first.'
		);
	}

	await ensureDataDirs();
	try {
		await fs.unlink(unitPlanPath(levelPlanId, unitId));
	} catch {
		// ignore missing file
	}
	const items = await listAssessmentItems(levelPlanId, unitId);
	for (const item of items) {
		try {
			await fs.unlink(path.join(PATHS.assessmentItems, `${item.id}.json`));
		} catch {
			// ignore missing file
		}
	}
	await touchFacultyRow(levelPlanId);
}

export async function getAssessmentItem(id: string): Promise<AssessmentItem | null> {
	await ensureDataDirs();
	return readJson<AssessmentItem | null>(
		path.join(PATHS.assessmentItems, `${id}.json`),
		null
	);
}

export async function listAssessmentItems(
	levelPlanId?: string,
	unitPlanId?: string
): Promise<AssessmentItem[]> {
	await ensureDataDirs();
	try {
		const files = await fs.readdir(PATHS.assessmentItems);
		const items: AssessmentItem[] = [];
		for (const file of files) {
			if (!file.endsWith('.json')) continue;
			const item = await readJson<AssessmentItem | null>(
				path.join(PATHS.assessmentItems, file),
				null
			);
			if (!item) continue;
			if (levelPlanId && item.levelPlanId !== levelPlanId) continue;
			if (unitPlanId && item.unitPlanId !== unitPlanId) continue;
			items.push(item);
		}
		return items;
	} catch {
		return [];
	}
}

export async function saveAssessmentItem(item: AssessmentItem) {
	await writeJson(path.join(PATHS.assessmentItems, `${item.id}.json`), item);
	await touchFacultyRow(item.levelPlanId);
}

export async function createAssessmentItem(
	levelPlanId: string,
	unitPlanId: string,
	title = 'New assessment item'
): Promise<AssessmentItem> {
	const item: AssessmentItem = {
		id: createId('assess'),
		levelPlanId,
		unitPlanId,
		title: { value: title, aiNotes: '' },
		description: { value: '', aiNotes: '' },
		technique: { value: '', aiNotes: '' },
		mode: { value: '', aiNotes: '' },
		conditions: { value: '', aiNotes: '' },
		markingCriteria: { value: '', aiNotes: '' },
		notes: { value: '', aiNotes: '' }
	};
	await saveAssessmentItem(item);
	return item;
}

export function slugId(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
		.slice(0, 40);
}

export async function listQuickLevelPlans(): Promise<QuickLevelPlanSummary[]> {
	await ensureDataDirs();
	try {
		const files = await fs.readdir(PATHS.quickLevelPlans);
		const plans: QuickLevelPlanSummary[] = [];
		for (const file of files) {
			if (!file.endsWith('.json')) continue;
			const plan = await readJson<QuickLevelPlan | null>(
				path.join(PATHS.quickLevelPlans, file),
				null
			);
			if (!plan) continue;
			plans.push({
				id: plan.id,
				planType: plan.planType,
				title: plan.title,
				modifiedAt: plan.modifiedAt,
				sourceLevelPlanId: plan.sourceLevelPlanId
			});
		}
		return plans.sort(
			(a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime()
		);
	} catch {
		return [];
	}
}

export async function getQuickLevelPlan(id: string): Promise<QuickLevelPlan | null> {
	await ensureDataDirs();
	return readJson<QuickLevelPlan | null>(
		path.join(PATHS.quickLevelPlans, `${id}.json`),
		null
	);
}

export async function saveQuickLevelPlan(plan: QuickLevelPlan) {
	const updated = { ...plan, modifiedAt: new Date().toISOString() };
	await writeJson(path.join(PATHS.quickLevelPlans, `${plan.id}.json`), updated);
	return updated;
}

export async function syncQuickLevelPlanIntoLevelPlan(
	quickPlan: QuickLevelPlan
): Promise<LevelPlan | null> {
	if (!quickPlan.sourceLevelPlanId) return null;

	const levelPlan = await getLevelPlan(quickPlan.sourceLevelPlanId);
	if (!levelPlan) return null;

	const curriculum = getCurriculumForPlanType(quickPlan.planType);
	const descriptors =
		curriculum.contentDescriptors.length > 0
			? curriculum.contentDescriptors
			: contentDescriptorsFromLevelPlan(levelPlan);

	exportQuickPlanToLevelPlan(quickPlan, levelPlan, descriptors);
	await saveLevelPlan(levelPlan);
	return levelPlan;
}

export async function saveQuickLevelPlanWithSourceSync(
	plan: QuickLevelPlan
): Promise<QuickLevelPlan> {
	const normalized = syncQuickPlanColumns(plan);

	if (!normalized.sourceLevelPlanId) {
		return saveQuickLevelPlan(normalized);
	}

	const synced = await syncQuickLevelPlanIntoLevelPlan(normalized);
	if (!synced) {
		return saveQuickLevelPlan(normalized);
	}

	const faculty = await getFacultyIndex();
	const row = faculty.rows.find((r) => r.id === normalized.sourceLevelPlanId);
	const modifiedAt = row?.dateLastModified ?? new Date().toISOString();
	return saveQuickLevelPlan({ ...normalized, modifiedAt });
}

export async function createQuickLevelPlan(planType: QuickPlanType): Promise<QuickLevelPlan> {
	const plan = createEmptyQuickLevelPlan(planType);
	await saveQuickLevelPlan(plan);
	return plan;
}

export async function deleteQuickLevelPlan(id: string) {
	await ensureDataDirs();
	try {
		await fs.unlink(path.join(PATHS.quickLevelPlans, `${id}.json`));
	} catch {
		// ignore missing file
	}
}

export async function findQuickLevelPlanBySource(
	sourceLevelPlanId: string
): Promise<QuickLevelPlan | null> {
	await ensureDataDirs();
	try {
		const files = await fs.readdir(PATHS.quickLevelPlans);
		for (const file of files) {
			if (!file.endsWith('.json')) continue;
			const plan = await readJson<QuickLevelPlan | null>(
				path.join(PATHS.quickLevelPlans, file),
				null
			);
			if (plan?.sourceLevelPlanId === sourceLevelPlanId) return plan;
		}
		return null;
	} catch {
		return null;
	}
}

function levelPlanNewerThanQuickPlan(
	levelPlanId: string,
	quickPlanModifiedAt: string,
	facultyRows: FacultyRow[]
): boolean {
	const row = facultyRows.find((r) => r.id === levelPlanId);
	return Boolean(row && row.dateLastModified > quickPlanModifiedAt);
}

function quickPlanNewerThanLevelPlan(
	levelPlanId: string,
	quickPlanModifiedAt: string,
	facultyRows: FacultyRow[]
): boolean {
	const row = facultyRows.find((r) => r.id === levelPlanId);
	return Boolean(row && quickPlanModifiedAt > row.dateLastModified);
}

export async function syncQuickLevelPlanFromLevelPlan(
	levelPlanId: string,
	existing?: QuickLevelPlan
): Promise<QuickLevelPlan> {
	const levelPlan = await getLevelPlan(levelPlanId);
	if (!levelPlan) throw new Error('Level plan not found');

	const unitPlans = await listUnitPlans(levelPlanId);
	syncUnitPlansIntoLevelPlan(levelPlan, unitPlans);

	const faculty = await getFacultyIndex();
	const facultyRow = faculty.rows.find((row) => row.id === levelPlanId);

	const planType =
		(facultyRow && inferQuickPlanType(facultyRow.learningAreaSubject, facultyRow.yearLevelBand)) ||
		inferQuickPlanTypeFromTitle(levelPlan.bandSubjectTitle.value);

	if (!planType) {
		throw new Error('Could not determine plan type for this level plan');
	}

	return importLevelPlanToQuickPlan(levelPlan, planType, levelPlanId, existing);
}

export async function refreshQuickLevelPlanFromSource(
	plan: QuickLevelPlan
): Promise<QuickLevelPlan> {
	const synced = syncQuickPlanColumns(plan);
	if (!synced.sourceLevelPlanId) return synced;

	const faculty = await getFacultyIndex();
	const levelPlanId = synced.sourceLevelPlanId;

	if (levelPlanNewerThanQuickPlan(levelPlanId, synced.modifiedAt, faculty.rows)) {
		const refreshed = await syncQuickLevelPlanFromLevelPlan(levelPlanId, synced);
		return saveQuickLevelPlan(refreshed);
	}

	if (quickPlanNewerThanLevelPlan(levelPlanId, synced.modifiedAt, faculty.rows)) {
		return saveQuickLevelPlanWithSourceSync(synced);
	}

	return synced;
}

export async function importQuickLevelPlanFromLevelPlan(
	levelPlanId: string
): Promise<QuickLevelPlan> {
	const existing = await findQuickLevelPlanBySource(levelPlanId);
	if (existing) {
		return refreshQuickLevelPlanFromSource(existing);
	}

	const plan = await syncQuickLevelPlanFromLevelPlan(levelPlanId);
	return saveQuickLevelPlan(plan);
}
