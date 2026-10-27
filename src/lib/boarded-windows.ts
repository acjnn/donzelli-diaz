// Chart specs for the "Boarded Windows" post, built from the CSVs in
// src/dataset/boarded-windows. Every function takes raw CSV text, so the unit
// tests can feed the same files without going through Vite.

import {
	signed,
	ticks,
	type HBarChartSpec,
	type HeatmapSpec,
	type MapSpec,
	type SeriesChartSpec,
	type StackChartSpec,
	type Tone,
} from "./svg-chart";

export type Row = Record<string, string>;

export function parseCsv(text: string): Row[] {
	const lines: string[][] = [];
	let field = "";
	let row: string[] = [];
	let quoted = false;
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (quoted) {
			if (c === '"' && text[i + 1] === '"') {
				field += '"';
				i++;
			} else if (c === '"') quoted = false;
			else field += c;
		} else if (c === '"') quoted = true;
		else if (c === ",") {
			row.push(field);
			field = "";
		} else if (c === "\n" || c === "\r") {
			if (c === "\r" && text[i + 1] === "\n") i++;
			row.push(field);
			field = "";
			if (row.some((f) => f !== "")) lines.push(row);
			row = [];
		} else field += c;
	}
	if (field !== "" || row.length) {
		row.push(field);
		lines.push(row);
	}
	const [head, ...body] = lines;
	return body.map((cells) => Object.fromEntries(head.map((h, i) => [h, cells[i] ?? ""])));
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-09" to the middle of that month as a decimal year. */
export function monthX(m: string): number {
	return Number(m.slice(0, 4)) + (Number(m.slice(5, 7)) - 0.5) / 12;
}

