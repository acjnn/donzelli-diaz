// NASA GISS plain-text tables. The land-ocean file is one table of monthly
// anomalies from the 1951–1980 mean. The AIRS file concatenates three tables
// that share a different zero, 2007–2016: AIRS v6, AIRS v7, and the surface
// index rebases to that same period so the satellite can be compared with it.
// Missing months are stars. Seasonal columns are ignored.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

export interface GissRow {
	year: number;
	/** January through December. Null is a missing month, not a zero anomaly. */
	months: (number | null)[];
	/** January–December mean. Null when the year is incomplete. */
	annual: number | null;
}

export interface GissTable {
	title: string;
	rows: GissRow[];
}

function parseCell(raw: string | undefined): number | null {
	const s = (raw ?? "").trim();
	if (/^\*+$/.test(s)) return null;
	const n = Number(s);
	if (!Number.isFinite(n)) throw new Error(`Bad GISTEMP cell: ${raw}`);
	return n;
}

export function parseGissTables(text: string): GissTable[] {
	const lines = text.split(/\r?\n/);
	const tables: GissTable[] = [];
	let pendingTitle = "";

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();
		if (!line) continue;
		if (!line.startsWith("Year,")) {
			pendingTitle = line;
			continue;
		}

		const header = line.split(",").map((s) => s.trim());
		const monthIdx = MONTHS.map((name) => {
			const idx = header.indexOf(name);
			if (idx < 0) throw new Error(`GISTEMP column missing: ${name}`);
			return idx;
		});
		const annualIdx = header.indexOf("J-D");
		if (annualIdx < 0) throw new Error("GISTEMP column missing: J-D");

		const rows: GissRow[] = [];
		while (i + 1 < lines.length && /^\s*\d{4},/.test(lines[i + 1])) {
			i++;
			const cells = lines[i].split(",");
			rows.push({
				year: Number(cells[0]),
				months: monthIdx.map((idx) => parseCell(cells[idx])),
				annual: parseCell(cells[annualIdx]),
			});
		}
		tables.push({ title: pendingTitle, rows });
		pendingTitle = "";
	}

	if (!tables.length) throw new Error("No GISTEMP tables in file");
	return tables;
}

export function tableByTitle(tables: GissTable[], fragment: string): GissTable {
	const found = tables.find((table) => table.title.includes(fragment));
	if (!found) throw new Error(`GISTEMP table not found: ${fragment}`);
	return found;
}
