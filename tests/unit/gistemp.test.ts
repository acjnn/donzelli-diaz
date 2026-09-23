import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseGissTables, tableByTitle } from "../../src/lib/gistemp";
import { PAPER } from "../../src/lib/palette";
import { anomalyColor, temperatureFigure } from "../../src/lib/temp-chart";

const ROOT = resolve(__dirname, "../..");
const loti = readFileSync(join(ROOT, "src/dataset/GLB.Ts+dSST_landocean.csv"), "utf8");
const airs = readFileSync(join(ROOT, "src/dataset/GLB.Ts+dSST_airs.csv"), "utf8");

function bannedWarm(hex: string): boolean {
	const n = parseInt(hex.slice(1), 16);
	const r = ((n >> 16) & 255) / 255;
	const g = ((n >> 8) & 255) / 255;
	const b = (n & 255) / 255;
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const d = max - min;
	let h = 0;
	if (d) {
		if (max === r) h = ((g - b) / d) % 6;
		else if (max === g) h = (b - r) / d + 2;
		else h = (r - g) / d + 4;
		h = (((h * 60) % 360) + 360) % 360;
	}
	return d * 255 > 40 && h >= 8 && h <= 55;
}

describe("GISTEMP tables", () => {
	const land = parseGissTables(loti);
	const sats = parseGissTables(airs);

	it("reads the land-ocean index from 1880 through August 2026", () => {
		expect(land).toHaveLength(1);
		const rows = land[0].rows;
		expect(rows[0]).toMatchObject({ year: 1880, annual: -0.18 });
		expect(rows[0].months[0]).toBeCloseTo(-0.19);
		const y2024 = rows.find((row) => row.year === 2024);
		expect(y2024?.annual).toBeCloseTo(1.29);
		const y2026 = rows.find((row) => row.year === 2026);
		expect(y2026?.annual).toBeNull();
		expect(y2026?.months[7]).toBeCloseTo(1.4);
		expect(y2026?.months[8]).toBeNull();
	});

	it("keeps the satellite tables on the 2007–2016 baseline", () => {
		expect(tableByTitle(sats, "AIRS v6").rows.find((row) => row.year === 2024)?.annual).toBeCloseTo(0.235);
		expect(tableByTitle(sats, "AIRS v7").rows.find((row) => row.year === 2024)?.annual).toBeCloseTo(0.403);
		expect(tableByTitle(sats, "ERSSTv5").rows.find((row) => row.year === 2024)?.annual).toBeCloseTo(0.568);
		expect(tableByTitle(sats, "AIRS v6").rows.find((row) => row.year === 2025)?.annual ?? 0).toBeLessThan(0);
		expect(tableByTitle(sats, "ERSSTv5").rows.find((row) => row.year === 2025)?.annual ?? 0).toBeGreaterThan(0);
	});
});

describe("temperature figure", () => {
	const figure = temperatureFigure(loti, airs);

	it("names 2024 as the warmest year and keeps September 2023 in the summary", () => {
		expect(figure.hero.text).toBe("+1.29");
		expect(figure.rest.text).toBe("°C  ·  2024");
		expect(figure.label).toContain("September 2023");
		expect(figure.label).toContain("+1.48°");
	});

	it("draws a ribbon for every year and leaves 2026 without an annual bar", () => {
		expect(figure.columns).toHaveLength(2026 - 1880 + 1);
		const y2024 = figure.columns[2024 - 1880];
		const y2026 = figure.columns[2026 - 1880];
		expect(y2024.bar).not.toBeNull();
		expect(y2026.bar).toBeNull();
		expect(y2026.cells.filter((cell) => cell.fill !== null)).toHaveLength(8);
		expect(y2026.cells.filter((cell) => cell.fill === null)).toHaveLength(4);
		expect(figure.smooth.startsWith("M")).toBe(true);
		expect(figure.smooth.includes("NaN")).toBe(false);
		for (const line of figure.lines) {
			expect(line.d.startsWith("M")).toBe(true);
			expect(line.d.includes("NaN")).toBe(false);
		}
	});

	it("keeps the scale out of the orange band, with paper exactly at zero", () => {
		expect(anomalyColor(0).toLowerCase()).toBe(PAPER.toLowerCase());
		for (let v = -1; v <= 1.7; v += 0.01) {
			const hex = anomalyColor(Number(v.toFixed(2)));
			expect(bannedWarm(hex), `${v.toFixed(2)} ${hex}`).toBe(false);
		}
		for (const column of figure.columns) {
			for (const cell of column.cells) {
				if (cell.fill) expect(bannedWarm(cell.fill), cell.fill).toBe(false);
			}
			if (column.bar) expect(bannedWarm(column.bar.fill), column.bar.fill).toBe(false);
		}
	});

	it("keeps labels inside the plate", () => {
		const texts = [
			figure.hero,
			figure.rest,
			figure.kicker,
			figure.dek,
			figure.baseline.label,
			figure.annualTitle,
			figure.annualLegend,
			figure.satelliteTitle,
			...figure.yearTicks,
			...figure.months,
			...figure.rampTicks,
			...figure.satelliteXTicks,
		];
		for (const text of texts) {
			expect(text.x).toBeGreaterThanOrEqual(0);
			expect(text.x).toBeLessThanOrEqual(figure.width);
			expect(text.y).toBeGreaterThanOrEqual(0);
			expect(text.y).toBeLessThanOrEqual(figure.height);
		}
		expect(figure.baseline.x1).toBeLessThan(figure.baseline.x2);
	});
});