export function monthName(m: string): string {
	return `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
}

function num(v: string | undefined): number | null {
	if (v === undefined || v === "") return null;
	const n = Number(v);
	return Number.isFinite(n) ? n : null;
}

function yearTicks(years: number[]): { v: number; label: string }[] {
	return years.map((y) => ({ v: y, label: String(y) }));
}

// ---------------------------------------------------------------- democracy

const DEMOCRACY_LINES: { country: string; tone: Tone; dashed?: boolean; strong?: boolean }[] = [
	{ country: "France", tone: "ink" },
	{ country: "Germany", tone: "ink", dashed: true },
	{ country: "Hungary", tone: "cold" },
	{ country: "Italy", tone: "accent", strong: true },
];

export function democracyChart(text: string): SeriesChartSpec {
	const rows = parseCsv(text);
	const by = new Map<string, Map<number, number>>();
	for (const r of rows) {
		if (!by.has(r.country)) by.set(r.country, new Map());
		by.get(r.country)!.set(Number(r.year), Number(r.index));
	}
	const years: number[] = [];
	for (let y = 1900; y <= 2025; y++) years.push(y);
	const series = DEMOCRACY_LINES.map((l) => {
		const s = by.get(l.country)!;
		const last = s.get(2025)!;
		return {
			key: l.country,
			label: l.country,
			tone: l.tone,
			dashed: l.dashed,
			strong: l.strong,
			points: years.map((y) => ({ x: y, y: s.get(y) ?? null })),
			endLabel: `${l.country} ${(last + 1e-9).toFixed(2)}`,
		};
	});
	return {
		label:
			"Line chart of V-Dem's electoral democracy index from 1900 to 2025 for Italy, France, Germany and Hungary. Italy falls from about 0.36 in 1921 to about 0.07 by 1926 and stays there until 1943, then rises above 0.8 by the 1990s. In 2025 Italy is at 0.75, France 0.87, Germany 0.83 and Hungary 0.42.",
		title: "Electoral democracy index, 0 to 1",
		series,
		xMin: 1900,
		xMax: 2025,
		xTicks: yearTicks([1900, 1920, 1940, 1960, 1980, 2000, 2020]),
		yMin: 0,
		yMax: 1,
		yTicks: ticks(0, 1, 0.2, (v) => (v === 0 ? "0" : v.toFixed(1))),
		spans: [{ x0: 1922.8, x1: 1943.6, label: "fascist regime" }],
		slices: years.map((y) => ({
			x0: y - 0.5,
			x1: y + 0.5,
			x: y,
			tip: [String(y), ...DEMOCRACY_LINES.map((l) => {
				const v = by.get(l.country)!.get(y);
				return `${l.country} ${v === undefined ? "n/a" : (v + 1e-9).toFixed(2)}`;
			})].join(" · "),
		})),
		height: 330,
	};
}

// ---------------------------------------------------------------- prices

const SEP_ROWS: { key: string; label: string }[] = [
	{ key: "TOTAL", label: "All items" },
	{ key: "ELC_GAS", label: "Electricity and gas" },
	{ key: "FUEL", label: "Fuel for cars" },
	{ key: "FOOD", label: "Food and drink" },
	{ key: "SERV", label: "Services" },
	{ key: "TOT_X_NRG_FOOD", label: "Core" },
];

function hicpIndex(rows: Row[]): Map<string, number> {
	const m = new Map<string, number>();
	for (const r of rows) m.set(`${r.geo}|${r.category}|${r.month}`, Number(r.rate));
	return m;
}

export function septemberChart(text: string, month = "2026-09"): HBarChartSpec {
	const idx = hicpIndex(parseCsv(text));
	const get = (geo: string, k: string) => idx.get(`${geo}|${k}|${month}`) ?? NaN;
	return {
		label: `Bar chart comparing Italy and the euro area in ${monthName(month)}, annual rates of change. Electricity and gas: Italy ${get("IT", "ELC_GAS")}%, euro area ${get("EA", "ELC_GAS")}%. Fuel: Italy ${get("IT", "FUEL")}%, euro area ${get("EA", "FUEL")}%. All items: Italy ${get("IT", "TOTAL")}%, euro area ${get("EA", "TOTAL")}%.`,
		title: `Prices, ${monthName(month)}, % change on a year earlier`,
		series: [
			{ key: "IT", label: "Italy", tone: "accent" },
			{ key: "EA", label: "Euro area", tone: "cold" },
		],
		rows: SEP_ROWS.map((r) => ({
			label: r.label,
			values: { IT: get("IT", r.key), EA: get("EA", r.key) },
			tip: `${r.label} · Italy ${signed(get("IT", r.key))}% · euro area ${signed(get("EA", r.key))}% · France ${signed(get("FR", r.key))}%`,
		})),
		xMin: 0,
		xMax: 36,
		xTicks: ticks(0, 35, 10, (v) => `${v}%`),
		decimals: 1,
		unit: "%",
		labelWidth: 170,
	};
}

const HEAT_ROWS: { key: string; label: string; indent?: boolean }[] = [
	{ key: "TOTAL", label: "All items" },
	{ key: "NRG", label: "Energy" },
	{ key: "ELC_GAS", label: "power and gas", indent: true },
	{ key: "FUEL", label: "fuel for cars", indent: true },
	{ key: "FOOD", label: "Food and drink" },
	{ key: "FOOD_NP", label: "fresh food", indent: true },
	{ key: "IGD_NNRG", label: "Other goods" },
	{ key: "SERV", label: "Services" },
	{ key: "TOT_X_NRG_FOOD", label: "Core" },
];

export function inflationHeatmap(text: string, from = "2019-01", to = "2026-09"): HeatmapSpec {
	const idx = hicpIndex(parseCsv(text));
	const cols: string[] = [];
	for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y++) {
		for (let m = 1; m <= 12; m++) {
			const k = `${y}-${String(m).padStart(2, "0")}`;
			if (k >= from && k <= to) cols.push(k);
		}
	}
	const values = HEAT_ROWS.map((r) => cols.map((c) => idx.get(`IT|${r.key}|${c}`) ?? null));
	const tips = HEAT_ROWS.map((r, ri) =>
		cols.map((c, ci) => {
			const v = values[ri][ci];
			return `${r.label[0].toUpperCase()}${r.label.slice(1)} · ${monthName(c)} · ${v === null ? "n/a" : `${signed(v)}%`}`;
		}),
	);
	return {
		label:
			"Heat map of Italian consumer price inflation by category, every month from January 2019 to September 2026. Energy turns deep red from late 2021 to early 2023, with power and gas above 100% in late 2022, then turns blue in 2023 and 2024 as energy prices fall, and red again in 2026. Core inflation and services stay pale throughout.",
		title: "Italy, prices by category, % change on a year earlier",
		rows: HEAT_ROWS,
		cols,
		colTicks: cols.map((c, i) => ({ c, i })).filter((x) => x.c.endsWith("-01")).map((x) => ({ index: x.i, label: x.c.slice(0, 4) })),
		values,
		tips,
		bins: [
			{ min: -Infinity, max: -10, tone: "cold", opacity: 0.85, label: "< −10" },
			{ min: -10, max: -2, tone: "cold", opacity: 0.5, label: "−10…−2" },
			{ min: -2, max: 0, tone: "cold", opacity: 0.2, label: "−2…0" },
			{ min: 0, max: 2, tone: "accent", opacity: 0.1, label: "0…2" },
			{ min: 2, max: 5, tone: "accent", opacity: 0.28, label: "2…5" },
			{ min: 5, max: 10, tone: "accent", opacity: 0.5, label: "5…10" },
			{ min: 10, max: 30, tone: "accent", opacity: 0.72, label: "10…30" },
			{ min: 30, max: Infinity, tone: "accent", opacity: 0.95, label: "30 +" },
		],
	};
}

// ---------------------------------------------------------------- energy

/** Share of hours in 2021 when a fossil plant set the wholesale price. Zakeri et al. (2023), Table 2. */
export const FOSSIL_HOURS_2021: { country: string; pct: number }[] = [
	{ country: "Britain", pct: 97 },
	{ country: "Greece", pct: 91 },
	{ country: "Italy", pct: 82 },
	{ country: "Germany", pct: 72 },
	{ country: "Spain", pct: 65 },
	{ country: "Portugal", pct: 40 },
	{ country: "France", pct: 7 },
];

export function fossilHoursChart(): HBarChartSpec {
	return {
		label: "Bar chart of the share of hours in 2021 when a fossil-fuel plant set the wholesale electricity price: Britain 97%, Greece 91%, Italy 82%, Germany 72%, Spain 65%, Portugal 40%, France 7%.",
		title: "Hours when a fossil plant set the power price, 2021",
		series: [{ key: "pct", label: "Share of hours", tone: "faint" }],
		rows: FOSSIL_HOURS_2021.map((r) => ({
			label: r.country,
			values: { pct: r.pct },
			tone: r.country === "Italy" ? "accent" : undefined,
			tip: `${r.country} · ${r.pct}% of hours`,
		})),
		xMin: 0,
		xMax: 100,
		xTicks: ticks(0, 100, 25, (v) => `${v}%`),
		decimals: 0,
		unit: "%",
		labelWidth: 110,
	};
}

export interface EnergyMonth {
	month: string;
	power: number | null;
	gas: number | null;
}

export function energyMonths(text: string): EnergyMonth[] {
	return parseCsv(text).map((r) => ({
		month: r.month,
		power: num(r.italy_power_eur_mwh),
		gas: num(r.europe_gas_eur_mwh),
	}));
}

export function energyChart(text: string): SeriesChartSpec {
	const rows = energyMonths(text);
	const last = rows[rows.length - 1];
	const peak = rows.reduce((a, b) => ((b.power ?? 0) > (a.power ?? 0) ? b : a));
	return {
		label: `Line chart of the monthly Italian wholesale electricity price and the European gas price, both in euros per megawatt-hour, from January 2015 to ${monthName(last.month)}. Both lines sit low until 2021, spike together in 2022 with power peaking at ${Math.round(peak.power!)} euros in ${monthName(peak.month)}, fall back by 2024, and climb again after the Strait of Hormuz closes in 2026. In ${monthName(last.month)} power is at ${Math.round(last.power!)} and gas at ${Math.round(last.gas!)}.`,
		title: "Euro per megawatt-hour, monthly average",
		series: [
			{
				key: "gas",
				label: "European gas",
				tone: "ink",
				points: rows.map((r) => ({ x: monthX(r.month), y: r.gas })),
				endLabel: `gas €${Math.round(last.gas!)}`,
			},
			{
				key: "power",
				label: "Italian power",
				tone: "accent",
				strong: true,
				points: rows.map((r) => ({ x: monthX(r.month), y: r.power })),
				endLabel: `power €${Math.round(last.power!)}`,
			},
		],
		xMin: 2015,
		xMax: 2026.75,
		xTicks: yearTicks([2015, 2017, 2019, 2021, 2023, 2025]),
		yMin: 0,
		yMax: 560,
		yTicks: ticks(0, 500, 100, (v) => `${v}`),
		markers: [
			{ x: 2022 + 55 / 365, label: "Russia invades Ukraine" },
			{ x: 2026 + 58 / 365, label: "Hormuz closes" },
		],
		notes: [{ x: monthX(peak.month), y: peak.power!, label: `€${Math.round(peak.power!)}, ${monthName(peak.month)}` }],
		slices: rows.map((r) => ({
			x0: monthX(r.month) - 1 / 24,
			x1: monthX(r.month) + 1 / 24,
			x: monthX(r.month),
			tip: `${monthName(r.month)} · power €${r.power?.toFixed(0) ?? "n/a"} · gas €${r.gas?.toFixed(0) ?? "n/a"} a MWh`,
		})),
		height: 320,
	};
}

export interface GasYear {
	year: number;
	total: number;
	russia: number;
	algeria: number;
	azerbaijan: number;
	qatar: number;
	usa: number;
}

export function gasYears(text: string): GasYear[] {
	return parseCsv(text).map((r) => ({
		year: Number(r.year),
		total: Number(r.total_mcm),
		russia: Number(r.russia),
		algeria: Number(r.algeria),
		azerbaijan: Number(r.azerbaijan),
		qatar: Number(r.qatar),
		usa: Number(r.united_states),
	}));
}

export function gasImportChart(text: string): StackChartSpec {
	const years = gasYears(text);
	const pct = (a: number, b: number) => Math.round((100 * a) / b);
	const bcm = (v: number) => (v / 1000).toFixed(1);
	return {
		label: `Stacked bar chart of Italy's gas imports by country of origin, ${years[0].year} to ${years[years.length - 1].year}, in billion cubic metres. Russia's part is about 45% in 2015, 40% in 2021, 19% in 2022, 5% in 2023 and 10% in 2024. Algeria grows to about 40%.`,
		title: "Italy's gas imports by origin, billion cubic metres",
		series: [
			{ key: "russia", label: "Russia", tone: "accent" },
			{ key: "algeria", label: "Algeria", tone: "cold" },
			{ key: "other", label: "Everyone else", tone: "faint" },
		],
		panels: [
			{
				title: "Italy",
				bars: years.map((y) => ({
					label: `'${String(y.year).slice(2)}`,
					values: { russia: y.russia / 1000, algeria: y.algeria / 1000, other: (y.total - y.russia - y.algeria) / 1000 },
					tip: `${y.year} · total ${bcm(y.total)} bcm · Russia ${bcm(y.russia)} (${pct(y.russia, y.total)}%) · Algeria ${bcm(y.algeria)} (${pct(y.algeria, y.total)}%) · Azerbaijan ${bcm(y.azerbaijan)} · Qatar ${bcm(y.qatar)} · United States ${bcm(y.usa)}`,
				})),
			},
		],
		yMin: 0,
		yMax: 80,
		yTicks: ticks(0, 80, 20, String),
		labelBars: years
			.filter((y) => [2015, 2021, 2022, 2023, 2024].includes(y.year))
			.map((y) => ({ panel: 0, bar: `'${String(y.year).slice(2)}`, text: `${pct(y.russia, y.total)}%` })),
		height: 300,
	};
}

