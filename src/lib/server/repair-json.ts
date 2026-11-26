/** Best-effort repair of model JSON (unquoted keys, trailing commas, comments, single quotes). */
export function repairModelJson(raw: string): string {
	let text = raw.trim().replace(/^\uFEFF/, '');
	text = text.replace(/[\u201c\u201d]/g, '"').replace(/[\u2018\u2019]/g, "'");
	const fence = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
	if (fence) text = fence[1].trim();
	else text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');

	const objStart = text.indexOf('{');
	const arrStart = text.indexOf('[');
	let start = -1;
	if (objStart < 0) start = arrStart;
	else if (arrStart < 0) start = objStart;
	else start = Math.min(objStart, arrStart);
	if (start >= 0) {
		const balanced = extractBalancedJson(text.slice(start));
		if (balanced) text = balanced;
	}

	return sanitizeJsonish(text);
}

export function parseJsonLenient(raw: string): unknown {
	const trimmed = raw.trim();
	try {
		return JSON.parse(trimmed);
	} catch {
		// fall through to repair
	}
	const repaired = repairModelJson(trimmed);
	try {
		return JSON.parse(repaired);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		const after = message.match(/after JSON at position (\d+)/i);
		if (after) {
			try {
				return JSON.parse(repaired.slice(0, Number(after[1])));
			} catch {
				// fall through
			}
		}
		const posMatch = message.match(/position (\d+)/i);
		const pos = posMatch ? Number(posMatch[1]) : 0;
		const from = Math.max(0, pos - 40);
		const snippet = repaired.slice(from, pos + 40).replace(/\s+/g, ' ');
		throw new Error(`Could not parse model JSON (${message}). Near: ${snippet}`);
	}
}

function extractBalancedJson(text: string): string | undefined {
	const open = text[0];
	if (open !== '{' && open !== '[') return undefined;
	const close = open === '{' ? '}' : ']';
	let depth = 0;
	let inString = false;
	let escape = false;
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (inString) {
			if (escape) {
				escape = false;
				continue;
			}
			if (c === '\\') {
				escape = true;
				continue;
			}
			if (c === '"') inString = false;
			continue;
		}
		if (c === '"') {
			inString = true;
			continue;
		}
		if (c === open) depth += 1;
		else if (c === close) {
			depth -= 1;
			if (depth === 0) return text.slice(0, i + 1);
		}
	}
	return undefined;
}

function sanitizeJsonish(input: string): string {
	let out = '';
	let i = 0;
	let inString = false;
	let quote: '"' | "'" | null = null;
	let escape = false;

	const peekNonSpace = (from: number): number => {
		let j = from;
		while (j < input.length && /\s/.test(input[j])) j += 1;
		return j;
	};

	while (i < input.length) {
		const c = input[i];

		if (inString) {
			if (escape) {
				out += c;
				escape = false;
				i += 1;
				continue;
			}
			if (c === '\\') {
				out += c;
				escape = true;
				i += 1;
				continue;
			}
			if (c === quote) {
				if (
					quote === '"' &&
					input[i + 1] &&
					/[A-Za-z0-9]/.test(input[i + 1])
				) {
					out += '\\"';
					i += 1;
					continue;
				}
				out += '"';
				inString = false;
				quote = null;
				i += 1;
				continue;
			}
			if (quote === "'" && c === '"') {
				out += '\\"';
				i += 1;
				continue;
			}
			if (c === '\n' || c === '\r') {
				out += '\\n';
				i += 1;
				continue;
			}
			out += c;
			i += 1;
			continue;
		}

		if (c === '/' && input[i + 1] === '/') {
			while (i < input.length && input[i] !== '\n') i += 1;
			continue;
		}
		if (c === '/' && input[i + 1] === '*') {
			i += 2;
			while (i < input.length && !(input[i] === '*' && input[i + 1] === '/')) i += 1;
			i += 2;
			continue;
		}

		if (c === '"' || c === "'") {
			inString = true;
			quote = c;
			out += '"';
			i += 1;
			continue;
		}

		if (c === ',') {
			const next = peekNonSpace(i + 1);
			if (input[next] === '}' || input[next] === ']') {
				i = next;
				continue;
			}
		}

		if ((c === '{' || c === ',') && i + 1 < input.length) {
			out += c;
			i += 1;
			const keyStart = peekNonSpace(i);
			while (i < keyStart) {
				out += input[i];
				i += 1;
			}
			if (input.slice(i, i + 9) === 'undefined') {
				// value handled below; keep going for keys
			}
			if (/[A-Za-z_]/.test(input[i] ?? '')) {
				const identStart = i;
				i += 1;
				while (i < input.length && /[A-Za-z0-9_]/.test(input[i])) i += 1;
				const ident = input.slice(identStart, i);
				let after = peekNonSpace(i);
				if (input[after] === '"') after = peekNonSpace(after + 1);
				if (input[after] === ':') {
					out += `"${ident}"`;
					i = after;
					continue;
				}
				i = identStart;
			}
			continue;
		}

		if (c === ':') {
			out += ':';
			i += 1;
			while (i < input.length && /\s/.test(input[i])) {
				out += input[i];
				i += 1;
			}
			if (input.slice(i, i + 9) === 'undefined') {
				out += 'null';
				i += 9;
				continue;
			}
			if (
				input[i] === '"' ||
				input[i] === "'" ||
				input[i] === '{' ||
				input[i] === '[' ||
				input[i] === '-' ||
				/\d/.test(input[i] ?? '') ||
				/^(true|false|null)\b/.test(input.slice(i))
			) {
				continue;
			}
			if (/[A-Za-z_]/.test(input[i] ?? '')) {
				const start = i;
				while (i < input.length && !',[}\]\n'.includes(input[i] ?? '')) i += 1;
				const value = input.slice(start, i).trim().replace(/^["']+|["']+$/g, '');
				out += JSON.stringify(value);
				continue;
			}
			continue;
		}

		out += c;
		i += 1;
	}

	return out;
}
