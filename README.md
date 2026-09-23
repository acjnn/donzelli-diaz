# donzellidiaz.com

Personal site and journal of Lorenzo Donzelli Diaz — fullstack & AI engineer.

A single-page editorial landing that routes to two things: the **journal** (`/blog`, long-form MDX essays) and the **CV** (`/about`).

## Stack

- [Astro](https://astro.build) 7, fully static output
- MDX for posts, with a custom component library (figures, marginalia, callouts, charts, math)
- KaTeX for math, Shiki for code, self-hosted fonts (Cormorant Garamond, EB Garamond, JetBrains Mono, Caveat)
- Deployed to Cloudflare Workers as static assets via `wrangler deploy` (auto-deploys on push to `main`)

## Writing a post

Posts live in `src/content/blog/<slug>/index.mdx` with co-located images. Minimum frontmatter:

```yaml
---
title: "Title"
description: "One-line deck."
pubDate: 2026-09-22
---
```

Optional: `updatedDate`, `cover` + `coverAlt` (+ `coverCaption`), `series` + `seriesOrder`, `tags`, `draft: true` (excluded from builds unless `INCLUDE_DRAFTS=1`).

Series are declared in `src/content/series/<id>.yaml`.

## Commands

| Command            | Action                                        |
| :----------------- | :-------------------------------------------- |
| `npm install`      | Install dependencies                          |
| `npm run dev`      | Dev server at `localhost:4321`                |
| `npm run build`    | Production build to `./dist/` (drafts excluded) |
| `npm run build:drafts` | Build including draft posts (used by tests) |
| `npm run preview`  | Build and preview locally                     |
| `npm test`         | Unit tests (Vitest)                           |
| `npm run test:e2e` | Browser tests (Playwright)                    |
| `npm run check`    | Type-check                                    |
| `npm run deploy`   | Upload `./dist` to Cloudflare (run the build first) |
