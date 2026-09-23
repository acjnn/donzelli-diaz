// NOAA Global Monitoring Laboratory monthly mean CO₂ at Mauna Loa.
// March 1958 through April 1974 is the Scripps record; a negative standard
// deviation in those months means Scripps published no uncertainty, not that
// the month was filled. After the handoff, a negative standard deviation
// marks a month GML interpolated. The average and the deseasonalized value
// are still the numbers to plot.

export interface MloMonth {
	year: number;
	month: number;
	/** Middle of the month, as a decimal year. */
	decimal: number;
	/** Monthly mean, parts per million, seasonal cycle included. */
	average: number;
	/** Monthly mean with the seasonal cycle removed. */
	deseasonalized: number;
	days: number;
	sdev: number;
	unc: number;
}

export interface AnnualIncrease {
	year: number;
	/** Parts per million. */
	ppm: number;
}

function num(raw: string, what: string): number {
	const n = Number(raw);
	if (!Number.isFinite(n)) throw new Error(`Bad Mauna Loa ${what}: ${raw}`);
	return n;
}

export function parseMlo(text: string): MloMonth[] {
	const rows: MloMonth[] = [];
	for (const line of text.split(/\r?\n/)) {
		if (!/^\d{4},/.test(line)) continue;
		const [year, month, decimal, average, deseasonalized, days, sdev, unc] = line.split(",");
		rows.push({
			year: num(year, "year"),
			month: num(month, "month"),
			decimal: num(decimal, "decimal date"),
			average: num(average, "average"),
			deseasonalized: num(deseasonalized, "deseasonalized"),
			days: num(days, "days"),
			sdev: num(sdev, "sdev"),
			unc: num(unc, "uncertainty"),
		});
	}
	rows.sort((a, b) => a.decimal - b.decimal);
	return rows;
}

function at(rows: MloMonth[], year: number, month: number): MloMonth | undefined {
	return rows.find((row) => row.year === year && row.month === month);
}

/**
 * Annual increase for a year: the November–February mean, the four months
 * straddling the new year, minus the same four months a year earlier.
 * January and February of the following year have to be in the file, so the
 * last complete year stops short of the file's final spring.
 */
export function annualIncrease(rows: MloMonth[]): AnnualIncrease[] {
	const windowMean = (year: number): number | null => {
		const months = [at(rows, year, 11), at(rows, year, 12), at(rows, year + 1, 1), at(rows, year + 1, 2)];
		if (months.some((month) => month === undefined)) return null;
		return months.reduce((sum, month) => sum + month!.average, 0) / months.length;
	};

	const years = [...new Set(rows.map((row) => row.year))].sort((a, b) => a - b);
	const increases: AnnualIncrease[] = [];
	for (const year of years) {
		const current = windowMean(year);
		const previous = windowMean(year - 1);
		if (current === null || previous === null) continue;
		increases.push({ year, ppm: current - previous });
	}
	return increases;
}

/** Mean of the `span` annual increases ending in that year. Years must be contiguous. */
export function trailingMean(increases: AnnualIncrease[], span = 10): AnnualIncrease[] {
	const means: AnnualIncrease[] = [];
	for (let i = span - 1; i < increases.length; i++) {
		const slice = increases.slice(i - span + 1, i + 1);
		if (slice[span - 1].year - slice[0].year !== span - 1) continue;
		const ppm = slice.reduce((sum, row) => sum + row.ppm, 0) / span;
		means.push({ year: slice[span - 1].year, ppm });
	}
	return means;
}
