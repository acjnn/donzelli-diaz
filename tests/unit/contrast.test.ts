import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const tokens = readFileSync(resolve(__dirname, "../../src/styles/tokens.css"), "utf8");

function hex(varName: string): [number, number, number] {
	const m = tokens.match(new RegExp(`--${varName}:\\s*#([0-9a-f]{6})`, "i"));
	if (!m) throw new Error(`token --${varName} not found`);
	const n = parseInt(m[1], 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance([r, g, b]: [number, number, number]): number {
	const f = (c: number) => {
		const s = c / 255;
		return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
	};
	return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrast(a: [number, number, number], b: [number, number, number]): number {
	const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (l1 + 0.05) / (l2 + 0.05);
}

describe("palette contrast (WCAG AA)", () => {
	it("ink on paper passes AA for normal text (>= 4.5)", () => {
		expect(contrast(hex("ink"), hex("paper"))).toBeGreaterThanOrEqual(4.5);
	});
	it("paper on ink passes AA for normal text (>= 4.5)", () => {
		expect(contrast(hex("paper"), hex("ink"))).toBeGreaterThanOrEqual(4.5);
	});
	it("rust on paper passes AA for large text (>= 3.0)", () => {
		expect(contrast(hex("rust"), hex("paper"))).toBeGreaterThanOrEqual(3.0);
	});
	it("rust-deep on paper passes AA for normal text (>= 4.5)", () => {
		expect(contrast(hex("rust-deep"), hex("paper"))).toBeGreaterThanOrEqual(4.5);
	});
	it("ochre on ink passes AA for large text (>= 3.0)", () => {
		expect(contrast(hex("ochre"), hex("ink"))).toBeGreaterThanOrEqual(3.0);
	});
});
