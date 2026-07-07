export function fitTextareaHeight(node: HTMLTextAreaElement) {
	const fit = () => {
		node.style.height = 'auto';
		node.style.height = `${node.scrollHeight}px`;
	};

	node.addEventListener('input', fit);
	requestAnimationFrame(() => requestAnimationFrame(fit));

	return {
		update: fit,
		destroy() {
			node.removeEventListener('input', fit);
		}
	};
}

export function fitAllTextareas(root: ParentNode = document) {
	for (const node of root.querySelectorAll<HTMLTextAreaElement>('.fit-textarea')) {
		node.style.height = 'auto';
		node.style.height = `${node.scrollHeight}px`;
	}
}
