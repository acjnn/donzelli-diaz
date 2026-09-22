import { expect, test } from "@playwright/test";
import { HTML_ROUTES } from "./routes";

test.describe("security: content never executes", () => {
	test("torture title does not inject script", async ({ page }) => {
		const dialogs: string[] = [];
		page.on("dialog", (d) => {
			dialogs.push(d.message());
			void d.dismiss();
		});
		await page.goto("/blog/_adversarial/torture-title/", { waitUntil: "networkidle" });
		await page.waitForTimeout(500);

		expect(dialogs, "an alert() fired — unescaped content executed").toEqual([]);

		// the literal string must appear escaped in the DOM, never as an element
		const scriptCount = await page.evaluate(
			() => document.querySelectorAll(".post-title script, .prose script").length,
		);
		expect(scriptCount).toBe(0);

		const titleText = await page.locator(".post-title").innerText();
		expect(titleText).toContain("<script>");
	});

	test("no inline event handlers anywhere", async ({ page }) => {
		for (const route of HTML_ROUTES) {
			await page.goto(route, { waitUntil: "domcontentloaded" });
			const handlers = await page.evaluate(() => {
				const bad: string[] = [];
				for (const el of document.querySelectorAll("*")) {
					for (const attr of el.attributes) {
						if (/^on/i.test(attr.name)) bad.push(`${el.tagName}[${attr.name}]`);
					}
				}
				return bad;
			});
			expect(handlers, `${route} has inline handlers`).toEqual([]);
		}
	});

	test("no javascript: URLs", async ({ page }) => {
		for (const route of HTML_ROUTES) {
			await page.goto(route, { waitUntil: "domcontentloaded" });
			const bad = await page.evaluate(() =>
				[...document.querySelectorAll("a[href], img[src]")]
					.map((el) => el.getAttribute("href") ?? el.getAttribute("src") ?? "")
					.filter((u) => /^\s*javascript:/i.test(u)),
			);
			expect(bad, `${route} has javascript: URLs`).toEqual([]);
		}
	});
});

test.describe("network: nothing leaves the origin", () => {
	for (const route of HTML_ROUTES) {
		test(`${route} makes only same-origin requests`, async ({ page }) => {
			const external: string[] = [];
			page.on("request", (req) => {
				const url = new URL(req.url());
				if (url.origin !== "http://localhost:4321" && !req.url().startsWith("data:")) {
					external.push(req.url());
				}
			});
			await page.goto(route, { waitUntil: "networkidle" });
			await page.waitForTimeout(400);
			expect(external, "third-party requests detected").toEqual([]);
		});
	}

	test("every font requested exists and fonts stay under budget", async ({ page }) => {
		const fonts: { url: string; size: number; status: number }[] = [];
		page.on("response", async (res) => {
			if (res.url().includes("/fonts/")) {
				const body = await res.body().catch(() => null);
				fonts.push({ url: res.url(), size: body?.length ?? 0, status: res.status() });
			}
		});
		// the gallery exercises every family: display, body, mono, hand, math
		await page.goto("/blog/_components-gallery/", { waitUntil: "networkidle" });
		await page.waitForTimeout(500);

		expect(fonts.length, "no fonts were loaded at all").toBeGreaterThan(0);
		for (const f of fonts) {
			expect(f.status, `font ${f.url} returned ${f.status}`).toBe(200);
		}
		const total = fonts.reduce((s, f) => s + f.size, 0);
		// The gallery exercises every face at once (display, body, mono, hand,
		// math) — it is the worst case. Ordinary pages load 2-4 faces (~150 KB).
		expect(total, `font transfer ${(total / 1024).toFixed(0)} KB exceeds 400 KB`).toBeLessThan(400 * 1024);
	});
});
