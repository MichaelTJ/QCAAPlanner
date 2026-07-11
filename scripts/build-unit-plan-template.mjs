/**
 * Build a cleaned blank unit-plan Word template from PDF-converted examples.
 * Drops page-break continuation headers and splits the DigiLit mega-table
 * into logical sections for template-based export.
 */
import AdmZip from 'adm-zip';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const HELPERS = path.join(ROOT, 'AssignemntHelpers');
const OUT = path.join(
	ROOT,
	'FacultyDocs/Templates/Example_unit_plan_Digital_Technologies_Year_7_Unit_1_2026.docx'
);

function findUnitPlan(predicate) {
	const name = fs.readdirSync(HELPERS).find((f) => f.startsWith('unit_plan') && predicate(f));
	if (!name) throw new Error(`No unit_plan matching ${predicate}`);
	return path.join(HELPERS, name);
}

function extractTopLevelTables(xml) {
	const tables = [];
	let depth = 0;
	let start = -1;
	let i = 0;
	while (i < xml.length) {
		const open = xml.indexOf('<w:tbl>', i);
		const close = xml.indexOf('</w:tbl>', i);
		if (open === -1 && close === -1) break;
		if (open !== -1 && (close === -1 || open < close)) {
			if (depth === 0) start = open;
			depth++;
			i = open + 7;
		} else {
			depth--;
			if (depth === 0) tables.push(xml.slice(start, close + 8));
			i = close + 8;
		}
	}
	return tables;
}

function unwrapTable(tableXml) {
	return tableXml.replace(/^<w:tbl>/, '').replace(/<\/w:tbl>$/, '');
}

function wrapTable(inner) {
	return `<w:tbl>${inner}</w:tbl>`;
}

function findRowEnd(xml, start) {
	let i = start + 5;
	let depth = 1;
	while (i < xml.length) {
		const open = xml.indexOf('<w:tr', i);
		const close = xml.indexOf('</w:tr>', i);
		if (close === -1) return -1;
		if (open !== -1 && open < close) {
			const next = xml[open + 5];
			if (next === '>' || next === ' ' || next === '\t' || next === '\n' || next === '\r') {
				depth++;
				i = open + 5;
				continue;
			}
			i = open + 5;
			continue;
		}
		depth--;
		if (depth === 0) return close + 7;
		i = close + 7;
	}
	return -1;
}

function extractTopLevelRows(tableInnerXml) {
	const rows = [];
	let i = 0;
	while (i < tableInnerXml.length) {
		if (tableInnerXml.startsWith('<w:tbl>', i)) {
			let depth = 1;
			i += 7;
			while (i < tableInnerXml.length && depth > 0) {
				const o = tableInnerXml.indexOf('<w:tbl>', i);
				const c = tableInnerXml.indexOf('</w:tbl>', i);
				if (c < 0) break;
				if (o !== -1 && o < c) {
					depth++;
					i = o + 7;
				} else {
					depth--;
					i = c + 8;
				}
			}
			continue;
		}
		const trStart = tableInnerXml.indexOf('<w:tr', i);
		if (trStart < 0) break;
		const next = tableInnerXml[trStart + 5];
		if (!(next === '>' || next === ' ' || next === '\t' || next === '\n' || next === '\r')) {
			i = trStart + 5;
			continue;
		}
		const trEnd = findRowEnd(tableInnerXml, trStart);
		if (trEnd < 0) break;
		rows.push(tableInnerXml.slice(trStart, trEnd));
		i = trEnd;
	}
	return rows;
}

