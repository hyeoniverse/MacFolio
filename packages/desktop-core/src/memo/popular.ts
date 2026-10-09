// 인기글: 조회수·댓글 수·좋아요 수로 점수를 매겨 위에서 10개.
// 조회수는 /analytics/views, 댓글·좋아요 수는 /posts/stats (서버는 저장소 Markdown 글을 모르므로 순위는 화면에서 매긴다)
import type { Post } from './posts.js';

/** 글 하나의 반응 */
export interface PostStats {
	views: number;
	comments: number;
	likes: number;
}

/** 인기글에 보일 글 수 */
export const POPULAR_LIMIT = 10;

/**
 * 인기 점수: 조회 1, 좋아요 3, 댓글 5.
 * 좋아요는 누르기만 하면 되고 댓글은 글을 써야 하므로 댓글을 더 무겁게 센다. 조회는 가장 흔하므로 가장 가볍게
 */
export const POPULARITY_WEIGHTS = { views: 1, likes: 3, comments: 5 } as const;

export const popularityScore = ({ views, comments, likes }: PostStats) =>
	views * POPULARITY_WEIGHTS.views + likes * POPULARITY_WEIGHTS.likes + comments * POPULARITY_WEIGHTS.comments;

/** 글의 반응 (없는 값은 0) */
export const statsOf = (stats: Record<string, Partial<PostStats>>, slug: string): PostStats => ({
	views: stats[slug]?.views ?? 0,
	comments: stats[slug]?.comments ?? 0,
	likes: stats[slug]?.likes ?? 0,
});

/**
 * 점수가 높은 순서로 limit개. 반응이 하나도 없는 글은 넣지 않는다.
 * 점수가 같으면 좋아요, 댓글, 조회가 많은 글, 그래도 같으면 최근 글
 */
export function popularPosts(posts: Post[], stats: Record<string, Partial<PostStats>>, limit = POPULAR_LIMIT): Post[] {
	return posts
		.map((post) => ({ post, stats: statsOf(stats, post.slug) }))
		.map((entry) => ({ ...entry, score: popularityScore(entry.stats) }))
		.filter((entry) => entry.score > 0)
		.sort(
			(a, b) =>
				b.score - a.score ||
				b.stats.likes - a.stats.likes ||
				b.stats.comments - a.stats.comments ||
				b.stats.views - a.stats.views ||
				b.post.date.localeCompare(a.post.date)
		)
		.slice(0, limit)
		.map((entry) => entry.post);
}