// ---------------------------------------------------------------- who took the inflation

export interface DeflatorYear {
	year: number;
	deflator: number;
	pay: number;
	profits: number;
	taxes: number;
}

/** Contributions to GDP deflator growth, in percentage points, from the income side of GDP. */
export function deflatorYears(text: string, geo: string): DeflatorYear[] {
	const v = new Map<string, number>();
	for (const r of parseCsv(text)) if (r.geo === geo) v.set(`${r.item}|${r.unit}|${r.year}`, Number(r.value));
	const g = (item: string, unit: string, y: number) => v.get(`${item}|${unit}|${y}`)!;
	const out: DeflatorYear[] = [];
	for (let y = 2020; y <= 2025; y++) {
		if (!v.has(`B1GQ|CLV10_MEUR|${y}`)) continue;
		const real = g("B1GQ", "CLV10_MEUR", y);
		const real0 = g("B1GQ", "CLV10_MEUR", y - 1);
		const p0 = g("B1GQ", "CP_MEUR", y - 1) / real0;
		const c = (item: string) => ((g(item, "CP_MEUR", y) / real - g(item, "CP_MEUR", y - 1) / real0) / p0) * 100;
		out.push({
			year: y,
			deflator: (g("B1GQ", "CP_MEUR", y) / real / p0 - 1) * 100,
			pay: c("D1"),
			profits: c("B2A3G"),
			taxes: c("D2X3"),
		});
	}
	return out;
}

