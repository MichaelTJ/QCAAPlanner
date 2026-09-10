import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSettings, getUnitPlan } from '$lib/server/data';
import {
	attachmentContentDisposition,
	lessonPlansStudentExportFilename,
	lessonPlansTeacherExportFilename,
	lessonPlansTeacherPptxExportFilename
} from '$lib/export/export-filenames';
import {
	buildLessonPlansStudentDocx,
	buildLessonPlansTeacherDocx
} from '$lib/export/lesson-plans-docx';
import { buildLessonPlansTeacherPptx } from '$lib/export/lesson-plans-pptx';

const PPTX_TYPE = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export const GET: RequestHandler = async ({ params }) => {
	const kind = params.kind;
	if (kind !== 'teacher' && kind !== 'student' && kind !== 'teacher-pptx') {
		error(404, 'Unknown lesson plan export');
	}

	const plan = await getUnitPlan(params.levelPlanId, params.unitId);
	if (!plan) error(404, 'Unit plan not found');

	const settings = await getSettings();
	try {
		if (kind === 'teacher-pptx') {
			const buffer = await buildLessonPlansTeacherPptx(plan, settings.school);
			return new Response(new Uint8Array(buffer), {
				headers: {
					'Content-Type': PPTX_TYPE,
					'Content-Disposition': attachmentContentDisposition(
						lessonPlansTeacherPptxExportFilename(plan)
					)
				}
			});
		}

		const buffer =
			kind === 'teacher'
				? await buildLessonPlansTeacherDocx(plan, settings.school)
				: await buildLessonPlansStudentDocx(plan, settings.school);
		const filename =
			kind === 'teacher'
				? lessonPlansTeacherExportFilename(plan)
				: lessonPlansStudentExportFilename(plan);

		return new Response(new Uint8Array(buffer), {
			headers: {
				'Content-Type': DOCX_TYPE,
				'Content-Disposition': attachmentContentDisposition(filename)
			}
		});
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Lesson plan export failed';
		if (message === 'No lesson plans to export') error(400, message);
		error(500, message);
	}
};
