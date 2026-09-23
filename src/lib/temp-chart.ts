import { linearScale, niceTicks } from "../components/charts/chart-utils";
import { ACCENT, ACCENT_DEEP, ACCENT_SOFT, COLD, COLD_SOFT, INK, PAPER } from "./palette";
import { parseGissTables, tableByTitle, type GissRow, type GissTable } from "./gistemp";

export interface TempText {
	x: number;
	y: number;
	text: string;
	anchor: "start" | "middle" | "end";
}

export interface TempRect {
	x: number;
	y: number;
	w: number;
	h: number;
}

export interface TempTick {
	x: number;
	y: number;
	text: string;
	grid: boolean;
}

export interface TempColumn {
	title: string;
	readout: string;
	hit: TempRect;
	cells: (TempRect & { fill: string | null })[];
	bar: (TempRect & { fill: string }) | null;
}

export interface TempLine {
	d: string;
	tone: "giss" | "airs7" | "airs6";
}

export interface TempDot {
	cx: number;
	cy: number;
	tone: TempLine["tone"];
}

export interface TempFigure {
	width: number;
	height: number;
	label: string;
	hero: TempText;
	rest: TempText;
	kicker: TempText;
	dek: TempText;
	ramp: { y: number; h: number; frame: TempRect; cells: { x: number; w: number; fill: string }[] };
	rampTicks: TempText[];
	months: TempText[];
	quilt: TempRect;
	yearTicks: TempText[];
	baseline: { x1: number; x2: number; y: number; label: TempText };
	columns: TempColumn[];
	annualTitle: TempText;
	annualLegend: TempText;
	annual: TempRect;
	annualTicks: TempTick[];
	annualZero: { x1: number; x2: number; y: number } | null;
	smooth: string;
	satelliteTitle: TempText;
	satelliteDek: TempText;
	satelliteLegend: { x: number; y: number; text: string; tone: TempLine["tone"] }[];
	satellite: TempRect;
	satelliteTicks: TempTick[];
	satelliteXTicks: TempText[];
	satelliteZero: { x1: number; x2: number; y: number } | null;
	lines: TempLine[];
	dots: TempDot[];
}

const W = 832;
const LEFT = 58;
const RIGHT = W - 16;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_FULL = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
];
const ROW_H = 14;
const RAMP_MIN = -0.8;
const RAMP_MAX = 1.5;

interface Lab {
	L: number;
	a: number;
	b: number;
}