/** Cumulative shares over a window, as fractions of the deflator rise. */
export function deflatorShares(text: string, geo: string, from: number, to: number) {
	const v = new Map<string, number>();
	for (const r of parseCsv(text)) if (r.geo === geo) v.set(`${r.item}|${r.unit}|${r.year}`, Number(r.value));
	const g = (item: string, unit: string, y: number) => v.get(`${item}|${unit}|${y}`)!;
	const base = from - 1;
	const p0 = g("B1GQ", "CP_MEUR", base) / g("B1GQ", "CLV10_MEUR", base);
	const unit = (item: string, y: number) => g(item, "CP_MEUR", y) / g("B1GQ", "CLV10_MEUR", y);
	const total = (unit("B1GQ", to) / p0 - 1) * 100;
	const part = (item: string) => ((unit(item, to) - unit(item, base)) / p0) * 100;
	return { total, pay: part("D1") / total, profits: part("B2A3G") / total, taxes: part("D2X3") / total };
}

export function deflatorChart(text: string): StackChartSpec {
	const panels = [
		{ geo: "IT", title: "Italy" },
		{ geo: "EA20", title: "Euro area" },
	].map((p) => ({
		title: p.title,
		bars: deflatorYears(text, p.geo).map((d) => ({
			label: `'${String(d.year).slice(2)}`,
			values: { pay: d.pay, profits: d.profits, taxes: d.taxes },
			total: d.deflator,
			tip: `${p.title}, ${d.year} · domestic prices ${signed(d.deflator)}% · pay ${signed(d.pay)} pts · profits and self-employed income ${signed(d.profits)} pts · taxes ${signed(d.taxes)} pts`,
		})),
	}));
	return {
		label:
			"Two stacked bar charts, Italy and the euro area, 2020 to 2025. Each bar splits the yearly rise in the GDP deflator into pay, profits and self-employed income, and taxes less subsidies, per unit of output. In Italy, profits make up most of the rise in 2022 and 2023 and pay very little. In the euro area, pay makes up a larger part. In 2024 profits turn slightly negative in Italy while pay rises.",
		title: "Rise in domestic prices, and who it went to, % points",
		series: [
			{ key: "pay", label: "Pay", tone: "cold" },
			{ key: "profits", label: "Profits and self-employed", tone: "accent" },
			{ key: "taxes", label: "Taxes", tone: "faint" },
		],
		totalLabel: "Total",
		panels,
		yMin: -2,
		yMax: 8,
		yTicks: ticks(-2, 8, 2, (v) => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : "0")),
		labelBars: panels.map((p, i) => ({ panel: i, bar: "'23", text: signed(p.bars.find((b) => b.label === "'23")!.total!) })),
		height: 320,
	};
}

