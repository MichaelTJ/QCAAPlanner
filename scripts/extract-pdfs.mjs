import fs from 'node:fs/promises';
import path from 'node:path';
import { PDFParse } from 'pdf-parse';

const FACULTY_DOCS = path.join(process.cwd(), 'FacultyDocs');
const OUT_DIR = path.join(process.cwd(), 'scripts', 'extracted');

async function walkPdfs(dir) {
	const entries = await fs.readdir(dir, { withFileTypes: true });
	const files = [];
	for (const entry of entries) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) files.push(...(await walkPdfs(full)));
		else if (entry.name.toLowerCase().endsWith('.pdf')) files.push(full);
	}
	return files;
}

async function main() {
	await fs.mkdir(OUT_DIR, { recursive: true });
	const pdfs = await walkPdfs(FACULTY_DOCS);
	for (const pdf of pdfs) {
		const buf = await fs.readFile(pdf);
		const parser = new PDFParse({ data: buf });
		const result = await parser.getText();
		await parser.destroy();
		const rel = path.relative(FACULTY_DOCS, pdf).replace(/[\\/]/g, '__');
		const outPath = path.join(OUT_DIR, `${rel}.txt`);
		await fs.writeFile(outPath, result.text, 'utf-8');
		console.log(`Extracted: ${rel} (${result.text.length} chars)`);
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
