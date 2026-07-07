import fs from 'node:fs';

const x = fs.readFileSync('data/exports/debug-2unit-document.xml', 'utf8');
const lines = x.split('\n');
const line = lines[69]; // line 70
const pos = 91110;
console.log('Around error position:');
console.log(line.slice(pos - 100, pos + 100));

// Find all w:t with unescaped < (not at start of closing tag)
const bad = [];
const re = /<w:t([^>]*)>([\s\S]*?)<\/w:t>/g;
let m;
while ((m = re.exec(x))) {
	const text = m[2];
	if (text.includes('<') && !text.includes('&lt;')) {
		bad.push({ text: text.slice(0, 80), index: m.index });
	}
}
console.log('\nUnescaped < in w:t:', bad.length);
bad.slice(0, 5).forEach((b) => console.log(b.index, JSON.stringify(b.text)));

// Also find bare < in document that's not a tag start
// Simpler: find position of invalid < by scanning
for (let i = 0; i < line.length; i++) {
	if (line[i] === '<' && line.slice(i, i + 2) !== '</' && !/^<[a-zA-Z:?]/.test(line.slice(i, i + 10))) {
		// might be in attribute value
	}
}

// PowerShell said position 91110 - char at that index
const ch = line.charAt(pos);
console.log('\nChar at pos:', JSON.stringify(ch), 'code', line.charCodeAt(pos));
console.log('Context:', JSON.stringify(line.slice(pos - 20, pos + 20)));
