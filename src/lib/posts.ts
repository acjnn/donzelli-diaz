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

/** Words in the essay. Footnote definitions at the end are not part of the count. */
function countWords(body: string): number {
	const essay = body.replace(/\n\[\^[^\]]+\]:[\s\S]*$/, "");
	return essay.trim().split(/\s+/).filter(Boolean).length;
}

/** Reading time from remark-reading-time, or a 200 wpm count of the body. */
export function readingTime(post: Post): number | undefined {
	const rt = (post.data as Record<string, unknown>).readingTime as
		| { minutes?: number }
		| undefined;
	const minutes =
		rt?.minutes ??
		(post.body ? countWords(post.body) / 200 : undefined);
	return minutes ? Math.max(1, Math.round(minutes)) : undefined;
}

export { roman } from "./roman";
