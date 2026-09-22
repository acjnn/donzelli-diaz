import { expect, test } from "@playwright/test";

// Visual regression baselines live in tests/e2e/visual.spec.ts-snapshots/
// Regenerate with: npx playwright test visual --update-snapshots

const SHOTS: { route: string; name: string }[] = [
	{ route: "/", name: "home" },
	{ route: "/about", name: "about" },
	{ route: "/blog", name: "blog" },
	{ route: "/blog/_components-gallery/", name: "gallery" },
];

test.describe("visual regression", () => {
	for (const { route, name } of SHOTS) {
		for (const width of [375, 1440]) {
			test(`${name} at ${width}px`, async ({ page }) => {
				await page.setViewportSize({ width, height: 900 });
				await page.goto(route, { waitUntil: "networkidle" });
				// ink-letter entrance animation must be finished
				await page.waitForTimeout(1500);
				await expect(page).toHaveScreenshot(`${name}-${width}.png`, {
					fullPage: true,
					maxDiffPixelRatio: 0.01,
				});
			});
		}
	}
});
