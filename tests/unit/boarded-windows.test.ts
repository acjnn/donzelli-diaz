import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
	businessPower,
	deflatorShares,
	deflatorYears,
	energyMonths,
	gasYears,
	milanAreas,
	milanMap,
	parseCsv,
	productivityIndex,
	taxWedgeRows,
	wageChange,
} from "../../src/lib/boarded-windows";
import { linePath, spreadLabels } from "../../src/lib/svg-chart";

const dir = resolve(__dirname, "../../src/dataset/boarded-windows");
const read = (f: string) => readFileSync(resolve(dir, f), "utf8");

// Every number the post quotes from these files is pinned here, so a data refresh
// that changes one shows up as a failing test instead of a wrong sentence.

describe("csv parser", () => {
	it("handles quoted commas and blank lines", () => {
		const rows = parseCsv('a,b\n"x, y",2\n\n3,4\n');
		expect(rows).toEqual([
			{ a: "x, y", b: "2" },
			{ a: "3", b: "4" },
		]);
	});
});

describe("gas imports", () => {
	const years = gasYears(read("gas-imports-italy-annual.csv"));
	const y = (n: number) => years.find((r) => r.year === n)!;
	it("Russia was 29.2 bcm, 40% of imports, in 2021", () => {
		expect(y(2021).russia / 1000).toBeCloseTo(29.2, 1);
		expect(Math.round((100 * y(2021).russia) / y(2021).total)).toBe(40);
	});
	it("Russia was about 10% in 2024", () => {
		expect(Math.round((100 * y(2024).russia) / y(2024).total)).toBe(10);
	});
	it("Qatar fell from 11% in 2025 to 3% in 2026, the US rose from 16% to almost a quarter", () => {
		const rows = parseCsv(read("gas-imports-italy-recent.csv"));
		const share = (year: string, p: string) => Number(rows.find((r) => r.year === year && r.recorded_partner === p)!.share_pct);
		expect(Math.round(share("2025", "QA"))).toBe(11);
		expect(Math.round(share("2026", "QA"))).toBe(3);
		expect(Math.round(share("2025", "US"))).toBe(16);
		expect(share("2026", "US")).toBeGreaterThan(23);
		expect(share("2026", "US")).toBeLessThan(25);
	});
});

describe("energy prices", () => {
	const rows = energyMonths(read("energy-prices-monthly.csv"));
	const m = (k: string) => rows.find((r) => r.month === k)!;
	const avg = (a: string, b: string, key: "gas" | "power") => {
		const v = rows.filter((r) => r.month >= a && r.month <= b).map((r) => r[key]!);
		return v.reduce((s, x) => s + x, 0) / v.length;
	};
	it("gas averaged about €16 and power about €50 from 2015 to 2020", () => {
		expect(Math.round(avg("2015-01", "2020-12", "gas"))).toBe(16);
		expect(Math.round(avg("2015-01", "2020-12", "power"))).toBe(50);
	});
	it("power peaked at €544 in August 2022", () => {
		const peak = rows.reduce((a, b) => ((b.power ?? 0) > (a.power ?? 0) ? b : a));
		expect(peak.month).toBe("2022-08");
		expect(Math.round(peak.power!)).toBe(544);
	});
	it("gas was €34 in January 2026, and power above €200 with gas at €75 in September", () => {
		expect(Math.round(m("2026-01").gas!)).toBe(34);
		expect(m("2026-09").power!).toBeGreaterThan(200);
		expect(Math.round(m("2026-09").gas!)).toBe(75);
	});
});

