import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const kickoffPath = path.join(root, 'docs', 'new-agent.md');
const kickoff = await readFile(kickoffPath, 'utf8');
const capMatch = kickoff.match(/^Line cap:\s*(\d+)\s*$/m);

if (!capMatch) {
	console.error('docs/new-agent.md is missing a "Line cap: N" line.');
	process.exit(1);
}

const cap = Number(capMatch[1]);

async function markdownFiles(dir) {
	const entries = await readdir(dir, { withFileTypes: true });
	const files = [];
	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await markdownFiles(fullPath)));
		} else if (entry.name.endsWith('.md')) {
			files.push(fullPath);
		}
	}
	return files;
}

function lineCount(text) {
	if (text.length === 0) return 0;
	const parts = text.split(/\r?\n/);
	if (parts.at(-1) === '') parts.pop();
	return parts.length;
}

const docsDir = path.join(root, 'docs');
const files = await markdownFiles(docsDir);
const over = [];

for (const file of files) {
	const count = lineCount(await readFile(file, 'utf8'));
	if (count > cap) {
		over.push(`${path.relative(root, file)} (${count})`);
	}
}

if (over.length > 0) {
	console.error(`Doc cap is ${cap} lines. Over the cap:`);
	for (const line of over) console.error(`  ${line}`);
	process.exit(1);
}

console.log(`doc cap ok (${files.length} files, cap ${cap})`);
