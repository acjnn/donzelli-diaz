import { getCollection, type CollectionEntry } from "astro:content";

export type Post = CollectionEntry<"blog">;
export type Series = CollectionEntry<"series">;

/** All posts, drafts excluded unless INCLUDE_DRAFTS=1, newest first. */
export async function getPosts(): Promise<Post[]> {
	const includeDrafts = import.meta.env.INCLUDE_DRAFTS === "1";
	const posts = await getCollection("blog", ({ data }) =>
		includeDrafts ? true : !data.draft,
	);
	return posts.sort(
		(a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf(),
	);
}

/** Posts belonging to a series, ordered by seriesOrder. */
export function seriesPosts(posts: Post[], seriesId: string): Post[] {
	return posts
		.filter((p) => p.data.series?.id === seriesId)
		.sort((a, b) => (a.data.seriesOrder ?? 0) - (b.data.seriesOrder ?? 0));
}

/** Reading time injected by remark-reading-time into frontmatter. */
export function readingTime(post: Post): number | undefined {
	const rt = (post.data as Record<string, unknown>).readingTime as
		| { minutes?: number }
		| undefined;
	return rt?.minutes ? Math.max(1, Math.round(rt.minutes)) : undefined;
}

export { roman } from "./roman";
