import { glob } from "astro/loaders";
import { defineCollection, reference, z } from "astro:content";

const blog = defineCollection({
	// Load Markdown and MDX files in the `src/content/blog/` directory.
	// Post folders co-locate images: src/content/blog/<slug>/index.mdx + assets.
	loader: glob({ base: "./src/content/blog", pattern: "**/*.{md,mdx}" }),
	schema: ({ image }) =>
		z
			.object({
				title: z.string().max(120),
				description: z.string().max(200),
				pubDate: z.coerce.date(),
				updatedDate: z.coerce.date().optional(),
				cover: image().optional(),
				coverAlt: z.string().optional(),
				coverCaption: z.string().optional(),
				series: reference("series").optional(),
				seriesOrder: z.number().int().positive().optional(),
				tags: z.array(z.string()).max(8).default([]),
				draft: z.boolean().default(false),
			})
			.refine((d) => !d.cover || d.coverAlt, {
				message: "coverAlt is required when cover is set",
				path: ["coverAlt"],
			})
			.refine((d) => !d.seriesOrder || d.series, {
				message: "seriesOrder requires series",
				path: ["seriesOrder"],
			}),
});

const series = defineCollection({
	loader: glob({ base: "./src/content/series", pattern: "**/*.yaml" }),
	schema: z.object({
		title: z.string(),
		description: z.string(),
	}),
});

export const collections = { blog, series };
