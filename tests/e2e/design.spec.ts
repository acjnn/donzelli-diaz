import { expect, test, type Page } from "@playwright/test";
import { HTML_ROUTES, VIEWPORTS } from "./routes";

/**
 * Adversarial design audit. These checks exist so a palette or type
 * regression (warm paper, terracotta accent, accent used as decoration,
 * italic or tracked-caps creeping back) fails in CI rather than in review.
 */

const WIDTHS = [375, 1440];
const COPY_ROUTES = ["/", "/about", "/blog", "/404.html"];
const BUZZ =
	/unlock|elevate|seamless|effortless|empower|supercharge|cutting-edge|next-level|game-chang/i;

type Audit = {
	banned: string[];
	contrast: string[];
	accent: string[];
	italic: string[];
	tracking: string[];
	tiny: string[];
};

function auditPage(): Audit {
	const cap = 8;

	function parseColor(input: string) {
		if (!input || input === "transparent" || input === "none") return null;
		const m = input.match(
			/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)/,
		);
		if (!m) return null;
		return {
			r: Number(m[1]),
			g: Number(m[2]),
			b: Number(m[3]),
			a: m[4] === undefined ? 1 : Number(m[4]),
		};
	}

	function analyze(c: { r: number; g: number; b: number }) {
		const r = c.r / 255;
		const g = c.g / 255;
		const b = c.b / 255;
		const max = Math.max(r, g, b);
		const min = Math.min(r, g, b);
		const d = max - min;
		let h = 0;
		if (d) {
			if (max === r) h = ((g - b) / d) % 6;
			else if (max === g) h = (b - r) / d + 2;
			else h = (r - g) / d + 4;
			h = (((h * 60) % 360) + 360) % 360;
		}
		return { h, chroma: d * 255, L: ((max + min) / 2) * 100 };
	}

	function lum(c: { r: number; g: number; b: number }) {
		const f = (v: number) => {
			const s = v / 255;
			return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
		};
		return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
	}

	function ratio(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }) {
		const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
		return (l1 + 0.05) / (l2 + 0.05);
	}

	function composite(
		fg: { r: number; g: number; b: number; a: number },
		bg: { r: number; g: number; b: number },
	) {
		return {
			r: fg.r * fg.a + bg.r * (1 - fg.a),
			g: fg.g * fg.a + bg.g * (1 - fg.a),
			b: fg.b * fg.a + bg.b * (1 - fg.a),
		};
	}

	function label(el: Element) {
		const cls = (el.getAttribute("class") ?? "").toString().split(/\s+/).filter(Boolean).slice(0, 2);
		return `${el.tagName.toLowerCase()}${cls.length ? "." + cls.join(".") : ""}`;
	}

	function backing(el: Element) {
		const layers: { r: number; g: number; b: number; a: number }[] = [];
		let node: Element | null = el;
		while (node) {
			const bg = parseColor(getComputedStyle(node).backgroundColor);
			if (bg && bg.a > 0.01) {
				layers.push(bg);
				if (bg.a >= 0.98) break;
			}
			node = node.parentElement;
		}
		let acc = { r: 242, g: 241, b: 238 };
		for (let i = layers.length - 1; i >= 0; i--) acc = composite(layers[i], acc);
		return acc;
	}

	const banned: string[] = [];
	const contrast: string[] = [];
	const accent: string[] = [];
	const tracking: string[] = [];
	const tiny: string[] = [];

	const probe = document.createElement("i");
	probe.style.color = "var(--accent)";
	document.body.appendChild(probe);
	const accentColor = getComputedStyle(probe).color;
	probe.remove();

	const punctuation = /^[\s\p{P}\p{S}]+$/u;

	for (const el of document.querySelectorAll("*")) {
		if (el.closest("script, style, noscript")) continue;
		const cs = getComputedStyle(el);
		const hidden = el.closest(".sr-only") !== null || cs.display === "none" || cs.visibility === "hidden";

		const colors: { kind: string; value: string }[] = [
			{ kind: "color", value: cs.color },
			{ kind: "background", value: cs.backgroundColor },
		];
		if (parseFloat(cs.borderTopWidth) > 0) colors.push({ kind: "border", value: cs.borderTopColor });
		if (parseFloat(cs.borderRightWidth) > 0) colors.push({ kind: "border", value: cs.borderRightColor });
		if (parseFloat(cs.borderBottomWidth) > 0) colors.push({ kind: "border", value: cs.borderBottomColor });
		if (parseFloat(cs.borderLeftWidth) > 0) colors.push({ kind: "border", value: cs.borderLeftColor });
		if (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0) {
			colors.push({ kind: "outline", value: cs.outlineColor });
		}
		if (cs.textDecorationLine !== "none") {
			colors.push({ kind: "decoration", value: cs.textDecorationColor });
		}
		if (el instanceof SVGElement) {
			colors.push({ kind: "fill", value: cs.fill });
			colors.push({ kind: "stroke", value: cs.stroke });
		}

		if (!hidden && banned.length < cap) {
			for (const { kind, value } of colors) {
				const c = parseColor(value);
				if (!c || c.a < 0.05) continue;
				const { h, chroma, L } = analyze(c);
				const warm = chroma > 40 && h >= 8 && h <= 55;
				const cream = kind === "background" && L > 80 && chroma > 10;
				if (warm || cream) {
					banned.push(`${label(el)} ${kind} h=${h.toFixed(0)} c=${chroma.toFixed(0)} L=${L.toFixed(0)}`);
					break;
				}
			}
		}

		if (hidden || el.closest("[aria-hidden='true']")) continue;
		if (el.getClientRects().length === 0) continue;

		let text = "";
		for (const node of el.childNodes) {
			if (node.nodeType === Node.TEXT_NODE) text += node.textContent ?? "";
		}
		const trimmed = text.replace(/\s+/g, " ").trim();
		if (!trimmed || punctuation.test(trimmed)) continue;

		const fs = parseFloat(cs.fontSize);
		// KaTeX script sizes are a math ladder, not UI chrome; forcing them to 11px blows up formulas.
		if (tiny.length < cap && fs < 11 && !el.closest(".katex")) {
			tiny.push(`${label(el)} ${fs.toFixed(1)}px "${trimmed.slice(0, 24)}"`);
		}

		if (contrast.length < cap) {
			const fg0 = parseColor(cs.color);
			if (fg0) {
				let fade = 1;
				let node: Element | null = el;
				while (node && node !== document.documentElement) {
					fade *= Number(getComputedStyle(node).opacity) || 1;
					node = node.parentElement;
				}
				const fg = composite({ ...fg0, a: fg0.a * fade }, backing(el));
				const bg = backing(el);
				const weight = cs.fontWeight === "bold" ? 700 : parseInt(cs.fontWeight, 10) || 400;
				const large = fs >= 24 || (fs >= 18.67 && weight >= 700);
				const need = large ? 3 : 4.5;
				const got = ratio(fg, bg);
				if (got < need) {
					contrast.push(
						`${label(el)} ${got.toFixed(2)} < ${need} "${trimmed.slice(0, 32)}"`,
					);
				}
			}
		}

		if (
			accent.length < cap &&
			cs.color === accentColor &&
			!el.closest("a, .display--alt, .sec-num") &&
			!el.closest("svg") &&
			!el.classList.contains("exp-dot")
		) {
			accent.push(`${label(el)} "${trimmed.slice(0, 32)}"`);
		}

		if (tracking.length < cap && !el.closest(".masthead") && !el.closest("svg")) {
			if (cs.textTransform === "uppercase" && cs.letterSpacing !== "normal") {
				const em = parseFloat(cs.letterSpacing) / fs;
				if (em >= 0.1) tracking.push(`${label(el)} ${em.toFixed(2)}em`);
			}
		}
	}

	const italicWatched = [
		".display--alt",
		".amp",
		".pull p",
		".subline",
		".hero-card .lede em",
		".exp-where",
		".stack-role",
		".contact-line--big",
	];
	const italicAllowed = new Set([".display--alt", ".pull p"]);
	const italic = italicWatched.filter((sel) => {
		const el = document.querySelector(sel);
		return Boolean(el) && getComputedStyle(el as Element).fontStyle === "italic" && !italicAllowed.has(sel);
	});

	return { banned, contrast, accent, italic, tracking, tiny };
}

