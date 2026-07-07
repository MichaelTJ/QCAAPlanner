import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const example = fs.readFileSync(path.join(ROOT, '.tmp-docx-debug/example/word/document.xml'), 'utf8');
const exported = fs.readFileSync(path.join(ROOT, '.tmp-docx-debug/export/word/document.xml'), 'utf8');

function validate(label, xml) {
	console.log(`\n=== ${label} ===`);
	const openTbl = (xml.match(/<w:tbl>/g) || []).length;
	const closeTbl = (xml.match(/<\/w:tbl>/g) || []).length;
	const openTr = (xml.match(/<w:tr\b/g) || []).length;
	const closeTr = (xml.match(/<\/w:tr>/g) || []).length;
	const openTc = (xml.match(/<w:tc\b/g) || []).length;
	const closeTc = (xml.match(/<\/w:tc>/g) || []).length;
	console.log('tbl', openTbl, closeTbl, openTbl === closeTbl ? 'OK' : 'MISMATCH');
	console.log('tr', openTr, closeTr, openTr === closeTr ? 'OK' : 'MISMATCH');
	console.log('tc', openTc, closeTc, openTc === closeTc ? 'OK' : 'MISMATCH');

	const bareAmp = [...xml.matchAll(/&(?!(amp|lt|gt|quot|apos|#\d+;|#x[0-9a-fA-F]+;))/g)];
	console.log('bare ampersands:', bareAmp.length);
	if (bareAmp.length) {
		for (const m of bareAmp.slice(0, 3)) {
			console.log('  at', m.index, JSON.stringify(xml.slice(m.index, m.index + 40)));
		}
	}
}

function checkRowCellCounts(label, xml) {
	const tables = [];
	const re = /<w:tbl>([\s\S]*?)<\/w:tbl>/g;
	let m;
	while ((m = re.exec(xml))) tables.push(m[1]);

	console.log(`\n=== ${label} row/cell grid check ===`);
	let issues = 0;
	tables.forEach((tbl, ti) => {
		const gridCols = (tbl.match(/<w:gridCol/g) || []).length;
		const rows = [...tbl.matchAll(/<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/g)];
		rows.forEach((rm, ri) => {
			const cells = (rm[1].match(/<w:tc\b/g) || []).length;
			const gridSpans = [...rm[1].matchAll(/<w:gridSpan w:val="(\d+)"/g)].map((x) => +x[1]);
			const effective = cells + gridSpans.reduce((a, b) => a + b - 1, 0);
			if (gridCols > 0 && effective !== gridCols && cells > 0) {
				issues++;
				console.log(
					`  T${ti} R${ri}: grid=${gridCols} cells=${cells} spans=[${gridSpans}] effective=${effective}`
				);
			}
		});
	});
	if (!issues) console.log('  no grid mismatches');
}

validate('Example', example);
validate('Export', exported);
checkRowCellCounts('Example', example);
checkRowCellCounts('Export', exported);

const tail = (x) => x.slice(x.lastIndexOf('</w:tbl>') + 8);
console.log('\nTails match:', tail(exported) === tail(example));

// Check for nested w:tbl inside rebuilt tables (double wrap)
const doubleTbl = exported.match(/<w:tbl>[^<]*<w:tbl>/g);
console.log('nested tbl tags:', doubleTbl ? doubleTbl.length : 0);

// Check document root
console.log('\nExport starts with:', exported.slice(0, 120));
console.log('Export ends with:', exported.slice(-120));
