import { linearScale } from "../components/charts/chart-utils";
import { annualIncrease, parseMlo, trailingMean, type AnnualIncrease, type MloMonth } from "./gml";

export interface Co2Text {
	x: number;
	y: number;
	text: string;
	anchor: "start" | "middle" | "end";
}

export interface Co2Tick {
	x: number;
	y: number;
	text: string;
	grid: boolean;
}

export interface Co2Legend {
	x: number;
	y: number;
	text: string;
	tone: "month" | "trend" | "mean";
}

export interface Co2Bar {
	year: number;
	ppm: number;
	peak: boolean;
	title: string;
	readout: string;
	x: number;
	y: number;
	w: number;
	h: number;
	hit: { x: number; y: number; w: number; h: number };
}

export interface Co2Panel {
	clipId: string;
	title: Co2Text;
	legend: Co2Legend[];
	clip: { x: number; y: number; w: number; h: number };
	yTicks: Co2Tick[];
	xTicks: Co2Text[];
	spines: { x1: number; y1: number; x2: number; y2: number }[];
}

export interface Co2Figure {
	width: number;
	height: number;
	label: string;
	kicker: Co2Text;
	hero: Co2Text;
	heroRest: Co2Text;
	peakDot: { cx: number; cy: number };
	curve: Co2Panel & { month: string; trend: string };
	growth: Co2Panel & {
		rest: Co2Text;
		zero: { x1: number; x2: number; y: number };
		mean: string;
		bars: Co2Bar[];
		note: Co2Text;
	};
}

