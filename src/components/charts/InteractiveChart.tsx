import { useEffect, useRef } from "preact/hooks";
import * as Plot from "@observablehq/plot";

interface Props {
	data: Record<string, unknown>[];
	x: string;
	y: string;
	kind?: "line" | "bar" | "scatter";
	title?: string;
	caption?: string;
}

const INK = "#0e0c0a";
const RUST = "#b84a1f";

export default function InteractiveChart({
	data,
	x,
	y,
	kind = "line",
	title,
	caption,
}: Props) {
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!ref.current) return;
		const mark =
			kind === "bar"
				? Plot.barY(data, { x, y, fill: RUST, tip: true })
				: kind === "scatter"
					? Plot.dot(data, { x, y, stroke: RUST, fill: "#f0ead6", tip: true })
					: Plot.lineY(data, { x, y, stroke: RUST, strokeWidth: 2, tip: true });
		const plot = Plot.plot({
			width: Math.min(ref.current.clientWidth, 720),
			height: 360,
			style: {
				background: "transparent",
				color: INK,
				fontFamily: "'JetBrains Mono', ui-monospace, monospace",
				fontSize: "10px",
			},
			grid: true,
			marks: [mark],
		});
		ref.current.replaceChildren(plot);
		return () => plot.remove();
	}, [data, x, y, kind]);

	return (
		<figure className="chart chart--interactive">
			{title && <span className="chart-title">{title}</span>}
			<div ref={ref} />
			{caption && <figcaption className="chart-caption">{caption}</figcaption>}
		</figure>
	);
}