// ---------------------------------------------------------------- wages and productivity

export function wageChange(text: string, from = 1990): { code: string; country: string; change: number; last: number }[] {
	const by = new Map<string, { country: string; v: Map<number, number> }>();
	for (const r of parseCsv(text)) {
		if (!by.has(r.code)) by.set(r.code, { country: r.country, v: new Map() });
		by.get(r.code)!.v.set(Number(r.year), Number(r.usd_ppp_2025));
	}
	const out: { code: string; country: string; change: number; last: number }[] = [];
	for (const [code, { country, v }] of by) {
		if (!v.has(from)) continue;
		const last = Math.max(...v.keys());
		out.push({ code, country, change: (100 * v.get(last)!) / v.get(from)! - 100, last });
	}
	return out.sort((a, b) => b.change - a.change);
}

const WAGE_SHOW = new Set(["ITA", "JPN", "DEU", "FRA", "ESP", "OECD", "USA", "GBR"]);
const SHORT: Record<string, string> = {
	"OECD": "OECD average",
	"United Kingdom": "UK",
	"United States": "US",
	"Slovak Republic": "Slovakia",
	"European Union (22 countries) in OECD": "EU average",
	"OECD average country": "OECD average",
};

export function realWageChart(text: string): HBarChartSpec {
	const rows = wageChange(text);
	const italy = rows.find((r) => r.code === "ITA")!;
	return {
		label: `Bar chart of the change in average real wages from 1990 to ${italy.last} across ${rows.length - 1} OECD countries and the OECD average. Italy is last at ${italy.change.toFixed(1)}%, and Japan is the only other country below zero.`,
		title: `Change in the average real wage, 1990 to ${italy.last}`,
		series: [{ key: "v", label: "Change", tone: "faint" }],
		rows: rows.map((r) => ({
			label: SHORT[r.country] ?? r.country,
			values: { v: r.change },
			tone: r.code === "ITA" ? "accent" : r.code === "OECD" ? "cold" : undefined,
			reference: r.code === "OECD",
			showValue: WAGE_SHOW.has(r.code),
			tip: `${r.country} · ${signed(r.change)}% since 1990`,
		})),
		xMin: -10,
		xMax: Math.ceil(rows[0].change / 25) * 25 + 10,
		xTicks: ticks(0, Math.ceil(rows[0].change / 25) * 25, 25, (v) => `${v}%`),
		decimals: 1,
		unit: "%",
		labelWidth: 120,
	};
}

const PROD_LINES: { geo: string; label: string; tone: Tone; strong?: boolean; dashed?: boolean }[] = [
	{ geo: "DE", label: "Germany", tone: "faint" },
	{ geo: "FR", label: "France", tone: "faint", dashed: true },
	{ geo: "ES", label: "Spain", tone: "cold" },
	{ geo: "EA20", label: "Euro area", tone: "ink" },
	{ geo: "IT", label: "Italy", tone: "accent", strong: true },
];

export function productivityIndex(text: string, base = 1995): Map<string, Map<number, number>> {
	const raw = new Map<string, Map<number, number>>();
	for (const r of parseCsv(text)) {
		if (!raw.has(r.geo)) raw.set(r.geo, new Map());
		raw.get(r.geo)!.set(Number(r.year), Number(r.index_2015));
	}
	const out = new Map<string, Map<number, number>>();
	for (const [geo, s] of raw) {
		const b = s.get(base);
		if (!b) continue;
		out.set(geo, new Map([...s].filter(([y]) => y >= base).map(([y, v]) => [y, (100 * v) / b])));
	}
	return out;
}

