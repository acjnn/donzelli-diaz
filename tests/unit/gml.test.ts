import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { co2Figure } from "../../src/lib/co2-chart";
import { annualIncrease, parseMlo, trailingMean } from "../../src/lib/gml";

const ROOT = resolve(__dirname, "../..");
const csv = readFileSync(join(ROOT, "src/dataset/gml_co2_mm_mlo.csv"), "utf8");

describe("Mauna Loa monthly means", () => {
	const rows = parseMlo(csv);

	it("reads March 1958 through August 2026 without gaps", () => {
		expect(rows).toHaveLength(822);
		expect(rows[0]).toMatchObject({ year: 1958, month: 3, average: 315.71, deseasonalized: 314.44 });
		expect(rows[rows.length - 1]).toMatchObject({ year: 2026, month: 8, average: 427.55, deseasonalized: 429.51 });
		for (let i = 1; i < rows.length; i++) {
			const prev = rows[i - 1].year * 12 + rows[i - 1].month;
			const next = rows[i].year * 12 + rows[i].month;
			expect(next).toBe(prev + 1);
		}
	});

	it("measures the annual increase from the November–February window", () => {
		const increases = annualIncrease(rows);
		const at = (year: number) => increases.find((row) => row.year === year);
		expect(increases[0].year).toBe(1959);
		expect(increases[increases.length - 1].year).toBe(2025);
		expect(at(2022)?.ppm).toBeCloseTo(1.81, 2);
		expect(at(2023)?.ppm).toBeCloseTo(3.35, 2);
		expect(at(2024)?.ppm).toBeCloseTo(3.33, 2);
		expect(at(1964)?.ppm).toBeCloseTo(0.31, 2);
		const top = increases.reduce((best, row) => (row.ppm > best.ppm ? row : best));
		expect(top.year).toBe(2023);
	});

	it("trails a ten-year mean through 2025", () => {
		const mean = trailingMean(annualIncrease(rows));
		expect(mean[0]).toMatchObject({ year: 1968 });
		expect(mean[0].ppm).toBeCloseTo(0.81, 2);
		expect(mean[mean.length - 1].year).toBe(2025);
		expect(mean[mean.length - 1].ppm).toBeCloseTo(2.57, 2);
		expect(mean[mean.length - 1].ppm).toBeGreaterThan(mean[0].ppm);
	});
});

describe("carbon dioxide figure", () => {
	const figure = co2Figure(csv);

	it("names May 2026 as the highest month and 2023 as the largest increase", () => {
		expect(figure.hero.text).toBe("432.34");
		expect(figure.heroRest.text).toBe("ppm  ·  May 2026");
		expect(figure.kicker.text).toBe("highest month");
		expect(figure.label).toContain("315.71");
		expect(figure.label).toContain("3.35");
		expect(figure.label).toContain("2.57");
		expect(figure.growth.note.text).toBe("2023");
		expect(figure.growth.rest.text).toBe("3.35  ·  2023");
	});

	it("draws a ribbon, a trend, a mean, and one bar per complete year", () => {
		expect(figure.curve.month.match(/[ML]/g)?.length).toBe(822);
		expect(figure.curve.trend.match(/[ML]/g)?.length).toBe(822);
		for (const path of [figure.curve.month, figure.curve.trend, figure.growth.mean]) {
			expect(path.startsWith("M")).toBe(true);
			expect(path.includes("NaN")).toBe(false);
		}
		expect(figure.growth.bars).toHaveLength(67);
		expect(figure.growth.bars.filter((bar) => bar.peak).map((bar) => bar.year)).toEqual([2023]);
		for (const bar of figure.growth.bars) {
			expect(bar.h).toBeGreaterThan(0);
			expect(bar.x).toBeGreaterThanOrEqual(figure.growth.clip.x - 1);
			expect(bar.x + bar.w).toBeLessThanOrEqual(figure.growth.clip.x + figure.growth.clip.w + 1);
		}
	});

	it("keeps the corner number, the crest, and the 2023 note inside the figure", () => {
		expect(figure.hero.x).toBeGreaterThan(0);
		const fourHundred = figure.curve.yTicks.find((tick) => tick.text === "400");
		const threeSixty = figure.curve.yTicks.find((tick) => tick.text === "360");
		expect(fourHundred).toBeDefined();
		expect(threeSixty).toBeDefined();
		expect(figure.kicker.y).toBeGreaterThan(fourHundred!.y + 8);
		expect(figure.heroRest.y).toBeLessThan(threeSixty!.y - 8);
		expect(figure.peakDot.cx).toBeGreaterThan(figure.width * 0.9);
		expect(figure.peakDot.cy).toBeGreaterThan(figure.curve.clip.y);
		expect(figure.peakDot.cy).toBeLessThan(figure.curve.clip.y + figure.curve.clip.h);
		expect(figure.growth.note.x).toBeGreaterThan(figure.growth.clip.x);
		expect(figure.growth.note.x).toBeLessThan(figure.growth.clip.x + figure.growth.clip.w);
		expect(figure.growth.note.y).toBeGreaterThan(figure.growth.clip.y);
		expect(figure.growth.note.y).toBeLessThan(figure.growth.clip.y + figure.growth.clip.h);
		expect(figure.height).toBeGreaterThan(figure.growth.clip.y + figure.growth.clip.h);
	});
});
