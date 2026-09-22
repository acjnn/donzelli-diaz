import { expect, test } from "@playwright/test";
import { HTML_ROUTES, VIEWPORTS } from "./routes";

test.describe("layout: no horizontal overflow, no clipped content", () => {
	for (const route of HTML_ROUTES) {
		test.describe(route, () => {
			for (const vp of VIEWPORTS) {
				test(`no overflow at ${vp.width}px`, async ({ page }) => {
					await page.setViewportSize(vp);
					await page.goto(route, { waitUntil: "networkidle" });
					await page.waitForTimeout(600); // let ink animation settle

					const result = await page.evaluate(() => {
						const doc = document.documentElement;
						const overflowX = doc.scrollWidth - doc.clientWidth;
						const offenders: string[] = [];
						if (overflowX > 1) {
							for (const el of document.querySelectorAll("*")) {
								const r = el.getBoundingClientRect();
								if (r.width > 0 && (r.right > doc.clientWidth + 1 || r.left < -1)) {
									const cls = (el.getAttribute("class") ?? "").toString().slice(0, 60);
									offenders.push(
										`${el.tagName.toLowerCase()}${cls ? "." + cls.split(" ")[0] : ""} right=${Math.round(r.right)} left=${Math.round(r.left)}`,
									);
									if (offenders.length >= 5) break;
								}
							}
						}
						return { overflowX, offenders };
					});

					expect(
						result.overflowX,
						`horizontal overflow of ${result.overflowX}px; offenders: ${result.offenders.join(" | ")}`,
					).toBeLessThanOrEqual(1);
				});
			}

			test("no overflow at 320px with 200% font zoom", async ({ page }) => {
				await page.setViewportSize({ width: 320, height: 700 });
				await page.goto(route, { waitUntil: "networkidle" });
				await page.addStyleTag({
					content: "html { font-size: 200% !important; }",
				});
				await page.waitForTimeout(300);
				const overflowX = await page.evaluate(
					() => document.documentElement.scrollWidth - document.documentElement.clientWidth,
				);
				expect(overflowX).toBeLessThanOrEqual(1);
			});
		});
	}

	test("display headline never clips on home", async ({ page }) => {
		for (const vp of VIEWPORTS) {
			await page.setViewportSize(vp);
			await page.goto("/", { waitUntil: "networkidle" });
			await page.waitForTimeout(1200); // ink letters finish
			const clipped = await page.evaluate(() => {
				const out: string[] = [];
				for (const el of document.querySelectorAll(".display")) {
					if (el.scrollWidth > el.clientWidth + 1) {
						out.push(`${el.className}: scroll=${el.scrollWidth} client=${el.clientWidth}`);
					}
				}
				return out;
			});
			expect(clipped, `headline clipped at ${vp.width}px`).toEqual([]);
		}
	});
});
