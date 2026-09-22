import { defineConfig } from "@playwright/test";

export default defineConfig({
	testDir: "./tests/e2e",
	timeout: 60_000,
	retries: process.env.CI ? 1 : 0,
	workers: process.env.CI ? 2 : 4,
	reporter: process.env.CI ? "github" : "list",
	use: {
		baseURL: "http://localhost:4321",
	},
	webServer: {
		command: "npm run build:drafts && npx astro preview --port 4321",
		url: "http://localhost:4321",
		reuseExistingServer: !process.env.CI,
		timeout: 300_000,
	},
	projects: [
		{ name: "chromium", use: { browserName: "chromium" } },
	],
});
