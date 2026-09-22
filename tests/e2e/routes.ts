/** Every route the suite walks. */
export const ROUTES = [
	"/",
	"/about",
	"/blog",
	"/blog/seven-guardrails-down/",
	"/blog/series/signals/",
	"/blog/_components-gallery/",
	"/blog/series/field-notes/",
	"/blog/_adversarial/torture-title/",
	"/blog/_adversarial/torture-covers/",
	"/blog/_adversarial/torture-body/",
	"/blog/_adversarial/torture-dates-future/",
	"/blog/_adversarial/torture-dates-tie-a/",
	"/blog/_adversarial/torture-dates-tie-b/",
	"/blog/_adversarial/torture-series-single-a/",
	"/blog/_adversarial/torture-series-single-b/",
	"/404.html",
	"/rss.xml",
	"/sitemap-index.xml",
	"/cv/lorenzo-donzelli-diaz.pdf",
];

export const HTML_ROUTES = ROUTES.filter(
	(r) => !r.endsWith(".xml") && !r.endsWith(".pdf"),
);

export const VIEWPORTS = [
	{ width: 320, height: 700 },
	{ width: 375, height: 812 },
	{ width: 414, height: 896 },
	{ width: 768, height: 1024 },
	{ width: 1024, height: 768 },
	{ width: 1440, height: 900 },
	{ width: 1920, height: 1080 },
];
