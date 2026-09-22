import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { HTML_ROUTES } from "./routes";

const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");

test.describe("accessibility", () => {
	for (const route of HTML_ROUTES) {
		test(`${route} has no serious axe violations`, async ({ page }) => {
			await page.goto(route, { waitUntil: "networkidle" });
			await page.addScriptTag({ content: axeSource });
			const results = await page.evaluate(async () => {
				// @ts-expect-error axe injected above
				const r = await window.axe.run(document, {
					resultTypes: ["violations"],
				});
				return r.violations
					.filter((v: any) => ["serious", "critical"].includes(v.impact))
					.map((v: any) => ({
						id: v.id,
						impact: v.impact,
						nodes: v.nodes.slice(0, 3).map((n: any) => n.target.join(" ")),
					}));
			});
			expect(results, JSON.stringify(results, null, 2)).toEqual([]);
		});
	}

	test("keyboard tab order reaches every nav link and door", async ({ page }) => {
		await page.goto("/", { waitUntil: "networkidle" });
		const reached: string[] = [];
		for (let i = 0; i < 20; i++) {
			await page.keyboard.press("Tab");
			const current = await page.evaluate(() => {
				const el = document.activeElement;
				return el?.tagName === "A" ? (el.getAttribute("href") ?? "") : "";
			});
			if (current) reached.push(current);
		}
		for (const expected of ["/blog", "/about", "mailto:lorenzodonzelli93@gmail.com"]) {
			expect(reached, `never tabbed to ${expected}`).toContain(expected);
		}
	});

	test("focused links show a visible indicator", async ({ page }) => {
		await page.goto("/", { waitUntil: "networkidle" });
		await page.keyboard.press("Tab");
		const outline = await page.evaluate(() => {
			const el = document.activeElement;
			if (!el) return "";
			const s = getComputedStyle(el);
			return `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor}`;
		});
		expect(outline).not.toContain("none");
		expect(outline).not.toContain("0px");
	});

	test("prefers-reduced-motion disables ink animation and parallax", async ({ page }) => {
		await page.emulateMedia({ reducedMotion: "reduce" });
		await page.goto("/", { waitUntil: "networkidle" });
		const state = await page.evaluate(() => {
			const letter = document.querySelector(".ink-letter");
			const grid = document.querySelector(".hero-grid");
			if (!letter || !grid) return { letter: "missing", grid: "missing" };
			const ls = getComputedStyle(letter);
			return {
				letter: ls.animationName,
				opacity: ls.opacity,
			};
		});
		expect(state.letter).toBe("none");
		expect(state.opacity).toBe("1");

		// parallax must not move the grid under reduced motion
		await page.evaluate(() => window.scrollTo(0, 500));
		await page.waitForTimeout(200);
		const transform = await page.evaluate(
			() => (document.querySelector(".hero-grid") as HTMLElement)?.style.transform ?? "",
		);
		expect(transform).not.toContain("translateY(-");
	});
});
