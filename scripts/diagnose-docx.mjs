import fs from 'node:fs';
import AdmZip from 'adm-zip';

function check(file) {
	const zip = new AdmZip(file);
	const doc = zip.getEntry('word/document.xml').getData().toString('utf8');
	const openTbl = (doc.match(/<w:tbl>/g) || []).length;
	const closeTbl = (doc.match(/<\/w:tbl>/g) || []).length;
	const openTr = (doc.match(/<w:tr\b/g) || []).length;
	const closeTr = (doc.match(/<\/w:tr>/g) || []).length;
	const openTc = (doc.match(/<w:tc\b/g) || []).length;
	const closeTc = (doc.match(/<\/w:tc>/g) || []).length;

	console.log(`\n=== ${file} ===`);
	console.log(`tbl: ${openTbl}/${closeTbl}`, openTbl === closeTbl ? 'OK' : 'MISMATCH');
	console.log(`tr:  ${openTr}/${closeTr}`, openTr === closeTr ? 'OK' : 'MISMATCH');
	console.log(`tc:  ${openTc}/${closeTc}`, openTc === closeTc ? 'OK' : 'MISMATCH');

	// Check for invalid XML chars
	const bad = doc.match(/[\x00-\x08\x0B\x0C\x0E-\x1F]/);
	if (bad) console.log('Invalid XML chars found');

	// Try parse with regex balance for nested tables
	let depth = 0;
	let minD = 0;
	for (let i = 0; i < doc.length; i++) {
		if (doc.startsWith('<w:tbl>', i)) {
			depth++;
			i += 6;
		} else if (doc.startsWith('</w:tbl>', i)) {
			depth--;
			minD = Math.min(minD, depth);
			i += 7;
		}
	}
	console.log('Final tbl depth:', depth, 'min:', minD);

	// Find rows where cell count != grid cols
	const tables = [];
	depth = 0;
	let start = -1;
	let i = 0;
	while (i < doc.length) {
		const o = doc.indexOf('<w:tbl>', i);
		const c = doc.indexOf('</w:tbl>', i);
		if (o === -1 && c === -1) break;
		if (o !== -1 && (c === -1 || o < c)) {
			if (depth === 0) start = o;
			depth++;
			i = o + 7;
		} else {
			depth--;
			if (depth === 0) tables.push(doc.slice(start, c + 8));
			i = c + 8;
		}
	}

	tables.forEach((tbl, ti) => {
		const inner = tbl.slice(7, -8);
		const grid = inner.match(/<w:tblGrid>[\s\S]*?<\/w:tblGrid>/)?.[0] ?? '';
		const colCount = (grid.match(/gridCol/g) || []).length;
		const rows = [...inner.matchAll(/<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/g)];
		rows.forEach((rm, ri) => {
			const cells = (rm[1].match(/<w:tc\b/g) || []).length;
			if (cells !== colCount && cells > 0 && colCount > 0) {
				const text = [...rm[1].matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
					.map((m) => m[1])
					.join('|')
					.slice(0, 40);
				console.log(`T${ti} R${ri}: ${cells} cells vs ${colCount} grid cols "${text}"`);
			}
		});
	});
}

for (const f of [
	'data/exports/design-and-technologies-band-9-10-2026-2units.docx',
	'data/exports/design-and-technologies-band-9-10-2026-6units.docx',
	'data/exports/design-and-technologies-band-9-10-2026.docx'
]) {
	if (fs.existsSync(f)) check(f);
}
