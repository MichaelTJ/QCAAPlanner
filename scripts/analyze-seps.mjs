import fs from 'node:fs';
import AdmZip from 'adm-zip';
import { extractTopLevelTablesWithSeparators, extractTopLevelTables, unwrapTable } from '../src/lib/export/docx-xml.ts';

const buf = fs.readFileSync('FacultyDocs/Templates/Example_level_plan_Design_and_Technologies_Band_9-10_2026.docx');
const xml = new AdmZip(buf).getEntry('word/document.xml').getData().toString('utf8');
const { between } = extractTopLevelTablesWithSeparators(xml);
const tables = extractTopLevelTables(xml);
console.log('Table count:', tables.length);
console.log('Between count:', between.length);
between.forEach((sep, i) => {
	const preview = sep.replace(/\s+/g, ' ').slice(0, 80);
	console.log(`between[${i}]: len=${sep.length} "${preview}..."`);
});

// grid widths for overview
const ov = unwrapTable(tables[1]);
const grid = [...ov.matchAll(/<w:gridCol w:w="(\d+)"/g)].map(m => m[1]);
console.log('Overview grid:', grid);
