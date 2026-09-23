// IMBIE-3 monthly mass balance, rebased so January 1979 is the start of the
// change the essay quotes. Greenland's published cumulative runs from 1971;
// subtracting December 1978 leaves the integral over 1979–2023. Antarctica's
// series already starts in January 1979, so its published cumulative is used
// as-is. Uncertainty of a change is taken from the published cumulative
// uncertainties. Where a baseline is removed, the nested part of that
// uncertainty is removed in quadrature, which is valid because the published
// cumulative uncertainty grows monotonically.

export const SLE_GT_PER_MM = 362.5;

export interface ImbieMonth {
	date: string;
	year: number;
	cum: number;
	cumUnc: number;
	smb: number;
	smbUnc: number;
	dyn: number;
	dynUnc: number;
	rate: number;
	rateUnc: number;
}

interface RawMonth {
	date: string;
	cum: number;
	cumUnc: number;
	smb: number;
	smbUnc: number;
	dyn: number;
	dynUnc: number;
	rate: number;
	rateUnc: number;
}

const COL = {
	date: "Date",
	rate: "Mass balance (Gt/yr)",
	rateUnc: "Mass balance uncertainty (Gt/yr)",
	cum: "Cumulative mass balance anomaly (Gt)",
	cumUnc: "Cumulative mass balance anomaly uncertainty (Gt)",
	smb: "Cumulative surface mass balance anomaly (Gt)",
	smbUnc: "Cumulative surface mass balance anomaly uncertainty (Gt)",
	dyn: "Cumulative dynamics mass balance anomaly (Gt)",
	dynUnc: "Cumulative dynamics mass balance anomaly uncertainty (Gt)",
} as const;

function changeUnc(u: number, u0: number): number {
	return Math.sqrt(Math.max(u * u - u0 * u0, 0));
}

function yearFraction(iso: string): number {
	const [y, m] = iso.split("-").map(Number);
	return y + (m - 0.5) / 12;
}

export function parseImbieCsv(text: string): RawMonth[] {
	const lines = text.split(/\r?\n/).filter((ln) => ln.trim() && !ln.startsWith("#"));
	const header = lines[0]?.split(",") ?? [];
	const index = new Map(header.map((name, i) => [name, i]));
	const at = (name: string) => {
		const i = index.get(name);
		if (i === undefined) throw new Error(`IMBIE column missing: ${name}`);
		return i;
	};
	const col = {
		date: at(COL.date),
		rate: at(COL.rate),
		rateUnc: at(COL.rateUnc),
		cum: at(COL.cum),
		cumUnc: at(COL.cumUnc),
		smb: at(COL.smb),
		smbUnc: at(COL.smbUnc),
		dyn: at(COL.dyn),
		dynUnc: at(COL.dynUnc),
	};

	const rows: RawMonth[] = [];
	for (const line of lines.slice(1)) {
		const cells = line.split(",");
		if (!/^\d{4}-\d{2}-\d{2}/.test(cells[col.date] ?? "")) continue;
		const num = (i: number) => {
			const v = Number(cells[i]);
			if (!Number.isFinite(v)) throw new Error(`Bad IMBIE value on ${cells[col.date]}`);
			return v;
		};
		rows.push({
			date: cells[col.date],
			rate: num(col.rate),
			rateUnc: num(col.rateUnc),
			cum: num(col.cum),
			cumUnc: num(col.cumUnc),
			smb: num(col.smb),
			smbUnc: num(col.smbUnc),
			dyn: num(col.dyn),
			dynUnc: num(col.dynUnc),
		});
	}
	if (!rows.length) throw new Error("IMBIE file has no monthly rows");
	return rows;
}

function rebase(rows: RawMonth[], baseline: RawMonth | null): ImbieMonth[] {
	const b = baseline ?? {
		cum: 0,
		cumUnc: 0,
		smb: 0,
		smbUnc: 0,
		dyn: 0,
		dynUnc: 0,
	};
	return rows
		.filter((r) => r.date >= "1979-01-01")
		.map((r) => ({
			date: r.date,
			year: yearFraction(r.date),
			cum: r.cum - b.cum,
			cumUnc: baseline ? changeUnc(r.cumUnc, b.cumUnc) : r.cumUnc,
			smb: r.smb - b.smb,
			smbUnc: baseline ? changeUnc(r.smbUnc, b.smbUnc) : r.smbUnc,
			dyn: r.dyn - b.dyn,
			dynUnc: baseline ? changeUnc(r.dynUnc, b.dynUnc) : r.dynUnc,
			rate: r.rate,
			rateUnc: r.rateUnc,
		}));
}

export interface IceLedger {
	greenland: ImbieMonth[];
	antarctica: ImbieMonth[];
	combined: ImbieMonth[];
}

export function iceLedger(greenlandCsv: string, antarcticaCsv: string): IceLedger {
	const greenlandRaw = parseImbieCsv(greenlandCsv);
	const antarcticaRaw = parseImbieCsv(antarcticaCsv);
	const baseline = greenlandRaw.find((r) => r.date === "1978-12-01");
	if (!baseline) throw new Error("Greenland series has no December 1978 row");

	const greenland = rebase(greenlandRaw, baseline);
	const antarctica = rebase(antarcticaRaw, null);
	if (greenland.length !== antarctica.length) {
		throw new Error("Greenland and Antarctica months do not cover the same span");
	}

	const combined = greenland.map((g, i) => {
		const a = antarctica[i];
		if (g.date !== a.date) throw new Error(`Date mismatch ${g.date} vs ${a.date}`);
		return {
			date: g.date,
			year: g.year,
			cum: g.cum + a.cum,
			cumUnc: Math.hypot(g.cumUnc, a.cumUnc),
			smb: g.smb + a.smb,
			smbUnc: Math.hypot(g.smbUnc, a.smbUnc),
			dyn: g.dyn + a.dyn,
			dynUnc: Math.hypot(g.dynUnc, a.dynUnc),
			rate: g.rate + a.rate,
			rateUnc: Math.hypot(g.rateUnc, a.rateUnc),
		};
	});

	return { greenland, antarctica, combined };
}

/** Mean of the monthly mass-balance rate over calendar years, inclusive. */
export function decadeRate(rows: ImbieMonth[], startYear: number, endYear: number): number {
	const sel = rows.filter((r) => {
		const y = Number(r.date.slice(0, 4));
		return y >= startYear && y <= endYear;
	});
	if (!sel.length) throw new Error(`No IMBIE rows in ${startYear}–${endYear}`);
	return sel.reduce((sum, r) => sum + r.rate, 0) / sel.length;
}

export function formatGt(v: number): string {
	const n = Math.round(v);
	const body = Math.abs(n).toLocaleString("en-US");
	if (n < 0) return `-${body} Gt`;
	if (n > 0) return `+${body} Gt`;
	return "0 Gt";
}
