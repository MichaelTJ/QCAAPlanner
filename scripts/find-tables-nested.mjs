import fs from 'node:fs';

const xml = fs.readFileSync('.tmp-docx-debug/example/word/document.xml', 'utf8');

function extractTablesNested(xml) {
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
			if (depth === 0) {
				tables.push({
					start,
					end: close + 8,
					inner: xml.slice(start + 7, close),
					length: close + 8 - start
				});
			}
			i = close + 8;
		}
	}
	return tables;
}

const tables = extractTablesNested(xml);
console.log('Top-level tables:', tables.length);
tables.forEach((t, i) => {
	const rows = (t.inner.match(/<w:tr\b/g) || []).length;
	const cols = (t.inner.match(/<w:gridCol/g) || []).length;
	const nested = (t.inner.match(/<w:tbl>/g) || []).length;
	const text = [...t.inner.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
		.map((m) => m[1].trim())
		.filter(Boolean)
		.slice(0, 2)
		.join(' | ');
	console.log(`T${i}: ${rows} rows, ${cols} cols, ${nested} nested tbl — ${text}`);
});