async function sample(page: Page, clip: { x: number; y: number; width: number; height: number }) {
	const buf = await page.screenshot({ clip });
	return page.evaluate(async (dataUrl) => {
		const img = new Image();
		img.src = dataUrl;
		await img.decode();
		const canvas = document.createElement("canvas");
		canvas.width = img.naturalWidth;
		canvas.height = img.naturalHeight;
		const ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("no canvas");
		ctx.drawImage(img, 0, 0);
		const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
		const min = [255, 255, 255];
		const max = [0, 0, 0];
		let sum = 0;
		let n = 0;
		for (let i = 0; i < data.length; i += 4) {
			for (let k = 0; k < 3; k++) {
				min[k] = Math.min(min[k], data[i + k]);
				max[k] = Math.max(max[k], data[i + k]);
				sum += data[i + k];
			}
			n++;
		}
		return {
			dev: Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]),
			mean: sum / (3 * n),
		};
	}, `data:image/png;base64,${buf.toString("base64")}`);
}

test.describe("design: palette, type, contrast", () => {
	for (const route of HTML_ROUTES) {
		for (const width of WIDTHS) {
			test(`${route} at ${width}px`, async ({ page }) => {
				await page.setViewportSize({ width, height: 900 });
				await page.goto(route, { waitUntil: "networkidle" });
				await page.waitForTimeout(300);
				const report = await page.evaluate(auditPage);
				expect(report.banned, "warm or cream color rendered").toEqual([]);
				expect(report.contrast, "text below WCAG AA").toEqual([]);
				expect(report.accent, "accent used outside links").toEqual([]);
				expect(report.italic, "italic outside the two kept spots").toEqual([]);
				expect(report.tracking, "tracked uppercase outside the masthead").toEqual([]);
				expect(report.tiny, "text smaller than 11px").toEqual([]);
			});
		}

		test(`${route} nowrap text is not clipped`, async ({ page }) => {
			await page.goto(route, { waitUntil: "networkidle" });
			for (const vp of VIEWPORTS) {
				await page.setViewportSize(vp);
				const clipped = await page.evaluate(() => {
					const out: string[] = [];
					for (const el of document.querySelectorAll("*")) {
						if (el.closest("[aria-hidden='true'], .sr-only, .katex-mathml")) continue;
						const cs = getComputedStyle(el);
						if (cs.whiteSpace !== "nowrap" && cs.whiteSpace !== "pre") continue;
						if (cs.display === "none" || cs.visibility === "hidden") continue;
						if (cs.overflowX === "auto" || cs.overflowX === "scroll") continue;
						if (!(el.textContent ?? "").trim()) continue;
						if (el.clientWidth <= 2) continue;
						if (el.scrollWidth > el.clientWidth + 1) {
							const cls = (el.getAttribute("class") ?? "").toString().split(/\s+/)[0];
							out.push(
								`${el.tagName.toLowerCase()}${cls ? "." + cls : ""} scroll=${el.scrollWidth} client=${el.clientWidth}`,
							);
							if (out.length >= 6) break;
						}
					}
					return out;
				});
				expect(clipped, `clipped nowrap at ${vp.width}px`).toEqual([]);
			}
		});
	}

	test("body paragraphs stay within 80ch at 1920px", async ({ page }) => {
		await page.setViewportSize({ width: 1920, height: 1080 });
		for (const route of ["/", "/about", "/blog"]) {
			await page.goto(route, { waitUntil: "networkidle" });
			const wide = await page.evaluate(() => {
				const probe = document.createElement("span");
				probe.textContent = "0";
				probe.style.cssText = "position:absolute;visibility:hidden;white-space:pre;";
				document.body.appendChild(probe);
				const out: string[] = [];
				for (const el of document.querySelectorAll(
					".prose p, .exp-impact, .about-col--prose p, .contact-line, .lede, .door__deck",
				)) {
					const cs = getComputedStyle(el);
					probe.style.fontFamily = cs.fontFamily;
					probe.style.fontSize = cs.fontSize;
					probe.style.fontWeight = cs.fontWeight;
					probe.style.fontStyle = cs.fontStyle;
					const ch = probe.getBoundingClientRect().width;
					const w = el.getBoundingClientRect().width;
					if (ch > 0 && w > ch * 80 + 1) {
						out.push(`${el.className}: ${w.toFixed(0)}px > ${(ch * 80).toFixed(0)}px`);
					}
				}
				probe.remove();
				return out;
			});
			expect(wide, route).toEqual([]);
		}
	});
});