export function productivityChart(text: string): SeriesChartSpec {
	const idx = productivityIndex(text);
	const years: number[] = [];
	for (let y = 1995; y <= 2025; y++) years.push(y);
	return {
		label: `Line chart of real output per hour worked, 1995 = 100, to 2025. Italy ends at ${idx.get("IT")!.get(2025)!.toFixed(0)}, the euro area at ${idx.get("EA20")!.get(2025)!.toFixed(0)}, Germany at ${idx.get("DE")!.get(2025)!.toFixed(0)}, France at ${idx.get("FR")!.get(2025)!.toFixed(0)} and Spain at ${idx.get("ES")!.get(2025)!.toFixed(0)}.`,
		title: "Real output per hour worked, 1995 = 100",
		series: PROD_LINES.map((l) => {
			const s = idx.get(l.geo)!;
			return {
				key: l.geo,
				label: l.label,
				tone: l.tone,
				strong: l.strong,
				dashed: l.dashed,
				points: years.map((y) => ({ x: y, y: s.get(y) ?? null })),
				endLabel: `${l.label} ${s.get(2025)!.toFixed(0)}`,
			};
		}),
		xMin: 1995,
		xMax: 2025,
		xTicks: yearTicks([1995, 2000, 2005, 2010, 2015, 2020, 2025]),
		yMin: 95,
		yMax: 140,
		yTicks: ticks(100, 140, 10, String),
		baseline: 100,
		slices: years.map((y) => ({
			x0: y - 0.5,
			x1: y + 0.5,
			x: y,
			tip: [String(y), ...PROD_LINES.map((l) => `${l.label} ${idx.get(l.geo)!.get(y)?.toFixed(1) ?? "n/a"}`)].join(" · "),
		})),
		height: 320,
	};
}

// ---------------------------------------------------------------- housing

/** Milan, 2015 to 2022. Bricocoli and Peverini (2024), sections 4.1 to 4.3. */
export const MILAN_GROWTH: { label: string; pct: number; housing: boolean }[] = [
	{ label: "House prices", pct: 50.1, housing: true },
	{ label: "Rents, new leases", pct: 33, housing: true },
	{ label: "Net income", pct: 18, housing: false },
	{ label: "Average wage", pct: 12.9, housing: false },
	{ label: "Office wage", pct: 9.9, housing: false },
	{ label: "Manual wage", pct: 8.9, housing: false },
];

export function milanGrowthChart(): HBarChartSpec {
	return {
		label: "Bar chart of growth in Milan from 2015 to 2022: house prices up 50.1%, rents on new leases up 33%, average net income up 18%, the average wage up 12.9%, office wages up 9.9% and manual wages up 8.9%.",
		title: "Milan, growth from 2015 to 2022",
		series: [{ key: "v", label: "Growth", tone: "cold" }],
		rows: MILAN_GROWTH.map((r) => ({
			label: r.label,
			values: { v: r.pct },
			tone: r.housing ? "accent" : "cold",
			tip: `${r.label} · +${r.pct}%`,
		})),
		xMin: 0,
		xMax: 56,
		xTicks: ticks(0, 50, 10, (v) => `${v}%`),
		decimals: 1,
		unit: "%",
		labelWidth: 140,
	};
}

const TENURE: { key: string; label: string }[] = [
	{ key: "RENT_MKT", label: "Renting, market rent" },
	{ key: "RENT_FR", label: "Renting, reduced rent" },
	{ key: "OWN_L", label: "Owner with a mortgage" },
	{ key: "OWN_NL", label: "Owner outright" },
	{ key: "TOTAL", label: "Everyone" },
];

export function housingBurdenChart(text: string, year = "2025"): HBarChartSpec {
	const v = new Map<string, number>();
	for (const r of parseCsv(text)) v.set(`${r.geo}|${r.tenure}|${r.year}`, Number(r.pct));
	const g = (geo: string, k: string) => v.get(`${geo}|${k}|${year}`)!;
	return {
		label: `Bar chart of the share of people spending more than 40% of disposable income on housing in ${year}, by tenure. Renters at market rent: Italy ${g("IT", "RENT_MKT")}%, EU ${g("EU27_2020", "RENT_MKT")}%. Owners with a mortgage: Italy ${g("IT", "OWN_L")}%, EU ${g("EU27_2020", "OWN_L")}%. Everyone: Italy ${g("IT", "TOTAL")}%, EU ${g("EU27_2020", "TOTAL")}%.`,
		title: `Share spending over 40% of income on housing, ${year}`,
		series: [
			{ key: "IT", label: "Italy", tone: "accent" },
			{ key: "EU", label: "EU", tone: "cold" },
		],
		rows: TENURE.map((t) => ({
			label: t.label,
			values: { IT: g("IT", t.key), EU: g("EU27_2020", t.key) },
			reference: t.key === "TOTAL",
			tip: `${t.label} · Italy ${g("IT", t.key)}% · EU ${g("EU27_2020", t.key)}%`,
		})),
		xMin: 0,
		xMax: 26,
		xTicks: ticks(0, 25, 5, (v) => `${v}%`),
		decimals: 1,
		unit: "%",
		labelWidth: 170,
	};
}

