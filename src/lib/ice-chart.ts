import { formatTick, linearScale, niceTicks } from "../components/charts/chart-utils";
import { SLE_GT_PER_MM, formatGt, type IceLedger, type ImbieMonth } from "./imbie";

export interface IceNote {
	x: number;
	y: number;
	text: string;
	anchor: "start" | "end" | "middle";
	tone: "note" | "tick";
}

export interface IcePanel {
	clipId: string;
	title: { x: number; y: number; text: string };
	hero?: { x: number; y: number; text: string };
	clip: { x: number; y: number; w: number; h: number };
	yTicks: { x: number; y: number; text: string; grid: boolean; rightX?: number; rightText?: string }[];
	xTicks: { x: number; y: number; text: string }[];
	zero: { x1: number; x2: number; y: number } | null;
	spines: { x1: number; y1: number; x2: number; y2: number }[];
	bands: { d: string; tone: "accent" | "ink" }[];
	lines: { d: string; tone: "total" | "greenland" | "antarctica" | "surface" | "discharge" }[];
	dots: { cx: number; cy: number; tone: "accent" | "ink" }[];
	notes: IceNote[];
	legend?: { x: number; y: number; text: string; tone: "greenland" | "antarctica" }[];
}

export interface IceFigure {
	width: number;
	height: number;
	label: string;
	panels: IcePanel[];
}

const W = 640;
const LEFT = 68;
const RIGHT = W - 46;
const X0 = 1979;
const X1 = 2024;
const YEARS = [1980, 1990, 2000, 2010, 2020];

function last<T>(rows: T[]): T {
	return rows[rows.length - 1];
}

function polyline(pts: { x: number; y: number }[]): string {
	return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
}

