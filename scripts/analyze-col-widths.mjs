import fs from 'node:fs';

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

function getNested(xml, idx) {
	const w = extractTopLevelTables(xml)[5].slice(7, -8);
	let pos = 0;
	let n = 0;
	while (pos < w.length) {
		const open = w.indexOf('<w:tbl>', pos);
		if (open < 0) break;
		let depth = 0;
		let j = open;
		while (j < w.length) {
			if (w.startsWith('<w:tbl>', j)) depth++;
			if (w.startsWith('</w:tbl>', j)) {
				depth--;
				if (depth === 0) {
					const tbl = w.slice(open, j + 8);
					if (n === idx) return tbl;
					n++;
					pos = j + 8;
					break;
				}
			}
			j++;
		}
	}
}

function analyze(label, tbl) {
	const inner = tbl.slice(7, -8);
	const grid = [...(inner.match(/<w:gridCol w:w="(\d+)"/g) ?? [])].map((m) => m.match(/(\d+)/)[1]);
	const tblW = inner.match(/<w:tblW w:w="(\d+)"/)?.[1];
	console.log(`\n=== ${label} ===`);
	console.log('tblW:', tblW, 'grid:', grid, 'sum:', grid.reduce((a, b) => +a + +b, 0));

	const row = inner.match(/<w:tr\b[^>]*>[\s\S]*?<\/w:tr>/)?.[0] ?? '';
	const cells = [...row.matchAll(/<w:tcW w:w="(\d+)"[^/]*\/>/g)].map((m) => m[1]);
	console.log('row0 tcW:', cells);

	// paragraphs before first table in wrapper cells
	const paras = inner.match(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g) ?? [];
	console.log('paras before first tr:', paras.length);
	if (paras.length) {
		const t = paras[0].match(/<w:t[^>]*>([^<]*)<\/w:t>/)?.[1] ?? '(empty)';
		console.log('first para text:', JSON.stringify(t));
	}
}

const wrapper = extractTopLevelTables(ex)[5];
analyze('WRAPPER', wrapper);
analyze('CAP NESTED', getNested(ex, 0));
analyze('CCP NESTED', getNested(ex, 1));

// cm to dxa: Word uses 567 twips per cm (1440/2.54)
console.log('\n2.04cm =', Math.round(2.04 * 567));
console.log('17.99cm =', Math.round(17.99 * 567));
console.log('19.44cm =', Math.round(19.44 * 567));