interface Geo {
	features: { properties: { name: string }; geometry: { type: string; coordinates: unknown } }[];
}

export interface MilanArea {
	name: string;
	listings: number;
	entire: number;
	active: number;
	multiHost: number;
	km2: number;
	density: number;
}

export function milanAreas(text: string): MilanArea[] {
	return parseCsv(text).map((r) => {
		const km2 = Number(r.area_km2);
		const active = Number(r.entire_homes_reviewed_12m);
		return {
			name: r.neighbourhood,
			listings: Number(r.listings),
			entire: Number(r.entire_homes),
			active,
			multiHost: Number(r.entire_homes_multi_host),
			km2,
			density: km2 > 0 ? active / km2 : 0,
		};
	});
}

function titleCase(s: string): string {
	return s
		.toLowerCase()
		.split(" ")
		.map((w) => (w.length > 2 || w === "xx" ? w[0].toUpperCase() + w.slice(1) : w))
		.join(" ")
		.replace("Xxii", "XXII");
}

const MAP_BINS: { max: number; tone: Tone; opacity: number; label: string }[] = [
	{ max: 10, tone: "accent", opacity: 0.08, label: "under 10" },
	{ max: 50, tone: "accent", opacity: 0.25, label: "10 to 50" },
	{ max: 150, tone: "accent", opacity: 0.45, label: "50 to 150" },
	{ max: 300, tone: "accent", opacity: 0.7, label: "150 to 300" },
	{ max: Infinity, tone: "accent", opacity: 0.95, label: "300 +" },
];

const MAP_LABELS = new Set(["DUOMO", "BUENOS AIRES - VENEZIA", "NAVIGLI", "CENTRALE", "QUARTO OGGIARO"]);

export function milanMap(geojson: string, csv: string): MapSpec {
	const geo = JSON.parse(geojson) as Geo;
	const stats = new Map(milanAreas(csv).map((a) => [a.name, a]));
	const rings = (g: { type: string; coordinates: unknown }) =>
		(g.type === "MultiPolygon" ? (g.coordinates as number[][][][]) : [g.coordinates as number[][][]]);
	let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
	const k = Math.cos((45.46 * Math.PI) / 180);
	for (const f of geo.features)
		for (const poly of rings(f.geometry))
			for (const ring of poly)
				for (const [lon, lat] of ring) {
					minX = Math.min(minX, lon * k);
					maxX = Math.max(maxX, lon * k);
					minY = Math.min(minY, lat);
					maxY = Math.max(maxY, lat);
				}
	const width = 640;
	const top = 62;
	const pad = 10;
	const scale = (width - pad * 2) / (maxX - minX);
	const height = Math.ceil(top + (maxY - minY) * scale + pad);
	const px = (lon: number) => pad + (lon * k - minX) * scale;
	const py = (lat: number) => top + (maxY - lat) * scale;
	const areas = geo.features.map((f) => {
		const s = stats.get(f.properties.name);
		const density = s?.density ?? 0;
		const bin = MAP_BINS.findIndex((b) => density < b.max);
		let d = "";
		let cx = 0, cy = 0, n = 0;
		for (const poly of rings(f.geometry)) {
			poly.forEach((ring, ri) => {
				d += ring.map(([lon, lat], i) => `${i ? "L" : "M"}${px(lon).toFixed(1)} ${py(lat).toFixed(1)}`).join("") + "Z";
				if (ri === 0) for (const [lon, lat] of ring) {
					cx += px(lon);
					cy += py(lat);
					n++;
				}
			});
		}
		const name = titleCase(f.properties.name);
		return {
			name,
			d,
			bin,
			tip: s
				? `${name} · ${s.active.toLocaleString("en-US")} whole homes booked in the last year, ${Math.round(density)} per km² · ${s.entire.toLocaleString("en-US")} whole homes listed`
				: name,
			labelAt: MAP_LABELS.has(f.properties.name) ? { x: cx / n, y: cy / n + 3, text: name.replace("Buenos Aires - Venezia", "Buenos Aires") } : undefined,
		};
	});
	return {
		label:
			"Map of Milan's 88 neighbourhoods shaded by whole-home Airbnb listings with a review in the last twelve months, per square kilometre. The centre is darkest: Duomo, Centrale, Ticinese, Buenos Aires-Venezia, Brera and Navigli all have more than 450 per square kilometre. The outer neighbourhoods are pale.",
		title: "Whole homes on Airbnb with a stay in the last year, per km²",
		width,
		height,
		areas,
		bins: MAP_BINS.map((b) => ({ tone: b.tone, opacity: b.opacity, label: b.label })),
	};
}

