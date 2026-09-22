// Link checker: every internal href/src in dist/ must resolve to a file.
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";

const DIST = resolve("dist");
const failures = [];
let checked = 0;

function* walk(dir) {
	for (const entry of readdirSync(dir)) {
		const p = join(dir, entry);
		if (statSync(p).isDirectory()) yield* walk(p);
		else if (entry.endsWith(".html")) yield p;
	}
}

function resolveRoute(url, fromFile) {
	if (!url || url.startsWith("data:") || url.startsWith("mailto:") || url.startsWith("tel:")) return true;
	if (/^https?:\/\//.test(url)) return true; // external links are not checked offline
	if (url.startsWith("#")) return true;
	const clean = url.split("#")[0].split("?")[0];
	if (!clean) return true;
	let target;
	if (clean.startsWith("/")) {
		target = join(DIST, clean);
	} else {
		target = resolve(dirname(fromFile), clean);
	}
	if (existsSync(target)) return true;
	if (existsSync(target + ".html")) return true;
	if (existsSync(join(target, "index.html"))) return true;
	return false;
}

for (const file of walk(DIST)) {
	const html = readFileSync(file, "utf8");
	const attrs = html.matchAll(/(?:href|src)="([^"]*)"/g);
	for (const m of attrs) {
		checked++;
		if (!resolveRoute(m[1], file)) {
			failures.push(`${file.replace(DIST, "")}: ${m[1]}`);
		}
	}
}

console.log(`checked ${checked} links across dist/`);
if (failures.length) {
	console.error("broken links:");
	for (const f of failures) console.error("  " + f);
	process.exit(1);
}
console.log("all internal links resolve");
