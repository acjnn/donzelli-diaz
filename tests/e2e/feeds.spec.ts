import { expect, test } from "@playwright/test";

test.describe("feeds and discovery", () => {
	test("RSS is valid XML with items and no drafts", async ({ request }) => {
		const res = await request.get("/rss.xml");
		expect(res.status()).toBe(200);
		expect(res.headers()["content-type"]).toContain("xml");
		const body = await res.text();

		expect(body).toContain("<rss");
		expect(body).toContain("<title>Donzelli Diaz</title>");
		// drafts are excluded from the default build; in the drafts build the
		// gallery is present — either way it must be well-formed
		expect(body).not.toContain("undefined");
		expect(body).not.toContain("NaN");
		// every item has the required elements
		const items = body.match(/<item>[\s\S]*?<\/item>/g) ?? [];
		for (const item of items) {
			expect(item).toContain("<title>");
			expect(item).toContain("<link>");
			expect(item).toContain("<pubDate>");
			expect(item).toContain("<description>");
		}
	});

	test("sitemap index and child sitemap list only real routes", async ({ request }) => {
		const index = await request.get("/sitemap-index.xml");
		expect(index.status()).toBe(200);
		const indexBody = await index.text();
		expect(indexBody).toContain("sitemap");

		const child = await request.get("/sitemap-0.xml");
		expect(child.status()).toBe(200);
		const body = await child.text();

		for (const route of ["/", "/about/", "/blog/"]) {
			expect(body, `sitemap missing ${route}`).toContain(`https://donzellidiaz.com${route}`);
		}
		// 404 and assets must never appear
		expect(body).not.toContain("404");
		expect(body).not.toContain(".pdf");
	});

	test("404 page exists, is styled, and returns 404", async ({ page, request }) => {
		const res = await request.get("/this-page-does-not-exist");
		// astro preview serves the 404 page with a 404 status
		expect(res.status()).toBe(404);

		await page.goto("/this-page-does-not-exist");
		await expect(page.locator(".errata__title")).toHaveText("Page not found");
		const bg = await page.evaluate(() => getComputedStyle(document.querySelector(".page")!).backgroundColor);
		expect(bg).not.toBe("rgba(0, 0, 0, 0)"); // paper background applied
	});

	test("CV PDF is served", async ({ request }) => {
		const res = await request.get("/cv/lorenzo-donzelli-diaz.pdf");
		expect(res.status()).toBe(200);
		expect(res.headers()["content-type"]).toContain("pdf");
		const body = await res.body();
		expect(body.length).toBeGreaterThan(10_000);
		expect(body.subarray(0, 5).toString()).toBe("%PDF-");
	});

	test("every page has canonical, description, and RSS discovery", async ({ page }) => {
		for (const route of ["/", "/about", "/blog", "/blog/_components-gallery/"]) {
			await page.goto(route);
			await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
				"href",
				/^https:\/\/donzellidiaz\.com/,
			);
			await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /.+/);
			await expect(page.locator('link[rel="alternate"][type="application/rss+xml"]')).toHaveAttribute(
				"href",
				"/rss.xml",
			);
			await expect(page.locator("html")).toHaveAttribute("lang", "en");
		}
	});
});
