import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const NEGATIVE = join(ROOT, "tests/fixtures-negative");

/**
 * Each negative fixture is copied into a scratch clone of the repo's content
 * config and built. Every one of them must fail the build with a readable
 * error — if any builds successfully, the schema has a hole.
 */
function buildWithFixture(fixture: string): { ok: boolean; output: string } {
	const scratch = mkdtempSync(join(tmpdir(), "dd-schema-"));
	try {
		// minimal project: content config + the fixture post
		mkdirSync(join(scratch, "src/content/blog/x"), { recursive: true });
		mkdirSync(join(scratch, "src/content/series"), { recursive: true });
		cpSync(join(ROOT, "src/content.config.ts"), join(scratch, "src/content.config.ts"));
		cpSync(
			join(ROOT, "src/content/series/field-notes.yaml"),
			join(scratch, "src/content/series/field-notes.yaml"),
		);
		cpSync(join(NEGATIVE, fixture), join(scratch, "src/content/blog/x/index.mdx"));
		// cover fixture needs an image next to it
		writeFileSync(
			join(scratch, "src/content/blog/x/cover.png"),
			readFileSync(join(ROOT, "src/content/blog/_components-gallery/cover.png")),
		);
		writeFileSync(
			join(scratch, "package.json"),
			JSON.stringify({ type: "module" }),
		);
		// resolve astro from the real project's node_modules
		execFileSync("ln", ["-s", join(ROOT, "node_modules"), join(scratch, "node_modules")]);
		writeFileSync(
			join(scratch, "astro.config.mjs"),
			'import { defineConfig } from "astro/config";\nimport mdx from "@astrojs/mdx";\nexport default defineConfig({ integrations: [mdx()] });\n',
		);
		mkdirSync(join(scratch, "src/pages"), { recursive: true });
		// the page must actually load the collection, or validation never runs;
		// it also dereferences series refs, so ghost references fail the build
		writeFileSync(
			join(scratch, "src/pages/index.astro"),
			`---
import { getCollection, getEntry } from "astro:content";
const posts = await getCollection("blog");
for (const p of posts) {
	if (p.data.series) {
		const s = await getEntry(p.data.series);
		if (!s) throw new Error(\`post "\${p.id}" references missing series "\${p.data.series.id}"\`);
	}
}
---
<html><body>{posts.length}</body></html>
`,
		);

		const astroBin = join(ROOT, "node_modules/.bin/astro");
		try {
			const out = execFileSync(astroBin, ["build"], {
				cwd: scratch,
				encoding: "utf8",
				stdio: ["ignore", "pipe", "pipe"],
				env: { ...process.env, CI: "1" },
			});
			return { ok: true, output: out };
		} catch (err: any) {
			return { ok: false, output: `${err.stdout ?? ""}\n${err.stderr ?? ""}` };
		}
	} finally {
		rmSync(scratch, { recursive: true, force: true });
	}
}

describe("content schema rejects hostile frontmatter", () => {
	it.each([
		["missing-pubdate.mdx", /pubDate|Required|invalid/i],
		["bad-pubdate.mdx", /pubDate|date|invalid/i],
		["too-many-tags.mdx", /tags|array|max|9/i],
		["cover-no-alt.mdx", /coverAlt/i],
		["draft-string.mdx", /draft|boolean/i],
		["ghost-series.mdx", /series|does-not-exist|reference/i],
		["order-without-series.mdx", /seriesOrder|series/i],
	])("%s fails the build", (fixture, pattern) => {
		const { ok, output } = buildWithFixture(fixture);
		expect(ok, `fixture ${fixture} unexpectedly built successfully`).toBe(false);
		expect(output).toMatch(pattern);
	});
});
