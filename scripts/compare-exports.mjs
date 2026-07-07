import fs from 'node:fs/promises';
import path from 'node:path';
import { PDFParse } from 'pdf-parse';
import { LEVEL_PLANS } from './manifest.mjs';

const ROOT = process.cwd();
const FACULTY_DOCS = path.join(ROOT, 'FacultyDocs');
const EXPORTS = path.join(ROOT, 'data', 'exports');
const REPORT = path.join(ROOT, 'data', 'exports', 'comparison-report.md');

async function extractPdfText(pdfPath) {
	const buf = await fs.readFile(pdfPath);
	const parser = new PDFParse({ data: buf });
	const result = await parser.getText();
	await parser.destroy();
	return normalize(result.text);
}

async function extractDocxText(docxPath) {
	const buf = await fs.readFile(docxPath);
	// docx is zip - use simple unzip via dynamic import or read as buffer
	const { default: AdmZip } = await import('adm-zip');
	const zip = new AdmZip(buf);
	const entry = zip.getEntry('word/document.xml');
	if (!entry) return '';
	const xml = entry.getData().toString('utf-8');
	return normalize(
		xml
			.replace(/<w:tab[^/]*\/>/g, '\t')
			.replace(/<\/w:p>/g, '\n')
			.replace(/<[^>]+>/g, '')
			.replace(/&amp;/g, '&')
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>')
	);
}

function normalize(text) {
	return text
		.toLowerCase()
		.replace(/[^\w\s]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function tokenSet(text) {
	return new Set(text.split(' ').filter((w) => w.length > 3));
}

function jaccard(a, b) {
	const setA = tokenSet(a);
	const setB = tokenSet(b);
	let inter = 0;
	for (const t of setA) if (setB.has(t)) inter++;
	const union = setA.size + setB.size - inter;
	return union === 0 ? 0 : inter / union;
}

function keyPhrases(text, original) {
	const checks = [
		'st brendan',
		'achievement standard',
		'content descriptions',
		'teaching and learning',
		'assessment',
		'moderation',
		'general capabilities'
	];
	return checks.map((p) => ({
		phrase: p,
		inPdf: original.includes(p),
		inDocx: text.includes(p)
	}));
}

function pdfPathFromTextFile(textFile) {
	const sep = textFile.indexOf('__');
	const folder = textFile.slice(0, sep);
	const file = textFile.slice(sep + 2).replace('.txt', '');
	return path.join(FACULTY_DOCS, folder, file);
}
async function comparePair(label, textFile, docxName) {
	const pdfPath = pdfPathFromTextFile(textFile);
	const docxPath = path.join(EXPORTS, docxName);
	const [pdfText, docxText] = await Promise.all([
		extractPdfText(pdfPath),
		extractDocxText(docxPath)
	]);
	const similarity = jaccard(pdfText, docxText);
	const phrases = keyPhrases(docxText, pdfText);
	const pdfWords = pdfText.split(' ').filter(Boolean).length;
	const docxWords = docxText.split(' ').filter(Boolean).length;
	return { label, similarity, pdfWords, docxWords, phrases };
}

async function main() {
	try {
		await import('adm-zip');
	} catch {
		console.log('Installing adm-zip for docx comparison...');
		const { execSync } = await import('node:child_process');
		execSync('npm install adm-zip', { cwd: ROOT, stdio: 'inherit' });
	}

	const results = [];

	for (const lp of LEVEL_PLANS) {
		results.push(
			await comparePair(`Level: ${lp.id}`, lp.textFile, `${lp.id}.docx`)
		);

		for (const unit of lp.units) {
			results.push(
				await comparePair(
					`Unit: ${unit.unitId}`,
					unit.textFile,
					`${lp.id}__${unit.unitId}.docx`
				)
			);
		}
	}

	let md = `# Export vs PDF Comparison\n\nGenerated: ${new Date().toISOString()}\n\n`;
	md += `Similarity uses Jaccard index on word tokens (4+ chars). Higher = more overlap with source PDF text.\n\n`;
	md += `| Document | PDF words | DOCX words | Similarity | Notes |\n`;
	md += `|----------|-----------|------------|------------|-------|\n`;

	for (const r of results) {
		const pct = (r.similarity * 100).toFixed(1);
		const missing = r.phrases.filter((p) => p.inPdf && !p.inDocx).map((p) => p.phrase);
		const note =
			missing.length > 0
				? `Missing sections: ${missing.join(', ')}`
				: r.docxWords < r.pdfWords * 0.5
					? 'DOCX much shorter than PDF (tables/formatting not fully exported)'
					: 'Key sections present';
		md += `| ${r.label} | ${r.pdfWords} | ${r.docxWords} | ${pct}% | ${note} |\n`;
	}

	md += `\n## Interpretation\n\n`;
	md += `- Word export is **linear text + tables**, not a pixel-perfect QCAA template replica.\n`;
	md += `- Lower similarity often means PDF layout/tables/checkbox matrices are condensed in DOCX.\n`;
	md += `- Compare content by opening pairs side-by-side in Word vs PDF viewer.\n`;

	await fs.writeFile(REPORT, md);
	console.log(`Report written: ${REPORT}`);
	for (const r of results) {
		console.log(`${r.label}: ${(r.similarity * 100).toFixed(1)}% (${r.docxWords}/${r.pdfWords} words)`);
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
