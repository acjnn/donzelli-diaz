// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import preact from "@astrojs/preact";
import sitemap from "@astrojs/sitemap";
import { unified } from "@astrojs/markdown-remark";
import remarkMath from "remark-math";
import remarkReadingTime from "remark-reading-time";
import rehypeKatex from "rehype-katex";
import { remarkSafeHeadingIds } from "./src/lib/remark-safe-heading-ids.mjs";

// https://astro.build/config
export default defineConfig({
  site: "https://donzellidiaz.com",
  integrations: [mdx(), preact(), sitemap()],
  markdown: {
    processor: unified({
      remarkPlugins: [remarkMath, remarkReadingTime, remarkSafeHeadingIds],
      rehypePlugins: [rehypeKatex],
    }),
    shikiConfig: {
      theme: "css-variables",
    },
  },
});