const W = 640;
const LEFT = 48;
const RIGHT = W - 16;
const X0 = 1958;
const X1 = 2027;
const PPM0 = 310;
const PPM1 = 448;
const GROW0 = 0;
const GROW1 = 4;
const CURVE_H = 268;
const GROW_H = 156;
const MONTHS = [
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
const X_TICKS = [1960, 1970, 1980, 1990, 2000, 2010, 2020];

function polyline(pts: { x: number; y: number }[]): string {
	return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
}

function ppm(v: number): string {
	return v.toFixed(2);
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

function xScale(frame: Frame): (year: number) => number {
	return (year) => linearScale(X0, X1, frame.left, frame.right).map(year);
}

function yTicks(
	frame: Frame,
	values: { v: number; grid: boolean }[],
	yOf: (v: number) => number,
): Co2Tick[] {
	return values.map(({ v, grid }) => ({
		x: frame.left - 8,
		y: yOf(v),
		text: String(v),
		grid,
	}));
}

function xTicks(frame: Frame, xOf: (year: number) => number): Co2Text[] {
	return X_TICKS.map((year) => ({
		x: xOf(year),
		y: frame.bottom + 16,
		text: String(year),
		anchor: "middle" as const,
	}));
}

function spines(frame: Frame): Co2Panel["spines"] {
	return [
		{ x1: frame.left, y1: frame.top, x2: frame.left, y2: frame.bottom },
		{ x1: frame.left, y1: frame.bottom, x2: frame.right, y2: frame.bottom },
	];
}

function monthName(month: number): string {
	return MONTHS[month - 1] ?? String(month);
}

export function co2Figure(csv: string): Co2Figure {
	const months = parseMlo(csv);
	const increases = annualIncrease(months);
	const mean = trailingMean(increases);
	const first = months[0];
	const last = months[months.length - 1];
	const peak = months.reduce((best, row) => (row.average > best.average ? row : best));
	const top = increases.reduce((best, row) => (row.ppm > best.ppm ? row : best));
	const meanEnd = mean[mean.length - 1];

	const curveFrame = frameOf(34, CURVE_H);
	const xOf = xScale(curveFrame);
	const yOf = (v: number) => linearScale(PPM0, PPM1, curveFrame.bottom, curveFrame.top).map(v);
	const point = (row: MloMonth, value: (row: MloMonth) => number) => ({
		x: xOf(row.decimal),
		y: yOf(value(row)),
	});

	const growthTop = curveFrame.bottom + 52;
	const growthFrame = frameOf(growthTop, GROW_H);
	const gX = xScale(growthFrame);
	const gY = (v: number) => linearScale(GROW0, GROW1, growthFrame.bottom, growthFrame.top).map(v);
	const yearW = gX(1961) - gX(1960);
	const barW = yearW * 0.62;
	const zeroY = gY(0);

	const bars: Co2Bar[] = increases.map((row) => {
		const cx = gX(row.year + 0.5);
		const y = gY(row.ppm);
		return {
			year: row.year,
			ppm: row.ppm,
			peak: row.year === top.year,
			title: `${row.year}, ${ppm(row.ppm)} parts per million`,
			readout: `${ppm(row.ppm)}  ·  ${row.year}`,
			x: cx - barW / 2,
			y,
			w: barW,
			h: zeroY - y,
			hit: { x: cx - yearW / 2, y: growthFrame.top, w: yearW, h: GROW_H },
		};
	});

	const noteY = Math.max(gY(top.ppm) - 8, growthFrame.top + 14);

	const label = [
		`Monthly mean carbon dioxide at Mauna Loa, ${monthName(first.month)} ${first.year} through ${monthName(last.month)} ${last.year}.`,
		`The highest month is ${monthName(peak.month)} ${peak.year} at ${ppm(peak.average)} parts per million.`,
		`The first month is ${ppm(first.average)}.`,
		`The largest annual increase is ${top.year} at ${ppm(top.ppm)} parts per million.`,
		`The ten-year mean ends at ${ppm(meanEnd.ppm)} in ${meanEnd.year}.`,
	].join(" ");

	return {
		width: W,
		height: growthFrame.bottom + 28,
		label,
		kicker: { x: curveFrame.left + 14, y: curveFrame.top + 108, text: "highest month", anchor: "start" },
		hero: { x: curveFrame.left + 14, y: curveFrame.top + 140, text: ppm(peak.average), anchor: "start" },
		heroRest: {
			x: curveFrame.left + 14,
			y: curveFrame.top + 158,
			text: `ppm  ·  ${monthName(peak.month)} ${peak.year}`,
			anchor: "start",
		},
		peakDot: { cx: xOf(peak.decimal), cy: yOf(peak.average) },
		curve: {
			clipId: "co2-curve",
			title: { x: curveFrame.left, y: 16, text: "Mauna Loa, ppm", anchor: "start" },
			legend: [
				{ x: 196, y: 16, text: "month", tone: "month" },
				{ x: 292, y: 16, text: "season removed", tone: "trend" },
			],
			clip: {
				x: curveFrame.left,
				y: curveFrame.top,
				w: curveFrame.right - curveFrame.left,
				h: CURVE_H,
			},
			yTicks: yTicks(
				curveFrame,
				[320, 360, 400, 440].map((v) => ({ v, grid: true })),
				yOf,
			),
			xTicks: xTicks(curveFrame, xOf),
			spines: spines(curveFrame),
			// A year is only a few pixels wide, so the seasonal cycle reads as a
			// ribbon around the deseasonalized line rather than as separate teeth.
			month: polyline(months.map((row) => point(row, (r) => r.average))),
			trend: polyline(months.map((row) => point(row, (r) => r.deseasonalized))),
		},
		growth: {
			clipId: "co2-growth",
			title: { x: growthFrame.left, y: growthTop - 16, text: "Annual increase, ppm", anchor: "start" },
			legend: [{ x: 230, y: growthTop - 16, text: "ten-year mean", tone: "mean" }],
			rest: {
				x: growthFrame.right,
				y: growthTop - 16,
				text: `${ppm(top.ppm)}  ·  ${top.year}`,
				anchor: "end",
			},
			clip: {
				x: growthFrame.left,
				y: growthFrame.top,
				w: growthFrame.right - growthFrame.left,
				h: GROW_H,
			},
			yTicks: yTicks(
				growthFrame,
				[0, 1, 2, 3, 4].map((v) => ({ v, grid: v > 0 && v < 4 })),
				gY,
			),
			xTicks: xTicks(growthFrame, gX),
			spines: spines(growthFrame),
			zero: { x1: growthFrame.left, x2: growthFrame.right, y: zeroY },
			mean: polyline(mean.map((row: AnnualIncrease) => ({ x: gX(row.year + 0.5), y: gY(row.ppm) }))),
			bars,
			note: { x: gX(top.year + 0.5), y: noteY, text: String(top.year), anchor: "middle" },
		},
	};
}