function bandPath(top: { x: number; y: number }[], bot: { x: number; y: number }[]): string {
	const fwd = top.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
	const back = [...bot].reverse().map((p) => `L${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
	return `${fwd} ${back} Z`;
}

function smoothBand(
	rows: ImbieMonth[],
	value: (r: ImbieMonth) => number,
	unc: (r: ImbieMonth) => number,
	xOf: (year: number) => number,
	yOf: (v: number) => number,
): string {
	const top = rows.map((r) => ({ x: xOf(r.year), y: yOf(value(r) + unc(r)) }));
	const bot = rows.map((r) => ({ x: xOf(r.year), y: yOf(value(r) - unc(r)) }));
	return bandPath(top, bot);
}

function linePath(
	rows: ImbieMonth[],
	value: (r: ImbieMonth) => number,
	xOf: (year: number) => number,
	yOf: (v: number) => number,
): string {
	return polyline(rows.map((r) => ({ x: xOf(r.year), y: yOf(value(r)) })));
}

function formatMm(gt: number): string {
	const mm = -gt / SLE_GT_PER_MM;
	if (Math.abs(mm) < 0.05) return "0";
	return mm.toFixed(1);
}

interface Frame {
	left: number;
	right: number;
	top: number;
	bottom: number;
}

function frameOf(top: number, height: number): Frame {
	return { left: LEFT, right: RIGHT, top, bottom: top + height };
}

function axes(
	frame: Frame,
	yMin: number,
	yMax: number,
	withSeaLevel: boolean,
): Pick<IcePanel, "yTicks" | "xTicks" | "zero" | "spines" | "clip"> & {
	xOf: (year: number) => number;
	yOf: (v: number) => number;
} {
	const xOf = (year: number) => linearScale(X0, X1, frame.left, frame.right).map(year);
	const yScale = linearScale(yMin, yMax, frame.bottom, frame.top);
	const yOf = (v: number) => yScale.map(v);
	const yTicks = niceTicks(yMin, yMax, 5)
		.map((v) => ({
			x: frame.left - 8,
			y: yOf(v),
			text: formatTick(v),
			grid: Math.abs(v) > 1e-6,
			...(withSeaLevel ? { rightX: frame.right + 8, rightText: formatMm(v) } : {}),
		}))
		.filter((t) => t.y >= frame.top - 1 && t.y <= frame.bottom + 1);

	const zeroY = yOf(0);
	const zero =
		zeroY >= frame.top && zeroY <= frame.bottom
			? { x1: frame.left, x2: frame.right, y: zeroY }
			: null;

	return {
		clip: { x: frame.left, y: frame.top, w: frame.right - frame.left, h: frame.bottom - frame.top },
		yTicks,
		xTicks: YEARS.map((year) => ({
			x: xOf(year),
			y: frame.bottom + 16,
			text: String(year),
		})),
		zero,
		spines: [
			{ x1: frame.left, y1: frame.top, x2: frame.left, y2: frame.bottom },
			{ x1: frame.left, y1: frame.bottom, x2: frame.right, y2: frame.bottom },
			...(withSeaLevel
				? [{ x1: frame.right, y1: frame.top, x2: frame.right, y2: frame.bottom }]
				: []),
		],
		xOf,
		yOf,
	};
}

function endNote(
	x: number,
	y: number,
	text: string,
	frame: Frame,
	tone: IceNote["tone"],
): IceNote {
	let ly = y - 12;
	if (ly < frame.top + 12) ly = y + 15;
	return { x: x - 6, y: ly, text, anchor: "end", tone };
}

export function massFigure(ledger: IceLedger): IceFigure {
	const { greenland, antarctica, combined } = ledger;
	const gEnd = last(greenland);
	const aEnd = last(antarctica);
	const cEnd = last(combined);
	const seaMm = -cEnd.cum / SLE_GT_PER_MM;

	const panels: IcePanel[] = [];
	let cursor = 14;

	// Cumulative loss. The rust line is the number in the lede.
	{
		const titleY = cursor + 4;
		const frame = frameOf(cursor + 28, 252);
		const samples = combined.flatMap((r) => [r.cum - r.cumUnc, r.cum]);
		const sheet = [...greenland, ...antarctica].map((r) => r.cum);
		const yMin = Math.min(...samples, ...sheet);
		const span = Math.max(0 - yMin, 1);
		const ax = axes(frame, yMin - span * 0.03, span * 0.08, true);
		const gLast = { x: ax.xOf(gEnd.year), y: ax.yOf(gEnd.cum) };
		const aLast = { x: ax.xOf(aEnd.year), y: ax.yOf(aEnd.cum) };
		const cLast = { x: ax.xOf(cEnd.year), y: ax.yOf(cEnd.cum) };
		panels.push({
			clipId: "ice-mass-cum",
			title: { x: frame.left, y: titleY, text: "Cumulative change since 1979, Gt" },
			hero: { x: frame.right, y: titleY + 1, text: formatGt(cEnd.cum) },
			clip: ax.clip,
			yTicks: ax.yTicks,
			xTicks: ax.xTicks,
			zero: ax.zero,
			spines: ax.spines,
			bands: [
				{
					d: smoothBand(combined, (r) => r.cum, (r) => r.cumUnc, ax.xOf, ax.yOf),
					tone: "ink",
				},
			],
			lines: [
				{ d: linePath(antarctica, (r) => r.cum, ax.xOf, ax.yOf), tone: "antarctica" },
				{ d: linePath(greenland, (r) => r.cum, ax.xOf, ax.yOf), tone: "greenland" },
				{ d: linePath(combined, (r) => r.cum, ax.xOf, ax.yOf), tone: "total" },
			],
			dots: [
				{ cx: aLast.x, cy: aLast.y, tone: "ink" },
				{ cx: gLast.x, cy: gLast.y, tone: "ink" },
				{ cx: cLast.x, cy: cLast.y, tone: "accent" },
			],
			notes: [
				endNote(aLast.x, aLast.y, "Antarctica", frame, "tick"),
				endNote(gLast.x, gLast.y, "Greenland", frame, "tick"),
				endNote(cLast.x, cLast.y, `${seaMm.toFixed(1)} mm`, frame, "note"),
				{ x: frame.right + 8, y: frame.top - 4, text: "mm", anchor: "start", tone: "tick" },
			],
		});
		cursor = frame.bottom + 36;
	}

	const partSamples = [...greenland, ...antarctica].flatMap((r) => [
		r.smb - r.smbUnc,
		r.smb + r.smbUnc,
		r.dyn - r.dynUnc,
		r.dyn + r.dynUnc,
	]);
	const partMin = Math.min(...partSamples, 0);
	const partMax = Math.max(...partSamples, 0);
	const partSpan = partMax - partMin || 1;
	const partDomain: [number, number] = [partMin - partSpan * 0.04, partMax + partSpan * 0.14];

	const partition = (
		id: string,
		title: string,
		hero: string,
		rows: ImbieMonth,
		series: ImbieMonth[],
		snowfall: boolean,
	) => {
		const titleY = cursor + 4;
		const frame = frameOf(cursor + 26, 198);
		const ax = axes(frame, partDomain[0], partDomain[1], false);
		const smbEnd = { x: ax.xOf(rows.year), y: ax.yOf(rows.smb) };
		const dynEnd = { x: ax.xOf(rows.year), y: ax.yOf(rows.dyn) };
		const notes: IceNote[] = [endNote(dynEnd.x, dynEnd.y, "discharge", frame, "tick")];
		if (snowfall) {
			const peak = series.reduce((best, row) => (row.smb > best.smb ? row : best));
			const early = series.find((r) => r.date === "1986-06-01") ?? series[0];
			notes.push({
				x: ax.xOf(early.year) + 8,
				y: ax.yOf(early.smb) - 14,
				text: "surface",
				anchor: "start",
				tone: "tick",
			});
			notes.push({
				x: Math.min(ax.xOf(peak.year) - 4, frame.right - 4),
				y: Math.max(ax.yOf(peak.smb + peak.smbUnc) - 3, frame.top + 13),
				text: "snowfall",
				anchor: "end",
				tone: "note",
			});
		} else {
			notes.push(endNote(smbEnd.x, smbEnd.y, "surface", frame, "tick"));
		}
		panels.push({
			clipId: id,
			title: { x: frame.left, y: titleY, text: title },
			hero: { x: frame.right, y: titleY + 1, text: hero },
			clip: ax.clip,
			yTicks: ax.yTicks,
			xTicks: ax.xTicks,
			zero: ax.zero,
			spines: ax.spines,
			bands: [
				{ d: smoothBand(series, (r) => r.dyn, (r) => r.dynUnc, ax.xOf, ax.yOf), tone: "ink" },
				{ d: smoothBand(series, (r) => r.smb, (r) => r.smbUnc, ax.xOf, ax.yOf), tone: "ink" },
			],
			lines: [
				{ d: linePath(series, (r) => r.dyn, ax.xOf, ax.yOf), tone: "discharge" },
				{ d: linePath(series, (r) => r.smb, ax.xOf, ax.yOf), tone: "surface" },
			],
			dots: [
				{ cx: dynEnd.x, cy: dynEnd.y, tone: "ink" },
				{ cx: smbEnd.x, cy: smbEnd.y, tone: "accent" },
			],
			notes,
		});
		cursor = frame.bottom + 34;
	};

	partition("ice-mass-gl", "Greenland", formatGt(gEnd.cum), gEnd, greenland, false);
	partition("ice-mass-aa", "Antarctica", formatGt(aEnd.cum), aEnd, antarctica, true);

	return {
		width: W,
		height: cursor + 4,
		label: `Cumulative ice-sheet mass from January 1979 to December 2023. Together the sheets lost ${formatGt(cEnd.cum)}, ${seaMm.toFixed(1)} millimetres of sea level. Greenland ${formatGt(gEnd.cum)}: surface ${formatGt(gEnd.smb)}, discharge ${formatGt(gEnd.dyn)}. Antarctica ${formatGt(aEnd.cum)}: surface ${formatGt(aEnd.smb)}, discharge ${formatGt(aEnd.dyn)}.`,
		panels,
	};
}

/** One point per calendar year: the mean rate and the mean published uncertainty. */
function yearly(rows: ImbieMonth[]): ImbieMonth[] {
	const groups = new Map<number, ImbieMonth[]>();
	for (const row of rows) {
		const year = Number(row.date.slice(0, 4));
		const list = groups.get(year) ?? [];
		list.push(row);
		groups.set(year, list);
	}
	return [...groups.entries()]
		.sort((a, b) => a[0] - b[0])
		.map(([year, list]) => {
			const mean = (pick: (row: ImbieMonth) => number) =>
				list.reduce((sum, row) => sum + pick(row), 0) / list.length;
			return {
				...list[0],
				date: `${year}-07-01`,
				year: year + 0.5,
				rate: mean((row) => row.rate),
				rateUnc: mean((row) => row.rateUnc),
			};
		});
}

export function rateFigure(ledger: IceLedger): IceFigure {
	const greenland = yearly(ledger.greenland);
	const antarctica = yearly(ledger.antarctica);
	const frame = frameOf(32, 268);
	const samples = [...greenland, ...antarctica].flatMap((r) => [r.rate - r.rateUnc, r.rate + r.rateUnc]);
	const yMin = Math.min(...samples, 0);
	const yMax = Math.max(...samples, 0);
	const pad = (yMax - yMin) * 0.06;
	const ax = axes(frame, yMin - pad, yMax + pad, false);
	const gEnd = last(greenland);
	const aEnd = last(antarctica);

	const panel: IcePanel = {
		clipId: "ice-rate",
		title: { x: frame.left, y: 16, text: "Yearly mass-balance rate, Gt/yr" },
		clip: ax.clip,
		yTicks: ax.yTicks,
		xTicks: ax.xTicks,
		zero: ax.zero,
		spines: ax.spines,
		bands: [
			{ d: smoothBand(antarctica, (r) => r.rate, (r) => r.rateUnc, ax.xOf, ax.yOf), tone: "ink" },
			{ d: smoothBand(greenland, (r) => r.rate, (r) => r.rateUnc, ax.xOf, ax.yOf), tone: "ink" },
		],
		lines: [
			{ d: linePath(greenland, (r) => r.rate, ax.xOf, ax.yOf), tone: "greenland" },
			{ d: linePath(antarctica, (r) => r.rate, ax.xOf, ax.yOf), tone: "antarctica" },
		],
		dots: [
			{ cx: ax.xOf(gEnd.year), cy: ax.yOf(gEnd.rate), tone: "ink" },
			{ cx: ax.xOf(aEnd.year), cy: ax.yOf(aEnd.rate), tone: "ink" },
		],
		notes: [],
		legend: [
			{ x: 330, y: 16, text: "Greenland", tone: "greenland" },
			{ x: 455, y: 16, text: "Antarctica", tone: "antarctica" },
		],
	};

	return {
		width: W,
		height: frame.bottom + 28,
		label: `Yearly mean ice-sheet mass-balance rate, gigatonnes a year, 1979 to 2023, with the mean one-sigma uncertainty. Greenland is the solid line, Antarctica the dashed line.`,
		panels: [panel],
	};
}
