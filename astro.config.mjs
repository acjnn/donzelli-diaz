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
  vite: {
    build: {
      rolldownOptions: {
        onLog(level, log, defaultHandler) {
          // Astro marks propagated MDX modules with this directive. Rolldown
          // does not understand it, and head propagation keys off the module
          // id instead, so the warning is noise.
          if (
            log.code === "MODULE_LEVEL_DIRECTIVE" &&
            String(log.message ?? "").includes("astro:head-inject")
          ) {
            return;
          }
          defaultHandler(level, log);
        },
      },
    },
  },
});