// ---------------------------------------------------------------- business power and tax

const BANDS: { key: string; label: string }[] = [
	{ key: "MWH_LT20", label: "Under 20 MWh" },
	{ key: "MWH20-499", label: "20 to 500" },
	{ key: "MWH500-1999", label: "500 to 2,000" },
	{ key: "MWH2000-19999", label: "2,000 to 20,000" },
	{ key: "MWH20000-69999", label: "20,000 to 70,000" },
	{ key: "MWH70000-149999", label: "70,000 to 150,000" },
	{ key: "MWH_GE150000", label: "150,000 and up" },
];

export function businessPower(text: string, half = "2026-S1") {
	const v = new Map<string, number>();
	for (const r of parseCsv(text)) if (r.half_year === half) v.set(`${r.geo}|${r.band}`, Number(r.eur_kwh));
	return (geo: string, band: string) => v.get(`${geo}|${band}`)!;
}

export function businessPowerChart(text: string, half = "2026-S1"): HBarChartSpec {
	const g = businessPower(text, half);
	const c = (geo: string, k: string) => Math.round(g(geo, k) * 1000) / 10;
	return {
		label: `Bar chart of electricity prices for businesses in the first half of 2026, excluding VAT and recoverable taxes, by yearly consumption. The smallest users pay ${c("IT", "MWH_LT20")} euro cents per kilowatt-hour in Italy against ${c("EU27_2020", "MWH_LT20")} in the EU. The largest pay ${c("IT", "MWH_GE150000")} in Italy against ${c("EU27_2020", "MWH_GE150000")}.`,
		title: "Business electricity, euro cents per kWh, by yearly use",
		series: [
			{ key: "IT", label: "Italy", tone: "accent" },
			{ key: "EU", label: "EU", tone: "cold" },
		],
		rows: BANDS.map((b) => ({
			label: b.label,
			values: { IT: c("IT", b.key), EU: c("EU27_2020", b.key) },
			tip: `${b.label} MWh a year · Italy ${c("IT", b.key)}c · EU ${c("EU27_2020", b.key)}c per kWh`,
		})),
		xMin: 0,
		xMax: 44,
		xTicks: ticks(0, 40, 10, String),
		decimals: 1,
		labelWidth: 150,
	};
}

export function taxWedgeRows(text: string) {
	return parseCsv(text).map((r) => ({ code: r.code, country: r.country, pct: Number(r.pct) }));
}

export function taxWedgeChart(text: string, top = 20): HBarChartSpec {
	const all = taxWedgeRows(text);
	const averages = new Set(["EU22OECD", "OECD_REP"]);
	const countries = all.filter((r) => !averages.has(r.code)).slice(0, top);
	const rows = [...countries, ...all.filter((r) => averages.has(r.code))].sort((a, b) => b.pct - a.pct);
	const show = new Set(["ITA", "DEU", "FRA", "ESP", "BEL", "EU22OECD", "OECD_REP"]);
	return {
		label: `Bar chart of the 2025 tax wedge for a single worker on the average wage, the ${top} highest OECD countries plus the EU and OECD averages. Italy is fifth at ${all.find((r) => r.code === "ITA")!.pct.toFixed(1)}%, against ${all.find((r) => r.code === "EU22OECD")!.pct.toFixed(1)}% for the EU average and ${all.find((r) => r.code === "OECD_REP")!.pct.toFixed(1)}% for the OECD average.`,
		title: "Tax wedge on a single worker on the average wage, 2025",
		series: [{ key: "v", label: "Tax wedge", tone: "faint" }],
		rows: rows.map((r) => ({
			label: SHORT[r.country] ?? r.country,
			values: { v: r.pct },
			tone: r.code === "ITA" ? "accent" : averages.has(r.code) ? "cold" : undefined,
			reference: averages.has(r.code),
			showValue: show.has(r.code),
			tip: `${r.country} · ${r.pct.toFixed(1)}% of labour costs`,
		})),
		xMin: 0,
		xMax: 58,
		xTicks: ticks(0, 50, 10, (v) => `${v}%`),
		decimals: 1,
		unit: "%",
		labelWidth: 120,
	};
}
