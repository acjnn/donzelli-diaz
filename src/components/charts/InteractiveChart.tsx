import { useEffect, useRef } from "preact/hooks";
import * as Plot from "@observablehq/plot";
import { ACCENT, INK, PAPER } from "../../lib/palette";

interface Props {
	data: Record<string, unknown>[];
	x: string;
	y: string;
	kind?: "line" | "bar" | "scatter";
	title?: string;
	caption?: string;
}

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
				? Plot.barY(data, { x, y, fill: ACCENT, tip: true })
				: kind === "scatter"
					? Plot.dot(data, { x, y, stroke: ACCENT, fill: PAPER, tip: true })
					: Plot.lineY(data, { x, y, stroke: ACCENT, strokeWidth: 2, tip: true });
		const plot = Plot.plot({
			width: Math.min(ref.current.clientWidth, 720),
			height: 360,
			style: {
				background: "transparent",
				color: INK,
				fontFamily: "'JetBrains Mono', ui-monospace, monospace",
				fontSize: "11px",
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
