import {
	Document,
	HeadingLevel,
	Packer,
	PageBreak,
	Paragraph,
	Table,
	TextRun,
	convertInchesToTwip
} from 'docx';
import { catalogRowsForDemo } from './catalog';
import { renderWorkbookActivity, renderWorkbookNameDate } from './render-docx';
import { workbookCatalogPromptBlock, workbookChoosePassPrompt } from './types';

type DocChild = Paragraph | Table;

function run(content: string, opts: { bold?: boolean; italics?: boolean; size?: number } = {}) {
	return new TextRun({
		text: content,
		font: 'Arial',
		size: opts.size ?? 22,
		bold: opts.bold,
		italics: opts.italics
	});
}

function para(
	content: string,
	opts: { bold?: boolean; italics?: boolean; after?: number; before?: number } = {}
): Paragraph {
	return new Paragraph({
		spacing: { after: opts.after ?? 100, before: opts.before ?? 0 },
		children: [run(content, opts)]
	});
}

/**
 * Build a review document: every workbook activity kind with
 * when-to-use, example JSON input, and rendered Word output.
 */
export async function buildWorkbookActivityCatalogDocx(): Promise<Buffer> {
	const children: DocChild[] = [
		para("St Brendan's College (Yeppoon)", { bold: true }),
		para('Workbook activity component library — catalog for review', { after: 200 }),
		new Paragraph({
			heading: HeadingLevel.TITLE,
			children: [run('Lesson workbook response presets', { bold: true, size: 36 })]
		}),
		para(
			'Generate (choose) pass: decision tree → workbookKind. Enrich: emit workbookSpec JSON. Word: renderWorkbookActivity(). Name/date is once per workbook page (not per activity). modelAnswer is teacher-only.',
			{ after: 200 }
		),
		para('Name/date (once per photocopied page — shown here once for the catalog)', {
			bold: true,
			before: 80
		}),
		renderWorkbookNameDate(),
		para(' ', { after: 120 }),
		para('Choose-pass decision tree', { bold: true, before: 120 }),
		...workbookChoosePassPrompt()
			.split('\n')
			.map((line) => para(line)),
		para('Catalog (for AI prompts)', { bold: true, before: 160 }),
		...workbookCatalogPromptBlock()
			.split('\n')
			.map((line) => para(line)),
		new Paragraph({ children: [new PageBreak()] })
	];

	for (const row of catalogRowsForDemo()) {
		children.push(
			new Paragraph({
				heading: HeadingLevel.HEADING_1,
				spacing: { before: 200, after: 120 },
				children: [run(`${row.meta.kind} — ${row.meta.label}`, { bold: true, size: 28 })]
			})
		);
		children.push(para(`USE: ${row.meta.whenToUse}`, { italics: true, after: 60 }));
		children.push(para(`NOT: ${row.meta.whenNotToUse}`, { italics: true, after: 60 }));
		children.push(
			para(`${row.meta.minutes} min · grouping: ${row.meta.grouping}`, { after: 120 })
		);
		children.push(para('INPUT (JSON emitted by enrich)', { bold: true, before: 80, after: 60 }));
		for (const line of row.json.split('\n')) {
			children.push(
				new Paragraph({
					spacing: { after: 0 },
					children: [run(line || ' ', { size: 18 })]
				})
			);
		}
		children.push(para('OUTPUT (Word render)', { bold: true, before: 160, after: 80 }));
		children.push(...renderWorkbookActivity(row.example));
		children.push(new Paragraph({ children: [new PageBreak()] }));
	}

	const doc = new Document({
		styles: {
			default: {
				document: {
					run: { font: 'Arial', size: 22 }
				}
			}
		},
		sections: [
			{
				properties: {
					page: {
						margin: {
							top: convertInchesToTwip(0.7),
							bottom: convertInchesToTwip(0.7),
							left: convertInchesToTwip(0.75),
							right: convertInchesToTwip(0.75)
						}
					}
				},
				children
			}
		]
	});

	return Packer.toBuffer(doc);
}
