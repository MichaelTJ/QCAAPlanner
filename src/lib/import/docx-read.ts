import AdmZip from 'adm-zip';
import {
	cellText,
	extractCells,
	extractNestedTables,
	extractParagraphs,
	extractRows,
	extractTopLevelCells,
	extractTopLevelRows,
	extractTopLevelTables,
	extractTopLevelTablesWithSeparators,
	unwrapTable
} from '$lib/export/docx-xml';

export function loadDocumentXml(buffer: Buffer): string {
	const zip = new AdmZip(buffer);
	const entry = zip.getEntry('word/document.xml');
	if (!entry) throw new Error('Invalid Word document: missing word/document.xml');
	return entry.getData().toString('utf-8');
}

export function decodeXmlEntities(text: string): string {
	return text
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'");
}

export function paragraphText(paragraphXml: string): string {
	return decodeXmlEntities(
		[...paragraphXml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('')
	);
}

export function paragraphStyle(paragraphXml: string): string {
	return paragraphXml.match(/<w:pStyle w:val="([^"]+)"/)?.[1] ?? '';
}

export type BodyBlock =
	| { type: 'paragraph'; style: string; text: string }
	| { type: 'table'; xml: string };

/** Top-level body blocks in document order (paragraphs and tables). */
export function extractBodyBlocks(documentXml: string): BodyBlock[] {
	const bodyMatch = documentXml.match(/<w:body>([\s\S]*)<\/w:body>/);
	if (!bodyMatch) return [];

	const body = bodyMatch[1];
	const blocks: BodyBlock[] = [];
	let i = 0;

	while (i < body.length) {
		if (body.startsWith('<w:tbl>', i)) {
			const end = findBalancedClose(body, i, '<w:tbl>', '</w:tbl>');
			if (end < 0) break;
			blocks.push({ type: 'table', xml: body.slice(i, end) });
			i = end;
			continue;
		}

		const pStart = body.indexOf('<w:p', i);
		if (pStart < 0) break;
		if (pStart > i) {
			i = pStart;
			continue;
		}

		const pEnd = body.indexOf('</w:p>', pStart);
		if (pEnd < 0) break;
		const paraXml = body.slice(pStart, pEnd + 6);
		blocks.push({
			type: 'paragraph',
			style: paragraphStyle(paraXml),
			text: paragraphText(paraXml)
		});
		i = pEnd + 6;
	}

	return blocks;
}

function findBalancedClose(xml: string, start: number, openTag: string, closeTag: string): number {
	let depth = 0;
	let i = start;
	while (i < xml.length) {
		if (xml.startsWith(openTag, i)) {
			depth++;
			i += openTag.length;
			continue;
		}
		if (xml.startsWith(closeTag, i)) {
			depth--;
			if (depth === 0) return i + closeTag.length;
			i += closeTag.length;
			continue;
		}
		i++;
	}
	return -1;
}

export function cellHasCheckmark(cellXml: string): boolean {
	return /<w:sym\b[^>]*w:font="Wingdings"[^>]*w:char="00FC"/.test(cellXml);
}

export function tableRowTexts(tableXml: string): string[][] {
	return extractRows(unwrapTable(tableXml)).map((row) =>
		extractCells(row).map((cell) => cellText(cell))
	);
}

export function tableRowCheckmarks(tableXml: string): boolean[][] {
	return extractRows(unwrapTable(tableXml)).map((row) =>
		extractCells(row).map((cell) => cellHasCheckmark(cell))
	);
}

export function parseLabeledLine(text: string, label: string): string | undefined {
	const re = new RegExp(`^${label}:\\s*(.*)$`, 'i');
	const match = text.match(re);
	return match ? match[1].trim() : undefined;
}

export function parseAssessmentHeading(text: string): { number: number | ''; title: string } {
	const numbered = text.match(/^(\d+)\.\s*(.+)$/);
	if (numbered) {
		return { number: Number(numbered[1]), title: numbered[2].trim() };
	}
	const assessment = text.match(/^Assessment\s+(\d+)\s*[—–-]\s*(.+)$/i);
	if (assessment) {
		return { number: Number(assessment[1]), title: assessment[2].trim() };
	}
	return { number: '', title: text.trim() };
}

export function parseContentDescriptionLine(text: string): {
	subStrand: string;
	text: string;
	code: string;
} {
	const trimmed = text.trim();
	const codeMatch = trimmed.match(/\(([A-Z0-9]+)\)\s*$/);
	const code = codeMatch?.[1] ?? '';
	const withoutCode = codeMatch ? trimmed.slice(0, -codeMatch[0].length).trim() : trimmed;
	return { subStrand: '', text: withoutCode, code };
}

export function parseContentDescriptionPair(
	strandLine: string,
	bodyLine: string
): { strand: string; subStrand: string; text: string; code: string } {
	const strandParts = strandLine.split('—').map((s) => s.trim());
	const strand = strandParts[0] ?? '';
	const subStrand = strandParts.slice(1).join(' — ').trim();
	const body = parseContentDescriptionLine(bodyLine);
	return {
		strand,
		subStrand: subStrand || body.subStrand,
		text: body.text,
		code: body.code
	};
}

export function parseWeekValue(text: string): number | '' {
	const trimmed = text.trim();
	if (!trimmed) return '';
	const match = trimmed.match(/Week\s*(\d+)/i) ?? trimmed.match(/^(\d+)$/);
	return match ? Number(match[1]) : '';
}

export function extractNthTextNode(sectionXml: string, index: number): string {
	let n = -1;
	let result = '';
	for (const match of sectionXml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)) {
		n++;
		if (n === index) {
			result = decodeXmlEntities(match[1]);
			break;
		}
	}
	return result;
}

export {
	extractTopLevelTables,
	extractTopLevelTablesWithSeparators,
	unwrapTable,
	cellText,
	extractCells,
	extractRows,
	extractNestedTables,
	extractParagraphs,
	extractTopLevelRows,
	extractTopLevelCells
};
