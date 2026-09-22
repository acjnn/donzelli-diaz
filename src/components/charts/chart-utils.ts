// Shared helpers for the static SVG charts.

export interface ChartAnnotation {
	x?: number | string;
	y?: number;
	label: string;
}

export interface ChartProps {
	data: Record<string, unknown>[];
	x: string;
	y: string;
	title?: string;
	caption?: string;
	width?: number;
	height?: number;
	annotations?: ChartAnnotation[];
}

export const INK = "#0e0c0a";
export const RUST = "#b84a1f";
export const OCHRE = "#c48f1a";

export interface Scale {
	min: number;
	max: number;
	map: (v: number) => number;
}

export function linearScale(
	domainMin: number,
	domainMax: number,
	rangeMin: number,
	rangeMax: number,
): Scale {
	const span = domainMax - domainMin || 1;
	return {
		min: domainMin,
		max: domainMax,
		map: (v) => rangeMin + ((v - domainMin) / span) * (rangeMax - rangeMin),
	};
}

export function niceTicks(min: number, max: number, count = 5): number[] {
	if (!isFinite(min) || !isFinite(max)) return [0];
	if (min === max) {
		min -= 1;
		max += 1;
	}
	const span = max - min;
	const step = Math.pow(10, Math.floor(Math.log10(span / count)));
	const err = (span / count) / step;
	const factor = err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1;
	const niceStep = factor * step;
	const start = Math.ceil(min / niceStep) * niceStep;
	const ticks: number[] = [];
	for (let v = start; v <= max + 1e-9; v += niceStep) {
		ticks.push(Number(v.toPrecision(12)));
	}
	return ticks.length ? ticks : [min, max];
}

export function formatTick(v: number): string {
	if (Math.abs(v) >= 1000) return v.toLocaleString("en-US");
	return String(Number(v.toPrecision(6)));
}

/** Deterministic pseudo-random from an index, for hand-drawn jitter. */
export function jitter(i: number, amount = 1): number {
	const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
	return (x - Math.floor(x) - 0.5) * 2 * amount;
}

export function toNumbers(data: Record<string, unknown>[], key: string): number[] {
	return data
		.map((d) => {
			const raw = d[key];
			if (raw === null || raw === undefined || raw === "") return NaN;
			return Number(raw);
		})
		.filter((v) => Number.isFinite(v));
}

export const CHART_W = 640;
export const CHART_H = 360;
export const MARGIN = { top: 24, right: 20, bottom: 36, left: 52 };
