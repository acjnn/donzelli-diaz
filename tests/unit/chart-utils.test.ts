import { describe, expect, it } from "vitest";
import {
	formatTick,
	jitter,
	linearScale,
	niceTicks,
	roman,
	toNumbers,
} from "../../src/lib/chart-testable";

describe("chart scales", () => {
	it("linearScale maps domain to range", () => {
		const s = linearScale(0, 100, 0, 500);
		expect(s.map(0)).toBe(0);
		expect(s.map(50)).toBe(250);
		expect(s.map(100)).toBe(500);
	});

	it("linearScale survives a degenerate (flat) domain", () => {
		const s = linearScale(5, 5, 0, 100);
		expect(Number.isFinite(s.map(5))).toBe(true);
	});

	it("niceTicks handles equal min/max", () => {
		const ticks = niceTicks(3, 3);
		expect(ticks.length).toBeGreaterThan(0);
		expect(ticks.every(Number.isFinite)).toBe(true);
	});

	it("niceTicks handles negative spans", () => {
		const ticks = niceTicks(-50, 10);
		expect(ticks[0]).toBeLessThanOrEqual(-50 + 1);
		expect(ticks[ticks.length - 1]).toBeLessThanOrEqual(10 + 1e-9);
		expect(ticks.every(Number.isFinite)).toBe(true);
	});

	it("niceTicks never returns non-finite values for extreme input", () => {
		expect(niceTicks(0, 1e12).every(Number.isFinite)).toBe(true);
		expect(niceTicks(-1e-9, 1e-9).every(Number.isFinite)).toBe(true);
	});

	it("formatTick compacts large numbers", () => {
		expect(formatTick(12000)).toBe("12,000");
		expect(formatTick(3.5)).toBe("3.5");
	});

	it("jitter is deterministic and bounded", () => {
		expect(jitter(7)).toBe(jitter(7));
		for (let i = 0; i < 500; i++) {
			expect(Math.abs(jitter(i, 2))).toBeLessThanOrEqual(2);
		}
	});

	it("toNumbers drops NaN and non-numeric values", () => {
		const rows = [{ v: 1 }, { v: "nope" }, { v: NaN }, { v: 4.5 }, { v: null }];
		expect(toNumbers(rows, "v")).toEqual([1, 4.5]);
	});
});

describe("roman", () => {
	it("converts small numbers", () => {
		expect(roman(1)).toBe("I");
		expect(roman(4)).toBe("IV");
		expect(roman(9)).toBe("IX");
		expect(roman(14)).toBe("XIV");
		expect(roman(49)).toBe("XLIX");
		expect(roman(2026)).toBe("MMXXVI");
	});
});
