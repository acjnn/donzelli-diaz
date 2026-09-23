import Slugger from "github-slugger";

/**
 * html-validate rejects ids that start with a digit. Astro keeps a heading id
 * that is already set, so prefix those slugs before it assigns them.
 */
export function remarkSafeHeadingIds() {
	return (tree) => {
		const slugger = new Slugger();
		walk(tree, (node) => {
			if (node.type !== "heading") return;
			const data = node.data ?? {};
			const existing = data.hProperties?.id;
			if (typeof existing === "string") return;
			const id = slugger.slug(textOf(node));
			if (!/^[0-9]/.test(id)) return;
			node.data = {
				...data,
				hProperties: { ...data.hProperties, id: `s-${id}` },
			};
		});
	};
}

function walk(node, visit) {
	if (!node || typeof node !== "object") return;
	visit(node);
	if (!Array.isArray(node.children)) return;
	for (const child of node.children) walk(child, visit);
}

function textOf(node) {
	if (!node || typeof node !== "object") return "";
	if (node.type === "text" || node.type === "inlineCode") return node.value ?? "";
	if (!Array.isArray(node.children)) return "";
	return node.children.map(textOf).join("");
}