describe("prices by category", () => {
	const rows = parseCsv(read("hicp-annual-rates.csv"));
	const r = (geo: string, k: string, month = "2026-09") => Number(rows.find((x) => x.geo === geo && x.category === k && x.month === month)!.rate);
	it("electricity and gas: Italy 19.1%, euro area 6.9%, France 7.3%", () => {
		expect(r("IT", "ELC_GAS")).toBe(19.1);
		expect(r("EA", "ELC_GAS")).toBe(6.9);
		expect(r("FR", "ELC_GAS")).toBe(7.3);
	});
	it("Italy all items 4.2%, France 3.4%, France fuel 37.0%", () => {
		expect(r("IT", "TOTAL")).toBe(4.2);
		expect(r("FR", "TOTAL")).toBe(3.4);
		expect(r("FR", "FUEL")).toBe(37);
	});
	it("power and gas peaked at +137% in October 2022 and bottomed near −43%", () => {
		const it = rows.filter((x) => x.geo === "IT" && x.category === "ELC_GAS").map((x) => Number(x.rate));
		expect(Math.round(Math.max(...it))).toBe(137);
		expect(Math.round(Math.min(...it))).toBe(-43);
		expect(r("IT", "ELC_GAS", "2022-10")).toBeCloseTo(136.8, 1);
	});
	it("core and services peaked near 5% in early 2023", () => {
		const peak = (k: string) => Math.max(...rows.filter((x) => x.geo === "IT" && x.category === k).map((x) => Number(x.rate)));
		expect(peak("TOT_X_NRG_FOOD")).toBeLessThan(6);
		expect(peak("SERV")).toBeLessThan(6);
	});
});

describe("who took the inflation", () => {
	const csv = read("gdp-income-components.csv");
	it("Italy 2021–23: profits about 70%, pay 18%; euro area 53% and 35%", () => {
		const it = deflatorShares(csv, "IT", 2021, 2023);
		const ea = deflatorShares(csv, "EA20", 2021, 2023);
		expect(Math.round(it.profits * 100)).toBe(70);
		expect(Math.round(it.pay * 100)).toBe(18);
		expect(Math.round(ea.profits * 100)).toBe(53);
		expect(Math.round(ea.pay * 100)).toBe(35);
	});
	it("contributions add up to the deflator, and Italy's profit line turns negative in 2024", () => {
		for (const d of deflatorYears(csv, "IT")) expect(d.pay + d.profits + d.taxes).toBeCloseTo(d.deflator, 3);
		const y24 = deflatorYears(csv, "IT").find((d) => d.year === 2024)!;
		expect(y24.profits).toBeLessThan(0);
		expect(y24.pay).toBeGreaterThan(1.5);
	});
});

describe("wages, productivity and tax", () => {
	it("24 countries reach back to 1990; only Italy and Japan are below it; OECD up more than a third", () => {
		const rows = wageChange(read("oecd-real-wages.csv"));
		expect(rows.filter((r) => r.code !== "OECD")).toHaveLength(24);
		expect(rows.filter((r) => r.change < 0).map((r) => r.code).sort()).toEqual(["ITA", "JPN"]);
		expect(rows.find((r) => r.code === "ITA")!.change).toBeCloseTo(-2.1, 1);
		expect(rows.find((r) => r.code === "JPN")!.change).toBeCloseTo(-1.2, 1);
		expect(rows.find((r) => r.code === "OECD")!.change).toBeGreaterThan(33.4);
	});
	it("output per hour since 1995: Italy about 8%, euro area 30%, Germany 35%", () => {
		const idx = productivityIndex(read("productivity-per-hour.csv"));
		expect(Math.round(idx.get("IT")!.get(2025)! - 100)).toBe(8);
		expect(Math.round(idx.get("EA20")!.get(2025)! - 100)).toBe(30);
		expect(Math.round(idx.get("DE")!.get(2025)! - 100)).toBe(35);
	});
	it("Italy's tax wedge is 45.8%, fifth in the OECD, against 41.7% EU and 35.1% OECD", () => {
		const rows = taxWedgeRows(read("tax-wedge-2025.csv"));
		const countries = rows.filter((r) => !["EU22OECD", "OECD_REP"].includes(r.code));
		expect(countries.findIndex((r) => r.code === "ITA") + 1).toBe(5);
		expect(rows.find((r) => r.code === "ITA")!.pct.toFixed(1)).toBe("45.8");
		expect(rows.find((r) => r.code === "EU22OECD")!.pct.toFixed(1)).toBe("41.7");
		expect(rows.find((r) => r.code === "OECD_REP")!.pct.toFixed(1)).toBe("35.1");
	});
	it("smallest business users pay 38.9c in Italy against 28.7c in the EU; largest pay 34% against 39%", () => {
		const g = businessPower(read("business-electricity.csv"));
		expect((g("IT", "MWH_LT20") * 100).toFixed(1)).toBe("38.9");
		expect((g("EU27_2020", "MWH_LT20") * 100).toFixed(1)).toBe("28.7");
		expect(Math.round((100 * g("IT", "MWH_GE150000")) / g("IT", "MWH_LT20"))).toBe(34);
		expect(Math.round((100 * g("EU27_2020", "MWH_GE150000")) / g("EU27_2020", "MWH_LT20"))).toBe(39);
	});
});