function cellText(cellXml) {
	return [...cellXml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
		.map((m) => m[1])
		.join('')
		.replace(/\s+/g, ' ')
		.trim();
}

function extractCells(rowXml) {
	const cells = [];
	let i = 0;
	while (i < rowXml.length) {
		const tcStart = rowXml.indexOf('<w:tc', i);
		if (tcStart < 0) break;
		const next = rowXml[tcStart + 5];
		if (!(next === '>' || next === ' ' || next === '\t' || next === '\n' || next === '\r')) {
			i = tcStart + 5;
			continue;
		}
		let depth = 1;
		let j = tcStart + 5;
		while (j < rowXml.length && depth > 0) {
			const o = rowXml.indexOf('<w:tc', j);
			const c = rowXml.indexOf('</w:tc>', j);
			if (c < 0) break;
			if (o !== -1 && o < c) {
				const n = rowXml[o + 5];
				if (n === '>' || n === ' ' || n === '\t' || n === '\n' || n === '\r') {
					depth++;
					j = o + 5;
					continue;
				}
				j = o + 5;
				continue;
			}
			depth--;
			if (depth === 0) {
				cells.push(rowXml.slice(tcStart, c + 7));
				i = c + 7;
				break;
			}
			j = c + 7;
		}
		if (depth !== 0) break;
	}
	return cells;
}

function setCellText(cellXml, text) {
	const tcPr = cellXml.match(/<w:tcPr>[\s\S]*?<\/w:tcPr>/)?.[0] ?? '';
	const tcOpen = cellXml.match(/^<w:tc\b[^>]*>/)?.[0] ?? '<w:tc>';
	const lines = String(text).split(/\r?\n/);
	const paragraphs = lines
		.map((line) => {
			const escaped = line
				.replace(/&/g, '&amp;')
				.replace(/</g, '&lt;')
				.replace(/>/g, '&gt;')
				.replace(/"/g, '&quot;');
			const preserve =
				line.includes('  ') || line.startsWith(' ') || line.endsWith(' ')
					? ' xml:space="preserve"'
					: '';
			return `<w:p><w:r><w:t${preserve}>${escaped}</w:t></w:r></w:p>`;
		})
		.join('');
	return `${tcOpen}${tcPr}${paragraphs || '<w:p/>'}</w:tc>`;
}

function replaceRowCells(rowXml, values) {
	const cells = extractCells(rowXml);
	const rowOpen = rowXml.match(/^<w:tr\b[^>]*>/)?.[0] ?? '<w:tr>';
	const trPr = rowXml.match(/<w:trPr>[\s\S]*?<\/w:trPr>/)?.[0] ?? '';
	const updated = cells.map((cell, i) => setCellText(cell, values[i] ?? ''));
	// Keep extra cells if values shorter; pad if longer by cloning last
	while (updated.length < values.length && cells.length) {
		updated.push(setCellText(cells[cells.length - 1], values[updated.length] ?? ''));
	}
	return `${rowOpen}${trPr}${updated.join('')}</w:tr>`;
}

function rebuildTable(tableXml, rows) {
	const inner = unwrapTable(tableXml);
	const tblPr = inner.match(/<w:tblPr>[\s\S]*?<\/w:tblPr>/)?.[0] ?? '';
	const tblGrid = inner.match(/<w:tblGrid>[\s\S]*?<\/w:tblGrid>/)?.[0] ?? '';
	return wrapTable(`${tblPr}${tblGrid}${rows.join('')}`);
}

function tablePropsFrom(tableXml, gridColWidths) {
	const inner = unwrapTable(tableXml);
	let tblPr = inner.match(/<w:tblPr>[\s\S]*?<\/w:tblPr>/)?.[0] ?? '<w:tblPr/>';
	const grid =
		gridColWidths && gridColWidths.length
			? `<w:tblGrid>${gridColWidths.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>`
			: inner.match(/<w:tblGrid>[\s\S]*?<\/w:tblGrid>/)?.[0] ?? '<w:tblGrid/>';
	return { tblPr, grid };
}

function makeTable(shellTableXml, rows, gridColWidths) {
	const { tblPr, grid } = tablePropsFrom(shellTableXml, gridColWidths);
	return wrapTable(`${tblPr}${grid}${rows.join('')}`);
}

function rowTexts(row) {
	return extractCells(row).map((c) => cellText(c));
}

function isTeachingHeader(texts) {
	const joined = texts.join(' ').toLowerCase();
	return joined.includes('teaching and learning sequence') && texts.length <= 2;
}

function isColumnHeader(texts) {
	const lower = texts.map((t) => t.toLowerCase());
	return lower[0] === 'week' && lower.some((t) => t.includes('theory'));
}

function isAssessmentBanner(texts) {
	return /^Assessment\s+\d+/i.test(texts[0] ?? '') && texts.every((t, i) => i === 0 || !t);
}

const SEP =
	'<w:p w14:paraId="7F64BFB3" w14:textId="77777777" w:rsidR="00126D17" w:rsidRDefault="00126D17"/>';

function main() {
	const y7Path = findUnitPlan((f) => f.includes('Year_7'));
	const y9Path = findUnitPlan((f) => f.includes('Year_9'));
	console.log('Y7:', path.basename(y7Path));
	console.log('Y9:', path.basename(y9Path));

	const y7Zip = new AdmZip(y7Path);
	const y9Zip = new AdmZip(y9Path);
	const y7Xml = y7Zip.getEntry('word/document.xml').getData().toString('utf8');
	const y9Xml = y9Zip.getEntry('word/document.xml').getData().toString('utf8');

	const y7Tables = extractTopLevelTables(y7Xml);
	const y9Tables = extractTopLevelTables(y9Xml);
	console.log('Y7 tables', y7Tables.length, 'Y9 tables', y9Tables.length);

	// --- Overview from Y7 T0 ---
	const overviewShell = y7Tables[0];
	const overviewRows = extractTopLevelRows(unwrapTable(overviewShell));
	const overview = rebuildTable(overviewShell, [
		replaceRowCells(overviewRows[0], [
			'Unit overview',
			'Cohort and/or class considerations'
		]),
		replaceRowCells(overviewRows[1], [
			'Start week: {start}\nFinish week: {finish}\n{unit description}',
			'{cohort and class considerations}'
		])
	]);

	// --- Adjustments from Y9 T1 ---
	const adjShell = y9Tables[1];
	const adjRows = extractTopLevelRows(unwrapTable(adjShell));
	console.log(
		'Adjustments rows',
		adjRows.length,
		adjRows.map((r) => rowTexts(r)[0])
	);
	const adjustments = rebuildTable(
		adjShell,
		adjRows.map((row, i) => {
			const texts = rowTexts(row);
			if (i === 0) return replaceRowCells(row, ['Adjustments', '']);
			return replaceRowCells(row, [texts[0] || '', '']);
		})
	);

	// --- Assessment block: DigiLit mega (2-col CDs) + skip PDF Technique orphan ---
	const megaRows = extractTopLevelRows(unwrapTable(y7Tables[1]));
	console.log('Y7 mega rows', megaRows.length);
	megaRows.forEach((r, i) => {
		const t = rowTexts(r);
		console.log(`  mega R${i} (${t.length}):`, t.map((x) => x.slice(0, 50)));
	});

	const assessEnd = megaRows.findIndex((r) =>
		rowTexts(r).join(' ').toLowerCase().includes('general capabilities')
	);
	const assessRows = megaRows.slice(0, assessEnd > 0 ? assessEnd : 19);

	const assessmentTemplateRows = [];
	let sawContentHeader = false;
	let sawStrandHeader = false;
	let cdRowKept = false;
	for (const row of assessRows) {
		const texts = rowTexts(row);
		const label = (texts[0] ?? '').trim();
		const lower = label.toLowerCase();

		// Skip PDF continuation artifacts (orphan Technique value, repeated banners)
		if (isAssessmentBanner(texts) && assessmentTemplateRows.length > 0) continue;
		if (!label && /^portfolio$/i.test(texts[1] ?? '')) continue;

		if (/^Assessment\s+\d+/i.test(label)) {
			assessmentTemplateRows.push(replaceRowCells(row, ['Assessment {n}']));
			continue;
		}
		if (/^Year\s+\d+/i.test(label) && texts.length <= 2) {
			assessmentTemplateRows.push(replaceRowCells(row, ['Year {level}']));
			continue;
		}
		if (label === 'Title') {
			assessmentTemplateRows.push(replaceRowCells(row, ['Title', '{title}']));
			continue;
		}
		if (label === 'Description') {
			assessmentTemplateRows.push(replaceRowCells(row, ['Description', '{description}']));
			continue;
		}
		if (label === 'Technique') {
			assessmentTemplateRows.push(replaceRowCells(row, ['Technique', '{technique}']));
			continue;
		}
		if (label === 'Mode') {
			assessmentTemplateRows.push(replaceRowCells(row, ['Mode', '{mode}']));
			continue;
		}
		if (label === 'Conditions') {
			assessmentTemplateRows.push(replaceRowCells(row, ['Conditions', '{conditions}']));
			continue;
		}
		if (label === 'Timing') {
			assessmentTemplateRows.push(replaceRowCells(row, ['Timing', '{timing}']));
			continue;
		}
		if (lower.startsWith('achievement')) {
			assessmentTemplateRows.push(
				replaceRowCells(row, ['Achievement standard', '{achievement standard}'])
			);
			continue;
		}
		if (label === 'Moderation') {
			assessmentTemplateRows.push(replaceRowCells(row, ['Moderation', '{moderation}']));
			continue;
		}
		if (lower.includes('content descriptions')) {
			sawContentHeader = true;
			assessmentTemplateRows.push(replaceRowCells(row, ['Content descriptions', '']));
			continue;
		}
		if (
			sawContentHeader &&
			!sawStrandHeader &&
			(lower.includes('knowledge') || texts.some((t) => /processes/i.test(t)))
		) {
			sawStrandHeader = true;
			assessmentTemplateRows.push(
				replaceRowCells(row, [
					'Knowledge and understanding',
					'Processes and production skills'
				])
			);
			continue;
		}
		if (sawStrandHeader && !cdRowKept && texts.length >= 2) {
			cdRowKept = true;
			assessmentTemplateRows.push(
				replaceRowCells(row, ['{content description}', '{content description}'])
			);
			continue;
		}
		if (sawStrandHeader && cdRowKept) continue;
	}

	console.log(
		'Assessment template rows',
		assessmentTemplateRows.length,
		assessmentTemplateRows.map((r) => rowTexts(r))
	);

	const assessmentTable = makeTable(y7Tables[1], assessmentTemplateRows);

	// --- Capabilities from DigiLit mega ---
	const capStart = megaRows.findIndex((r) =>
		rowTexts(r).join(' ').toLowerCase().includes('general capabilities')
	);
	const teachStart = megaRows.findIndex((r) =>
		rowTexts(r).join(' ').toLowerCase().includes('teaching and learning sequence')
	);
	const capRowsSrc = megaRows.slice(
		capStart >= 0 ? capStart : 19,
		teachStart > capStart ? teachStart : megaRows.length
	);
	const capTemplateRows = [];
	for (let i = 0; i < capRowsSrc.length; i++) {
		const texts = rowTexts(capRowsSrc[i]);
		const label = texts[0] ?? '';
		if (i === 0 || /general capabilities/i.test(label)) {
			capTemplateRows.push(replaceRowCells(capRowsSrc[i], ['General capabilities']));
			// Keep one name / sub-elements / evidence triplet as shells
			if (capRowsSrc[i + 1]) {
				capTemplateRows.push(replaceRowCells(capRowsSrc[i + 1], ['{capability name}']));
			}
			if (capRowsSrc[i + 2]) {
				capTemplateRows.push(replaceRowCells(capRowsSrc[i + 2], ['{sub-elements}']));
			}
			if (capRowsSrc[i + 3]) {
				capTemplateRows.push(replaceRowCells(capRowsSrc[i + 3], ['{evidence notes}']));
			}
			break;
		}
	}
	console.log('Capability template rows', capTemplateRows.length);
	const capabilitiesTable = makeTable(y7Tables[1], capTemplateRows, [14566]);

	// --- Teaching sequence: merge DigiLit T1 tail + T2–T7, drop continuation headers ---
	const weekSourceRows = [];
	// From mega: from teaching header onward
	if (teachStart >= 0) {
		weekSourceRows.push(...megaRows.slice(teachStart));
	}
	for (let ti = 2; ti < y7Tables.length; ti++) {
		const rows = extractTopLevelRows(unwrapTable(y7Tables[ti]));
		for (const row of rows) {
			const texts = rowTexts(row);
			if (isTeachingHeader(texts)) continue;
			if (texts[0]?.toLowerCase() === 'evaluation') continue;
			if (texts.every((t) => !t) && texts.length <= 1) continue;
			weekSourceRows.push(row);
		}
	}

	const weekTemplateRows = [];
	let keptColumnHeader = false;
	let keptMain = false;
	let keptAdj = false;
	let keptRes = false;
	for (const row of weekSourceRows) {
		const texts = rowTexts(row);
		if (isTeachingHeader(texts)) {
			if (weekTemplateRows.length === 0) {
				weekTemplateRows.push(replaceRowCells(row, ['Teaching and learning sequence']));
			}
			continue;
		}
		if (isColumnHeader(texts)) {
			if (!keptColumnHeader) {
				keptColumnHeader = true;
				weekTemplateRows.push(
					replaceRowCells(row, ['Week', 'Planning details', 'Theory', 'Prac', 'Assessment'])
				);
			}
			continue;
		}
		const c0 = (texts[0] ?? '').trim();
		const c1 = (texts[1] ?? '').trim();
		const c2 = (texts[2] ?? '').trim();

		// Evaluation leaked into last teaching table
		if (/^evaluation$/i.test(c0)) break;

		// Main week row: has week number
		if (/^\d+$/.test(c0) && !keptMain) {
			keptMain = true;
			weekTemplateRows.push(
				replaceRowCells(row, [
					'{week}',
					'Key teaching and learning experiences',
					'{theory}',
					'{prac}',
					'{assessment}'
				])
			);
			continue;
		}

		// Adjustments row
		if ((c2 === 'Adjustments' || c1 === 'Adjustments' || texts.includes('Adjustments')) && !keptAdj) {
			keptAdj = true;
			const cells = extractCells(row);
			if (cells.length >= 5) {
				weekTemplateRows.push(replaceRowCells(row, ['', '', 'Adjustments', '{adjustments}', '']));
			} else if (cells.length >= 4) {
				weekTemplateRows.push(replaceRowCells(row, ['', '', 'Adjustments', '{adjustments}']));
			} else {
				weekTemplateRows.push(replaceRowCells(row, ['Adjustments', '{adjustments}']));
			}
			continue;
		}

		// Resources row
		if ((c2 === 'Resources' || c1 === 'Resources' || texts.includes('Resources')) && !keptRes) {
			keptRes = true;
			const cells = extractCells(row);
			if (cells.length >= 5) {
				weekTemplateRows.push(replaceRowCells(row, ['', '', 'Resources', '{resources}', '']));
			} else if (cells.length >= 4) {
				weekTemplateRows.push(replaceRowCells(row, ['', '', 'Resources', '{resources}']));
			} else {
				weekTemplateRows.push(replaceRowCells(row, ['Resources', '{resources}']));
			}
			continue;
		}
	}

	// Ensure we have section + column + week triplet even if detection failed
	if (weekTemplateRows.length < 5) {
		console.warn('Week template incomplete, synthesizing from available shells');
		const shell5 = extractTopLevelRows(unwrapTable(y7Tables[2]));
		const titleRow = shell5[0] ?? weekSourceRows[0];
		const colRow = shell5.find((r) => isColumnHeader(rowTexts(r))) ?? shell5[1];
		const mainRow = shell5.find((r) => /^\d+$/.test(rowTexts(r)[0] ?? '')) ?? shell5[2];
		const adjRow = shell5.find((r) => rowTexts(r).includes('Adjustments')) ?? shell5[3];
		const resRow = shell5.find((r) => rowTexts(r).includes('Resources')) ?? shell5[4];
		weekTemplateRows.length = 0;
		weekTemplateRows.push(replaceRowCells(titleRow, ['Teaching and learning sequence']));
		weekTemplateRows.push(
			replaceRowCells(colRow, ['Week', 'Planning details', 'Theory', 'Prac', 'Assessment'])
		);
		weekTemplateRows.push(
			replaceRowCells(mainRow, [
				'{week}',
				'Key teaching and learning experiences',
				'{theory}',
				'{prac}',
				'{assessment}'
			])
		);
		weekTemplateRows.push(replaceRowCells(adjRow, ['', '', 'Adjustments', '{adjustments}', '']));
		weekTemplateRows.push(replaceRowCells(resRow, ['', '', 'Resources', '{resources}', '']));
	}

	console.log(
		'Week template rows',
		weekTemplateRows.length,
		weekTemplateRows.map((r) => rowTexts(r))
	);
	const teachingTable = makeTable(y7Tables[2], weekTemplateRows);

	// --- Evaluation from Y9 T6 or DigiLit last ---
	const evalShell = y9Tables[6] ?? y7Tables[y7Tables.length - 1];
	const evalRows = extractTopLevelRows(unwrapTable(evalShell));
	const evaluation = rebuildTable(evalShell, [
		replaceRowCells(evalRows[0], ['Evaluation']),
		replaceRowCells(evalRows[1] ?? evalRows[0], ['{evaluation}'])
	]);

	// --- Assemble document from Y7 shell (before/tail/footers) ---
	const bodyStart = y7Xml.indexOf('<w:body>');
	const bodyEnd = y7Xml.lastIndexOf('</w:body>');
	const beforeTables = y7Xml.slice(0, y7Xml.indexOf('<w:tbl>'));
	// Keep only first 3 title text paragraphs worth — simplify before section
	// Use Y7 before but replace title texts with placeholders via simple text node replace later in export.
	// For template, set clean title paragraphs.
	let before = beforeTables;
	// Deduplicate title: keep structure, set placeholder texts on first 3 text nodes
	let textIdx = 0;
	const titleTexts = [
		'Year {level} {subject}',
		'Unit {n} — {title}',
		"St Brendan's College (Yeppoon), {year}"
	];
	before = before.replace(/<w:t([^>]*)>[^<]*<\/w:t>/g, (match, attrs) => {
		if (textIdx < titleTexts.length) {
			const t = titleTexts[textIdx++];
			return `<w:t>${t.replace(/&/g, '&amp;')}</w:t>`;
		}
		// Clear duplicate title nodes
		if (textIdx < 6) {
			textIdx++;
			const t = titleTexts[(textIdx - 1) % 3];
			return `<w:t>${t.replace(/&/g, '&amp;')}</w:t>`;
		}
		return match;
	});

	const sectPrMatch = y7Xml.slice(bodyStart, bodyEnd + 10).match(/<w:sectPr[\s\S]*<\/w:sectPr>/);
	const sectPr = sectPrMatch?.[0] ?? '';
	// Tail: copyright paragraphs from after last table, minus sectPr
	const lastTblEnd = y7Xml.lastIndexOf('</w:tbl>') + 8;
	let tail = y7Xml.slice(lastTblEnd, bodyEnd);
	// Ensure evaluation isn't duplicated in tail
	tail = tail.replace(/Evaluation[\s\S]*?(?=<w:sectPr|$)/, '');
	if (!tail.includes('sectPr') && sectPr) {
		tail = `${SEP}${sectPr}`;
	} else if (!tail.trim()) {
		tail = `${SEP}${sectPr}`;
	}

	const tables = [overview, adjustments, assessmentTable, capabilitiesTable, teachingTable, evaluation];
	const between = tables.slice(0, -1).map(() => SEP);
	let body = before;
	for (let i = 0; i < tables.length; i++) {
		body += tables[i];
		if (i < between.length) body += between[i];
	}
	body += tail;
	if (!body.includes('</w:body>')) {
		// before included up to first tbl which is inside body — reconstruct
		const pre = y7Xml.slice(0, bodyStart + '<w:body>'.length);
		// before currently includes from start of file through before first table (includes <w:body>)
	}

	// Rebuild full document properly
	const preBody = y7Xml.slice(0, bodyStart + '<w:body>'.length);
	// Strip leading body open from `before` if present
	let beforeInner = before;
	if (beforeInner.includes('<w:body>')) {
		beforeInner = beforeInner.slice(beforeInner.indexOf('<w:body>') + '<w:body>'.length);
	}
	const newDocumentXml =
		preBody +
		beforeInner +
		tables.map((t, i) => t + (i < tables.length - 1 ? SEP : '')).join('') +
		(tail.includes('sectPr') ? (tail.startsWith('<w:p') || tail.startsWith('<w:sectPr') ? SEP + '' : '') + tail : SEP + sectPr) +
		'</w:body></w:document>';

	// Fix possible double body close / missing copyright — keep simple copyright from Y9/Y7
	const copyright =
		y7Xml.includes('Queensland Curriculum')
			? y7Xml.slice(
					y7Xml.indexOf('<w:p', lastTblEnd),
					y7Xml.indexOf('<w:sectPr', lastTblEnd)
				)
			: '';

	const finalXml =
		preBody +
		beforeInner +
		tables.map((t, i) => t + (i < tables.length - 1 ? SEP : '')).join('') +
		(copyright || '') +
		sectPr +
		'</w:body></w:document>';

	// Validate table count
	const outTables = extractTopLevelTables(finalXml);
	console.log('Output tables:', outTables.length);
	outTables.forEach((t, i) => {
		const rows = extractTopLevelRows(unwrapTable(t));
		console.log(`  T${i}: ${rows.length} rows —`, rows.slice(0, 3).map((r) => rowTexts(r)));
	});

	fs.mkdirSync(path.dirname(OUT), { recursive: true });
	y7Zip.updateFile('word/document.xml', Buffer.from(finalXml, 'utf8'));

	// Update footers with placeholders
	for (const entry of y7Zip.getEntries()) {
		if (!/^word\/footer\d*\.xml$/i.test(entry.entryName)) continue;
		let fxml = entry.getData().toString('utf8');
		fxml = fxml
			.replace(/Digital Technologies Year \d+ \d{4}/g, '{subject} Year {level} {year}')
			.replace(/Unit plan: Unit \d+/g, 'Unit plan: Unit {n}')
			.replace(/Status: [^<]+/g, 'Status: {status}')
			.replace(/Printed: [^<]+/g, 'Printed: {printed}');
		y7Zip.updateFile(entry.entryName, Buffer.from(fxml, 'utf8'));
	}

	fs.writeFileSync(OUT, y7Zip.toBuffer());
	console.log('Wrote', OUT);
}

main();
