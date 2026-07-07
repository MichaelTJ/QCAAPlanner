import fs from 'node:fs';
import AdmZip from 'adm-zip';

function scan(file) {
	const x = new AdmZip(file).getEntry('word/document.xml').getData().toString('utf8');
	console.log(`\n=== ${file} ===`);

	const checks = [
		['empty tr', /<w:tr[^>]*>\s*<\/w:tr>/],
		['empty tc', /<w:tc[^>]*>\s*<\/w:tc>/],
		['double tr close', /<\/w:tr>\s*<\/w:tr>/],
		['tcW empty', /w:w=""/],
		['gridSpan 0', /gridSpan w:val="0"/],
		['invalid char', /[\x00-\x08\x0B\x0C\x0E-\x1F]/]
	];
	for (const [name, re] of checks) {
		if (re.test(x)) console.log('FAIL:', name);
	}

	const tags = ['w:p', 'w:r', 'w:tc', 'w:tr', 'w:tbl'];
	for (const t of tags) {
		const open = (x.match(new RegExp(`<${t}[\\s>]`, 'g')) || []).length;
		const close = (x.match(new RegExp(`</${t}>`, 'g')) || []).length;
		if (open !== close) console.log(`TAG ${t}: open=${open} close=${close}`);
	}

	// Compare zip entries
	const z = new AdmZip(file);
	console.log('zip entries:', z.getEntries().length);
}

for (const f of [
	'data/exports/design-and-technologies-band-9-10-2026-2units.docx',
	'data/exports/design-and-technologies-band-9-10-2026-6units.docx',
	'data/exports/design-and-technologies-band-9-10-2026.docx',
	'FacultyDocs/Templates/Example_level_plan_Design_and_Technologies_Band_9-10_2026.docx'
]) {
	if (fs.existsSync(f)) scan(f);
}

// Diff zip entry lists
function entries(f) {
	return new AdmZip(f)
		.getEntries()
		.map((e) => e.entryName)
		.sort();
}
const a = entries('data/exports/design-and-technologies-band-9-10-2026-2units.docx');
const b = entries('data/exports/design-and-technologies-band-9-10-2026.docx');
const onlyA = a.filter((e) => !b.includes(e));
const onlyB = b.filter((e) => !a.includes(e));
if (onlyA.length || onlyB.length) {
	console.log('\nZip diff 2unit vs 5unit:');
	console.log('only 2unit:', onlyA);
	console.log('only 5unit:', onlyB);
}