describe("housing and Milan", () => {
	it("renters at market rent: Italy 22.3%, EU 18.6%; mortgage owners 1.3% against 5.0%", () => {
		const rows = parseCsv(read("housing-overburden.csv"));
		const v = (geo: string, t: string) => rows.find((r) => r.geo === geo && r.tenure === t && r.year === "2025")!.pct;
		expect(v("IT", "RENT_MKT")).toBe("22.3");
		expect(v("EU27_2020", "RENT_MKT")).toBe("18.6");
		expect(v("IT", "OWN_L")).toBe("1.3");
		expect(v("EU27_2020", "OWN_L")).toBe("5.0");
	});
	it("Airbnb: 22,309 whole homes, 16,177 reviewed in a year, 63% with multi-home hosts, Duomo above 500 per km²", () => {
		const areas = milanAreas(read("milan-airbnb-by-neighbourhood.csv"));
		const sum = (k: "entire" | "active" | "multiHost") => areas.reduce((s, a) => s + a[k], 0);
		expect(sum("entire")).toBe(22309);
		expect(sum("active")).toBe(16177);
		expect(Math.round((100 * sum("multiHost")) / sum("entire"))).toBe(63);
		expect(areas.find((a) => a.name === "DUOMO")!.density).toBeGreaterThan(500);
		const over450 = areas.filter((a) => a.density > 450).map((a) => a.name).sort();
		expect(over450).toEqual(["BRERA", "BUENOS AIRES - VENEZIA", "CENTRALE", "DUOMO", "NAVIGLI", "TICINESE"]);
		const km2 = areas.reduce((s, a) => s + a.km2, 0);
		expect(km2).toBeGreaterThan(178);
		expect(km2).toBeLessThan(184);
	});
	it("the map draws every neighbourhood with a valid bin", () => {
		const map = milanMap(read("milan-neighbourhoods.geojson"), read("milan-airbnb-by-neighbourhood.csv"));
		expect(map.areas).toHaveLength(88);
		for (const a of map.areas) {
			expect(a.bin).toBeGreaterThanOrEqual(0);
			expect(a.d.startsWith("M")).toBe(true);
		}
	});
});

describe("chart geometry", () => {
	it("linePath breaks at missing values", () => {
		const d = linePath(
			[
				{ x: 0, y: 1 },
				{ x: 1, y: null },
				{ x: 2, y: 3 },
			],
			(v) => v,
			(v) => v,
		);
		expect(d.match(/M/g)).toHaveLength(2);
	});
	it("spreadLabels keeps a minimum gap inside the frame", () => {
		const out = spreadLabels(
			[
				{ id: "a", y: 50 },
				{ id: "b", y: 52 },
				{ id: "c", y: 51 },
			],
			13,
			0,
			200,
		);
		const ys = [...out.values()].sort((p, q) => p - q);
		expect(ys[1] - ys[0]).toBeGreaterThanOrEqual(13);
		expect(ys[2] - ys[1]).toBeGreaterThanOrEqual(13);
	});
});
