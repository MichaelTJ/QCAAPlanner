import fs from 'node:fs';

const nw = fs.readFileSync('.tmp-docx-debug/export/word/document.xml', 'utf8');
const ex = fs.readFileSync('.tmp-docx-debug/example/word/document.xml', 'utf8');

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

function analyze(label, xml) {
	const wInner = extractTopLevelTables(xml)[5].slice(7, -8);
	const wrapperRows = [...wInner.matchAll(/<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/g)];
	console.log(`\n=== ${label}: ${wrapperRows.length} wrapper rows ===`);

	const nestedTables = [];
	let pos = 0;
	while (pos < wInner.length) {
		const open = wInner.indexOf('<w:tbl>', pos);
		if (open < 0) break;
		let depth = 0;
		let j = open;
		while (j < wInner.length) {
			if (wInner.startsWith('<w:tbl>', j)) depth++;
			if (wInner.startsWith('</w:tbl>', j)) {
				depth--;
				if (depth === 0) {
					const tbl = wInner.slice(open, j + 8);
					const rows = [...tbl.slice(7, -8).matchAll(/<w:tr\b[^>]*>/g)];
					nestedTables.push({ start: open, rows: rows.length });
					pos = j + 8;
					break;
				}
			}
			j++;
		}
	}

	console.log('Nested tables:', nestedTables);

	// Which wrapper rows contain nested tables?
	wrapperRows.forEach((rm, ri) => {
		const nested = (rm[0].match(/<w:tbl>/g) || []).length;
		if (nested) console.log(`WR${ri} has ${nested} nested table(s)`);
	});

	// First nested table row count and first row text
	const capStart = wInner.indexOf('<w:tbl>');
	const capEnd = wInner.indexOf('</w:tbl>', capStart) + 8;
	const capInner = wInner.slice(capStart + 7, capEnd - 8);
	const capRows = [...capInner.matchAll(/<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/g)];
	console.log(`First nested table: ${capRows.length} rows`);
	capRows.forEach((rm, ri) => {
		const cells = [...rm[1].matchAll(/<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/g)];
		const texts = cells.map((c) =>
			[...c[1].matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('').trim()
		);
		console.log(`  NR${ri}: [${texts.join(' | ')}]`);
	});
}

analyze('EXPORT', nw);
analyze('EXAMPLE', ex);
