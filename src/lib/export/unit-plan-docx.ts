import {
	Document,
	HeadingLevel,
	Packer,
	Paragraph,
	Table,
	TableCell,
	TableRow,
	TextRun,
	WidthType
} from 'docx';
import type { UnitPlan } from '$lib/types';

function cell(text: string, bold = false) {
	return new TableCell({
		children: [
			new Paragraph({
				children: [new TextRun({ text: text || '', bold })]
			})
		]
	});
}

function textPara(text: string, heading?: (typeof HeadingLevel)[keyof typeof HeadingLevel]) {
	return new Paragraph({
		heading,
		children: [new TextRun(text || '')]
	});
}

export async function buildUnitPlanDocx(plan: UnitPlan): Promise<Buffer> {
	const children: (Paragraph | Table)[] = [
		new Paragraph({
			heading: HeadingLevel.TITLE,
			children: [
				new TextRun(
					`Year ${plan.yearLevel.value} ${plan.subject.value} — ${plan.unitTitle.value}`
				)
			]
		}),
		textPara(`Unit ${plan.unitNumber.value}   ${plan.startWeek.value} to ${plan.finishWeek.value}`),
		...(plan.duration?.value
			? [textPara(`Duration: ${plan.duration.value}`)]
			: []),
		textPara(`School: St Brendan's College (Yeppoon)`),
		textPara(`Status: ${plan.status.value}`),
		textPara('Unit description', HeadingLevel.HEADING_2),
		textPara(plan.unitDescription.value),
		textPara('Cohort and class considerations', HeadingLevel.HEADING_2),
		textPara(plan.cohortAndClassConsiderations.value)
	];

	if (plan.assessments.length) {
		children.push(textPara('Assessments', HeadingLevel.HEADING_2));
		for (const a of plan.assessments) {
			children.push(
				textPara(`${a.assessmentNumber.value}. ${a.title.value}`, HeadingLevel.HEADING_3),
				textPara(a.description.value),
				textPara(`Technique: ${a.technique.value}   Mode: ${a.mode.value}`),
				textPara(`Conditions: ${a.conditions.value}`),
				textPara(`Timing: ${a.timing.value}`),
				textPara(`Achievement standard: ${a.achievementStandard.value}`),
				textPara(`Moderation: ${a.moderation.value}`)
			);
			if (a.contentDescriptions.length) {
				children.push(textPara('Content descriptions', HeadingLevel.HEADING_3));
				for (const cd of a.contentDescriptions) {
					children.push(
						textPara(`${cd.strand.value} — ${cd.subStrand.value}`),
						textPara(`${cd.text.value} (${cd.code.value})`)
					);
				}
			}
		}
	}

	if (plan.generalCapabilities.length) {
		children.push(textPara('General capabilities', HeadingLevel.HEADING_2));
		for (const cap of plan.generalCapabilities) {
			if (!cap.subElements.value && !cap.evidenceNotes.value) continue;
			children.push(
				textPara(cap.name.value, HeadingLevel.HEADING_3),
				textPara(cap.subElements.value),
				textPara(cap.evidenceNotes.value)
			);
		}
	}

	if (plan.teachingSequence.length) {
		children.push(textPara('Teaching and learning sequence', HeadingLevel.HEADING_2));
		const header = new TableRow({
			children: [
				cell('Week', true),
				cell('Key experiences', true),
				cell('Theory', true),
				cell('Prac', true),
				cell('Assessment', true),
				cell('Resources', true)
			]
		});
		const rows = plan.teachingSequence.map(
			(w) =>
				new TableRow({
					children: [
						cell(String(w.week.value)),
						cell(w.keyTeachingExperiences.value),
						cell(w.theory.value),
						cell(w.prac.value),
						cell(w.assessment.value),
						cell(w.resources.value)
					]
				})
		);
		children.push(
			new Table({
				width: { size: 100, type: WidthType.PERCENTAGE },
				rows: [header, ...rows]
			})
		);
	}

	children.push(textPara('Evaluation', HeadingLevel.HEADING_2), textPara(plan.evaluation.value));

	const doc = new Document({ sections: [{ children }] });
	return Packer.toBuffer(doc);
}
