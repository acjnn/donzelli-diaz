import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";
import {
	ACCENT,
	ACCENT_DEEP,
	ACCENT_SOFT,
	INK,
	PAPER,
	PAPER_DEEP,
} from "../../src/lib/palette";

const root = resolve(__dirname, "../..");
const tokens = readFileSync(resolve(root, "src/styles/tokens.css"), "utf8");

function tokenHex(name: string): string {
	const m = tokens.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
	if (!m) throw new Error(`token --${name} not found`);
	return m[1].toLowerCase();
}

function hueChroma(hex: string): { h: number; chroma: number } {
	const n = parseInt(hex.slice(1), 16);
	const r = (n >> 16) & 255;
	const g = (n >> 8) & 255;
	const b = n & 255;
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const d = max - min;
	let h = 0;
	if (d) {
		if (max === r) h = ((g - b) / d) % 6;
		else if (max === g) h = (b - r) / d + 2;
		else h = (r - g) / d + 4;
		h *= 60;
		if (h < 0) h += 360;
	}
	return { h, chroma: d };
}

function walk(dir: string): string[] {
	const out: string[] = [];
	for (const entry of readdirSync(dir)) {
		const p = join(dir, entry);
		if (statSync(p).isDirectory()) out.push(...walk(p));
		else out.push(p);
	}
	return out;
}

const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/g;
const HEX_ALLOW = new Set([
	"src/styles/tokens.css",
	"src/lib/palette.ts",
	"src/styles/print.css",
]);
const RETIRED = [
	"#b84a1f",
	"#8e3614",
	"#c48f1a",
	"#f0ead6",
	"#e6dec3",
	"#d8a24a",
	"#e0784a",
	"#da7756",
	"#c96442",
	"#cc785c",
	"#d97757",
	"rgba(184, 74, 31",
	"rgba(196, 143, 26",
	"rgba(240, 234, 214",
	"rgba(230, 222, 195",
];

describe("palette stays off the cream/terracotta cliché", () => {
	it("no color token sits in the warm orange band", () => {
		const found = [...tokens.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)];
		expect(found.length).toBeGreaterThan(0);
		for (const [, name, hex] of found) {
			const { h, chroma } = hueChroma(hex);
			const warm = h >= 8 && h <= 55 && chroma > 40;
			expect(warm, `--${name} ${hex} hue ${h.toFixed(0)} chroma ${chroma}`).toBe(false);
			if (name === "paper" || name === "paper-deep") {
				expect(chroma, `--${name} should be nearly neutral`).toBeLessThanOrEqual(8);
			}
		}
	});

	it("palette.ts matches tokens.css", () => {
		expect(INK.toLowerCase()).toBe(tokenHex("ink"));
		expect(PAPER.toLowerCase()).toBe(tokenHex("paper"));
		expect(PAPER_DEEP.toLowerCase()).toBe(tokenHex("paper-deep"));
		expect(ACCENT.toLowerCase()).toBe(tokenHex("accent"));
		expect(ACCENT_DEEP.toLowerCase()).toBe(tokenHex("accent-deep"));
		expect(ACCENT_SOFT.toLowerCase()).toBe(tokenHex("accent-soft"));
	});

	it("hex literals live only in the palette source, and the old palette is gone", () => {
		const files = walk(resolve(root, "src")).filter((f) => /\.(astro|css|ts|tsx)$/.test(f));
		const problems: string[] = [];
		for (const file of files) {
			const rel = relative(root, file).split(sep).join("/");
			const text = readFileSync(file, "utf8");
			const lower = text.toLowerCase();
			for (const banned of RETIRED) {
				if (lower.includes(banned)) problems.push(`${rel} still contains ${banned}`);
			}
			if (!HEX_ALLOW.has(rel)) {
				const hexes = text.match(HEX);
				if (hexes) problems.push(`${rel} has hex ${hexes.join(", ")}`);
			}
		}
		expect(problems).toEqual([]);
	});
});
