import fs from 'node:fs';
import AdmZip from 'adm-zip';
import { extractTopLevelTables, unwrapTable } from '../src/lib/export/docx-xml.ts';

function show(path, label) {
	const xml = new AdmZip(fs.readFileSync(path)).getEntry('word/document.xml').getData().toString('utf8');
	const tables = extractTopLevelTables(xml);
	const contentIdx = tables.length - 2;
	const inner = unwrapTable(tables[contentIdx]);
	const grid = [...inner.matchAll(/<w:gridCol w:w="(\d+)"/g)].map((m) => +m[1]);
	const tblW = inner.match(/<w:tblW w:w="(\d+)"/)?.[1];
	console.log(`\n${label}: ${grid.length} cols, tblW=${tblW}, sum=${grid.reduce((a,b)=>a+b,0)}`);
	console.log('widths:', grid.join(', '));
	console.log('text cols:', grid[0], grid[1+grid.length/2]);
}

show('FacultyDocs/Templates/Example_level_plan_Design_and_Technologies_Band_9-10_2026.docx', 'template 5u');
show('data/exports/design-and-technologies-band-9-10-2026-2units.docx', 'export 2u');
show('data/exports/design-and-technologies-band-9-10-2026-6units.docx', 'export 6u');
show('data/exports/design-and-technologies-band-9-10-2026.docx', 'export 5u');