function hexToRgb(hex: string): [number, number, number] {
	const n = parseInt(hex.slice(1), 16);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function srgbToLinear(c: number): number {
	const x = c / 255;
	return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(c: number): number {
	const x = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.max(c, 0) ** (1 / 2.4) - 0.055;
	return Math.round(Math.min(1, Math.max(0, x)) * 255);
}

function rgbToOklab(r: number, g: number, b: number): Lab {
	const R = srgbToLinear(r);
	const G = srgbToLinear(g);
	const B = srgbToLinear(b);
	const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
	const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
	const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
	return {
		L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
		a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
		b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
	};
}

function oklabToHex(lab: Lab): string {
	const l_ = lab.L + 0.3963377774 * lab.a + 0.2158037573 * lab.b;
	const m_ = lab.L - 0.1055613458 * lab.a - 0.0638541728 * lab.b;
	const s_ = lab.L - 0.0894841775 * lab.a - 1.291485548 * lab.b;
	const l = l_ ** 3;
	const m = m_ ** 3;
	const s = s_ ** 3;
	const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
	const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
	const b = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
	const hex = [linearToSrgb(r), linearToSrgb(g), linearToSrgb(b)].map((v) => v.toString(16).padStart(2, "0")).join("");
	return `#${hex}`;
}

const STOPS: { t: number; hex: string; lab: Lab }[] = (
	[
		[COLD, -0.85],
		[COLD_SOFT, -0.28],
		[PAPER, 0],
		[ACCENT_SOFT, 0.42],
		[ACCENT, 0.85],
		[ACCENT_DEEP, 1.2],
		[INK, 1.55],
	] as const
).map(([hex, t]) => {
	const [r, g, b] = hexToRgb(hex);
	return { t, hex: hex.toLowerCase(), lab: rgbToOklab(r, g, b) };
});

/** Paper is the 1951–1980 zero. Slate is colder. Rust darkens as the anomaly grows. */
export function anomalyColor(v: number): string {
	if (v === 0) return PAPER.toLowerCase();
	if (v <= STOPS[0].t) return STOPS[0].hex;
	const last = STOPS[STOPS.length - 1];
	if (v >= last.t) return last.hex;
	let i = 1;
	while (v > STOPS[i].t) i++;
	const a = STOPS[i - 1];
	const b = STOPS[i];
	const u = (v - a.t) / (b.t - a.t);
	return oklabToHex({
		L: a.lab.L + (b.lab.L - a.lab.L) * u,
		a: a.lab.a + (b.lab.a - a.lab.a) * u,
		b: a.lab.b + (b.lab.b - a.lab.b) * u,
	});
}

export function formatAnomaly(v: number, digits = 2): string {
	return `${formatSigned(v, digits)}°`;
}

function formatSigned(v: number, digits = 2): string {
	const sign = v > 0 ? "+" : v < 0 ? "−" : "";
	return `${sign}${Math.abs(v).toFixed(digits)}`;
}

function formatAxis(v: number): string {
	const body = Math.abs(v).toFixed(1);
	return v < -1e-8 ? `−${body}` : body;
}

function polyline(pts: { x: number; y: number }[]): string {
	return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
}

function annualPairs(rows: GissRow[]): { year: number; v: number }[] {
	return rows.flatMap((row) => (row.annual === null ? [] : [{ year: row.year, v: row.annual }]));
}

/** Centered five-year mean. A year joins only when the two years on either side exist. */
function centeredMean(pairs: { year: number; v: number }[]): { year: number; v: number }[] {
	const byYear = new Map(pairs.map((p) => [p.year, p.v]));
	const out: { year: number; v: number }[] = [];
	for (const { year } of pairs) {
		const window = [year - 2, year - 1, year, year + 1, year + 2].map((y) => byYear.get(y));
		if (window.some((v) => v === undefined)) continue;
		const vals = window as number[];
		out.push({ year, v: vals.reduce((sum, v) => sum + v, 0) / vals.length });
	}
	return out;
}

function warmestMonth(rows: GissRow[]): { year: number; month: string; v: number } {
	let best = { year: rows[0].year, month: MONTHS_FULL[0], v: -Infinity };
	for (const row of rows) {
		row.months.forEach((v, i) => {
			if (v !== null && v > best.v) best = { year: row.year, month: MONTHS_FULL[i], v };
		});
	}
	return best;
}

function lastObserved(rows: GissRow[]): { year: number; month: string } {
	for (let r = rows.length - 1; r >= 0; r--) {
		for (let m = 11; m >= 0; m--) {
			if (rows[r].months[m] !== null) return { year: rows[r].year, month: MONTHS_FULL[m] };
		}
	}
	return { year: rows[0].year, month: MONTHS_FULL[0] };
}

function yTicks(frameTop: number, frameBot: number, yOf: (v: number) => number, min: number, max: number): TempTick[] {
	return niceTicks(min, max, 5)
		.map((v) => ({
			x: LEFT - 8,
			y: yOf(v),
			text: formatAxis(v),
			grid: Math.abs(v) > 1e-6,
		}))
		.filter((tick) => tick.y >= frameTop - 1 && tick.y <= frameBot + 1);
}

export function temperatureFigure(lotiCsv: string, airsCsv: string): TempFigure {
	const lotiTables = parseGissTables(lotiCsv);
	if (lotiTables.length !== 1) throw new Error(`Expected one land-ocean table, found ${lotiTables.length}`);
	const airs = parseGissTables(airsCsv);
	return buildFigure(lotiTables[0], tableByTitle(airs, "AIRS v6"), tableByTitle(airs, "AIRS v7"), tableByTitle(airs, "ERSSTv5"));
}

function buildFigure(loti: GissTable, v6: GissTable, v7: GissTable, surface: GissTable): TempFigure {
	const rows = loti.rows;
	const year0 = rows[0].year;
	const year1 = rows[rows.length - 1].year;
	const yearCount = year1 - year0 + 1;
	const yearW = (RIGHT - LEFT) / yearCount;
	const xOf = (year: number) => LEFT + (year - year0) * yearW;
	const cxOf = (year: number) => xOf(year) + yearW / 2;

	const pairs = annualPairs(rows);
	const warmest = pairs.reduce((best, p) => (p.v > best.v ? p : best));
	const hottest = warmestMonth(rows);
	const latest = lastObserved(rows);
	const smoothPts = centeredMean(pairs);

	let cursor = 32;
	const headerY = cursor;
	cursor = 56;
	const subY = cursor;
	cursor = 62;
	const rampY = cursor;
	const rampH = 11;
	const rampX = LEFT;
	const rampW = 248;
	cursor = rampY + rampH + 16;
	const rampTickY = cursor;
	cursor += 16;
	const quiltTop = cursor;
	const quiltH = ROW_H * 12;
	const quiltBot = quiltTop + quiltH;
	cursor = quiltBot + 16;
	const yearTickY = cursor;
	cursor += 16;
	const baseY = cursor;
	cursor += 26;
	const annualTitleY = cursor;
	cursor += 14;
	const annualTop = cursor;
	const annualH = 136;
	const annualBot = annualTop + annualH;
	cursor = annualBot + 32;
	const satTitleY = cursor;
	cursor += 16;
	const satDekY = cursor;
	cursor += 14;
	const satTop = cursor;
	const satH = 124;
	const satBot = satTop + satH;
	cursor = satBot + 20;
	const height = cursor + 6;

	const annualVals = pairs.map((p) => p.v);
	const yMin = Math.min(...annualVals, 0);
	const yMax = Math.max(...annualVals, 0);
	const yPad = (yMax - yMin) * 0.08;
	const yScale = linearScale(yMin - yPad, yMax + yPad * 1.35, annualBot, annualTop);
	const yOf = (v: number) => yScale.map(v);
	const zeroY = yOf(0);

	const satPairs = [
		{ tone: "airs6" as const, pairs: annualPairs(v6.rows) },
		{ tone: "airs7" as const, pairs: annualPairs(v7.rows) },
		{ tone: "giss" as const, pairs: annualPairs(surface.rows) },
	];
	const satVals = satPairs.flatMap((series) => series.pairs.map((p) => p.v));
	const satMin = Math.min(...satVals, 0);
	const satMax = Math.max(...satVals, 0);
	const satPad = (satMax - satMin) * 0.14;
	const satScale = linearScale(satMin - satPad, satMax + satPad, satBot, satTop);
	const satY = (v: number) => satScale.map(v);
	const satX = linearScale(2001.4, 2025.6, LEFT, RIGHT);
	const satZero = satY(0);

	const gap = 0.45;
	const columns: TempColumn[] = rows.map((row) => {
		const cells = row.months.map((v, i) => ({
			x: xOf(row.year) + gap / 2,
			y: quiltTop + i * ROW_H,
			w: Math.max(yearW - gap, 0.8),
			h: ROW_H,
			fill: v === null ? null : anomalyColor(v),
		}));
		const present = row.months.flatMap((v, i) => (v === null ? [] : [{ name: MONTHS[i], v }]));
		const peak = present.reduce((best, m) => (m.v > best.v ? m : best), present[0]);
		const bar =
			row.annual === null
				? null
				: {
						x: cxOf(row.year) - yearW * 0.28,
						y: Math.min(zeroY, yOf(row.annual)),
						w: yearW * 0.56,
						h: Math.max(Math.abs(yOf(row.annual) - zeroY), 0.4),
						fill: anomalyColor(row.annual),
					};
		const annualText = row.annual === null ? "incomplete" : formatAnomaly(row.annual);
		return {
			title: `${row.year}, annual ${annualText}. Warmest month ${peak.name} ${formatAnomaly(peak.v)}.`,
			readout: row.annual === null ? `${row.year}  through ${peak.name}` : `${row.year}   ${formatAnomaly(row.annual)}`,
			hit: { x: xOf(row.year), y: quiltTop, w: yearW, h: annualBot - quiltTop },
			cells,
			bar,
		};
	});

	const rampCells = Array.from({ length: 56 }, (_, i) => {
		const w = rampW / 56;
		const v = RAMP_MIN + ((i + 0.5) / 56) * (RAMP_MAX - RAMP_MIN);
		return { x: rampX + i * w, w: w + 0.2, fill: anomalyColor(v) };
	});
	const rampTickVals = [-0.5, 0, 0.5, 1, 1.5];

	const legendSpecs: { tone: TempLine["tone"]; text: string }[] = [
		{ tone: "giss", text: "surface" },
		{ tone: "airs7", text: "AIRS v7" },
		{ tone: "airs6", text: "AIRS v6" },
	];
	let legendX = RIGHT - 268;
	const satelliteLegend = legendSpecs.map((item) => {
		const entry = { x: legendX, y: satTitleY, text: item.text, tone: item.tone };
		legendX += 18 + item.text.length * 6.7 + 16;
		return entry;
	});

	const lines: TempLine[] = satPairs.map((series) => ({
		tone: series.tone,
		d: polyline(series.pairs.map((p) => ({ x: satX.map(p.year), y: satY(p.v) }))),
	}));
	const dots: TempDot[] = satPairs.map((series) => {
		const last = series.pairs[series.pairs.length - 1];
		return { tone: series.tone, cx: satX.map(last.year), cy: satY(last.v) };
	});

	return {
		width: W,
		height,
		label: `NASA GISS land-ocean temperature, every month from January ${year0} through ${latest.month} ${latest.year}, in degrees Celsius relative to the 1951 to 1980 average. ${warmest.year} is the warmest year at ${formatAnomaly(warmest.v)}. The warmest month is ${hottest.month} ${hottest.year} at ${formatAnomaly(hottest.v)}. Below, the surface record is compared with AIRS v6 and AIRS v7 as anomalies from the 2007 to 2016 average.`,
		hero: { x: RIGHT, y: headerY, text: formatSigned(warmest.v), anchor: "end" },
		rest: { x: RIGHT, y: subY, text: `°C  ·  ${warmest.year}`, anchor: "end" },
		kicker: { x: LEFT, y: headerY, text: "Land–ocean index", anchor: "start" },
		dek: { x: LEFT, y: subY, text: "°C from the 1951–1980 mean", anchor: "start" },
		ramp: {
			y: rampY,
			h: rampH,
			frame: { x: rampX, y: rampY, w: rampW, h: rampH },
			cells: rampCells,
		},
		rampTicks: rampTickVals.map((v) => ({
			x: rampX + ((v - RAMP_MIN) / (RAMP_MAX - RAMP_MIN)) * rampW,
			y: rampTickY,
			text: v > 0 ? `+${v.toFixed(1)}` : formatAxis(v),
			anchor: "middle" as const,
		})),
		months: MONTHS.map((name, i) => ({
			x: LEFT - 8,
			y: quiltTop + i * ROW_H + ROW_H / 2,
			text: name,
			anchor: "end" as const,
		})),
		quilt: { x: LEFT, y: quiltTop, w: RIGHT - LEFT, h: quiltH },
		yearTicks: [1880, 1900, 1920, 1940, 1960, 1980, 2000, 2020].map((year) => ({
			x: cxOf(year),
			y: yearTickY,
			text: String(year),
			anchor: "middle" as const,
		})),
		baseline: {
			x1: cxOf(1951),
			x2: cxOf(1980),
			y: baseY,
			label: { x: (cxOf(1951) + cxOf(1980)) / 2, y: baseY + 16, text: "the zero", anchor: "middle" },
		},
		columns,
		annualTitle: { x: LEFT, y: annualTitleY, text: "Annual mean", anchor: "start" },
		annualLegend: { x: LEFT + 176, y: annualTitleY, text: "five-year mean", anchor: "start" },
		annual: { x: LEFT, y: annualTop, w: RIGHT - LEFT, h: annualH },
		annualTicks: yTicks(annualTop, annualBot, yOf, yMin - yPad, yMax + yPad),
		annualZero: { x1: LEFT, x2: RIGHT, y: zeroY },
		smooth: polyline(smoothPts.map((p) => ({ x: cxOf(p.year), y: yOf(p.v) }))),
		satelliteTitle: { x: LEFT, y: satTitleY, text: "AIRS and the surface", anchor: "start" },
		satelliteDek: { x: LEFT, y: satDekY, text: "°C from the 2007–2016 mean", anchor: "start" },
		satelliteLegend,
		satellite: { x: LEFT, y: satTop, w: RIGHT - LEFT, h: satH },
		satelliteTicks: yTicks(satTop, satBot, satY, satMin - satPad, satMax + satPad),
		satelliteXTicks: [2005, 2010, 2015, 2020, 2025].map((year) => ({
			x: satX.map(year),
			y: satBot + 16,
			text: String(year),
			anchor: "middle" as const,
		})),
		satelliteZero: satZero >= satTop && satZero <= satBot ? { x1: LEFT, x2: RIGHT, y: satZero } : null,
		lines,
		dots,
	};
}