test.describe("design: flat stack, grain elsewhere", () => {
	test("the stack is a flat ink panel and the paper around it is grained", async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await page.goto("/about", { waitUntil: "networkidle" });

		await page.evaluate(() => {
			const el = document.querySelector(".stack");
			if (!el) return;
			const top = el.getBoundingClientRect().top;
			window.scrollBy(0, top - 120);
		});
		const box = await page.locator(".stack").boundingBox();
		expect(box, "stack section missing").not.toBeNull();
		if (!box) return;

		const paper = await sample(page, {
			x: Math.round(box.x / 2 - 8),
			y: Math.round(box.y + 36),
			width: 16,
			height: 16,
		});
		expect(paper.mean, "paper sample was not the light page").toBeGreaterThan(180);
		expect(paper.dev, "paper lost its grain").toBeGreaterThan(2);

		await page.evaluate(() => {
			const el = document.querySelector(".stack");
			if (!el) return;
			const bottom = el.getBoundingClientRect().bottom;
			window.scrollBy(0, bottom - window.innerHeight + 24);
		});
		const bottomBox = await page.locator(".stack").boundingBox();
		expect(bottomBox).not.toBeNull();
		if (!bottomBox) return;
		const ink = await sample(page, {
			x: Math.round(bottomBox.x + 48),
			y: Math.round(bottomBox.y + bottomBox.height - 18),
			width: 24,
			height: 8,
		});
		expect(ink.mean, "stack sample was not the dark panel").toBeLessThan(40);
		expect(ink.dev, "grain is showing through the stack").toBeLessThanOrEqual(2);
	});
});

test.describe("design: copy", () => {
	for (const route of COPY_ROUTES) {
		test(`${route} has no generic AI phrasing`, async ({ page }) => {
			await page.goto(route, { waitUntil: "networkidle" });
			const text = await page.locator("body").innerText();
			expect(text).not.toMatch(BUZZ);
		});
	}
});
