// Shared types and geometry for the data charts in the "Boarded Windows" post.
// The components in src/components/charts draw these specs; nothing here touches the DOM.

/** Colour roles. Each maps to a design token in prose.css, never to a hex. */
export type Tone = "accent" | "deep" | "cold" | "ink" | "faint";

export interface Tick {
	v: number;
	label: string;
}

export interface SeriesPoint {
	x: number;
	/** null breaks the line. */
	y: number | null;
}

export interface SeriesSpec {
	key: string;
	label: string;
	tone: Tone;
	dashed?: boolean;
	/** The series the chart is about. Drawn heavier. */
	strong?: boolean;
	points: SeriesPoint[];
	/** Text beside the last point, usually the label and the last value. */
	endLabel?: string;
}

export interface HoverSlice {
	x0: number;
	x1: number;
	/** Where the crosshair sits. */
	x: number;
	tip: string;
}

export interface SeriesChartSpec {
	label: string;
	title: string;
	series: SeriesSpec[];
	xMin: number;
	xMax: number;
	xTicks: Tick[];
	yMin: number;
	yMax: number;
	yTicks: Tick[];
	/** Shaded stretches of the x axis, such as a regime or a war. */
	spans?: { x0: number; x1: number; label: string }[];
	/** Thin vertical rules with a label. */
	markers?: { x: number; label: string }[];
	/** Hand-written notes pinned to a data point. */
	notes?: { x: number; y: number; label: string; anchor?: "start" | "end" }[];
	/** A reference line, such as an index base of 100. */
	baseline?: number;
	slices: HoverSlice[];
	height?: number;
}

export interface StackSeries {
	key: string;
	label: string;
	tone: Tone;
}

export interface StackBar {
	label: string;
	values: Record<string, number>;
	/** Optional net total, drawn as a tick across the bar. */
	total?: number;
	tip: string;
}

export interface StackPanel {
	title: string;
	bars: StackBar[];
}

export interface StackChartSpec {
	label: string;
	title: string;
	series: StackSeries[];
	panels: StackPanel[];
	yMin: number;
	yMax: number;
	yTicks: Tick[];
	totalLabel?: string;
	/** Bars whose value labels are written out, by panel index and bar label. */
	labelBars?: { panel: number; bar: string; text: string }[];
	height?: number;
}

export interface HBarRow {
	label: string;
	values: Record<string, number>;
	/** Overrides the series tone for a single-series ranking, to pick out one row. */
	tone?: Tone;
	/** Reference rows such as averages are set in italics. */
	reference?: boolean;
	/** Write the value at the end of the bar. */
	showValue?: boolean;
	tip: string;
}

export interface HBarChartSpec {
	label: string;
	title: string;
	series: StackSeries[];
	rows: HBarRow[];
	xMin: number;
	xMax: number;
	xTicks: Tick[];
	/** Decimals for value labels. */
	decimals: number;
	unit?: string;
	labelWidth?: number;
}

export interface HeatBin {
	min: number;
	max: number;
	tone: Tone;
	opacity: number;
	label: string;
}

export interface HeatmapSpec {
	label: string;
	title: string;
	rows: { key: string; label: string; indent?: boolean }[];
	cols: string[];
	colTicks: { index: number; label: string }[];
	/** values[row][col]; null where there is no observation. */
	values: (number | null)[][];
	tips: string[][];
	bins: HeatBin[];
}

export interface MapArea {
	name: string;
	d: string;
	bin: number;
	tip: string;
	labelAt?: { x: number; y: number; text: string };
}

export interface MapSpec {
	label: string;
	title: string;
	width: number;
	height: number;
	areas: MapArea[];
	bins: { tone: Tone; opacity: number; label: string }[];
}

export function linear(d0: number, d1: number, r0: number, r1: number): (v: number) => number {
	const span = d1 - d0 || 1;
	return (v) => r0 + ((v - d0) / span) * (r1 - r0);
}

/** Line path that breaks at null values. */
export function linePath(points: SeriesPoint[], x: (v: number) => number, y: (v: number) => number): string {
	let d = "";
	let pen = false;
	for (const p of points) {
		if (p.y === null || !Number.isFinite(p.y)) {
			pen = false;
			continue;
		}
		d += `${pen ? "L" : "M"}${x(p.x).toFixed(1)} ${y(p.y).toFixed(1)}`;
		pen = true;
	}
	return d;
}

export function lastPoint(points: SeriesPoint[]): SeriesPoint | undefined {
	for (let i = points.length - 1; i >= 0; i--) {
		const p = points[i];
		if (p.y !== null && Number.isFinite(p.y)) return p;
	}
	return undefined;
}

/** Push labels apart vertically so none sit closer than gap. Keeps the input order of ids. */
export function spreadLabels(ys: { id: string; y: number }[], gap: number, top: number, bottom: number): Map<string, number> {
	const sorted = [...ys].sort((a, b) => a.y - b.y);
	for (let i = 1; i < sorted.length; i++) {
		if (sorted[i].y - sorted[i - 1].y < gap) sorted[i].y = sorted[i - 1].y + gap;
	}
	const overflow = sorted.length ? sorted[sorted.length - 1].y - bottom : 0;
	if (overflow > 0) for (const s of sorted) s.y -= overflow;
	for (let i = 0; i < sorted.length; i++) if (sorted[i].y < top) sorted[i].y = top + i * gap;
	return new Map(sorted.map((s) => [s.id, s.y]));
}

export function ticks(min: number, max: number, step: number, format: (v: number) => string = String): Tick[] {
	const out: Tick[] = [];
	const start = Math.ceil(min / step) * step;
	for (let v = start; v <= max + 1e-9; v += step) {
		const r = Number(v.toPrecision(12));
		out.push({ v: r, label: format(r) });
	}
	return out;
}

export function signed(v: number, decimals = 1): string {
	const s = v.toFixed(decimals);
	return v > 0 ? `+${s}` : s.replace("-", "−");
}
