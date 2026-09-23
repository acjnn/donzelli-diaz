import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { massFigure, rateFigure } from "../../src/lib/ice-chart";
import { SLE_GT_PER_MM, decadeRate, iceLedger } from "../../src/lib/imbie";

const ROOT = resolve(__dirname, "../..");
const greenland = readFileSync(join(ROOT, "src/dataset/imbie3_greenland_Gt_partitioned.csv"), "utf8");
const antarctica = readFileSync(join(ROOT, "src/dataset/imbie3_antarctica_Gt_partitioned.csv"), "utf8");

describe("IMBIE-3 ledger", () => {
	const ledger = iceLedger(greenland, antarctica);
	const end = ledger.combined[ledger.combined.length - 1];

	it("sums to the 11.3 trillion tonnes lost since 1979", () => {
		expect(end.cum).toBeCloseTo(-11316.1, 0);
		expect(-end.cum / SLE_GT_PER_MM).toBeCloseTo(31.2, 1);
	});

	it("attributes about 84% of the combined loss to ice discharge", () => {
		expect(end.dyn / end.cum).toBeCloseTo(0.842, 2);
	});

	it("keeps Antarctica's surface above zero while discharge runs past the net loss", () => {
		const sheet = ledger.antarctica[ledger.antarctica.length - 1];
		expect(sheet.smb).toBeGreaterThan(0);
		expect(sheet.dyn).toBeLessThan(sheet.cum);
	});

	it("matches the decadal rates quoted in the essay", () => {
		expect(Math.round(decadeRate(ledger.greenland, 1980, 1989))).toBe(-60);
		expect(Math.round(decadeRate(ledger.greenland, 2010, 2019))).toBe(-264);
		expect(Math.round(decadeRate(ledger.antarctica, 1980, 1989))).toBe(-48);
		expect(Math.round(decadeRate(ledger.antarctica, 2010, 2019))).toBe(-202);
	});

	it("draws finite paths inside the figure", () => {
		for (const figure of [massFigure(ledger), rateFigure(ledger)]) {
			expect(figure.panels.length).toBeGreaterThan(0);
			for (const panel of figure.panels) {
				expect(panel.lines.every((line) => line.d.startsWith("M") && !line.d.includes("NaN"))).toBe(true);
				expect(panel.bands.every((band) => band.d.includes("Z") && !band.d.includes("NaN"))).toBe(true);
				for (const note of panel.notes) {
					expect(note.x).toBeGreaterThanOrEqual(0);
					expect(note.x).toBeLessThanOrEqual(figure.width);
					expect(note.y).toBeGreaterThanOrEqual(0);
					expect(note.y).toBeLessThanOrEqual(figure.height);
				}
			}
		}
	});
});
