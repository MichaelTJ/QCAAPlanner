import fs from 'node:fs';
import path from 'node:path';

const xml = fs.readFileSync(path.join(process.cwd(), '.tmp-docx-debug/example/word/document.xml'), 'utf8');

function extractTables(xml) {
	const tables = [];
	const re = /<w:tbl>([\s\S]*?)<\/w:tbl>/g;
	let m;
	while ((m = re.exec(xml))) tables.push(m[1]);
	return tables;
}

const tables = extractTables(xml);
console.log('extractTables count:', tables.length);
console.log('simple count:', (xml.match(/<w:tbl>/g) || []).length);

tables.forEach((tbl, i) => {
	const rows = (tbl.match(/<w:tr\b/g) || []).length;
	const cols = (tbl.match(/<w:gridCol/g) || []).length;
	const text = [...tbl.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
		.map((m) => m[1])
		.filter((t) => t.trim())
		.slice(0, 3)
		.join(' | ');
	console.log(`T${i}: ${rows} rows, ${cols} cols — ${text}`);
});

// Find content after table 6
let pos = 0;
for (let i = 0; i < 7; i++) {
	const start = xml.indexOf('<w:tbl>', pos);
	const end = xml.indexOf('</w:tbl>', start) + 8;
	pos = end;
}
const after = xml.slice(pos, pos + 2000);
console.log('\nAfter 7th table close:', after.slice(0, 500));
