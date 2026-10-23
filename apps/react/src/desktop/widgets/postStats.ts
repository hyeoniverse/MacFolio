// 메모 위젯의 인기글·랜덤이 읽는 것: 저장소의 모든 글(빌드한 목록)과 글마다 조회·댓글·좋아요.
// 첫 화면에는 넣지 않고 인기글·랜덤 위젯이 처음 그려질 때 불러온다. 반응 수는 인기글 위젯이 보이는 동안
// 10분마다 다시 묻고(postStatsPolling), 위젯이 여러 개여도 요청은 한 벌이다
import type { PostStats } from '@macfolio/desktop-core/memo';
import { createStore } from '@macfolio/desktop-core';
import { fetchPostCounts } from '@/apps/memo/likes/likesApi';
import { fetchViews } from '@/shared/analytics/analytics';
import { env } from '@/shared/config/env';
import { createSharedPoller, keepIfSame } from '@/shared/lib/poller';
import type { RecentPost } from './model';
import { WIDGET_POLL_MS } from './recentPostsApi';

interface State {
	/** 저장소의 모든 글 (최신 글이 먼저). null이면 아직 불러오는 중 */
	posts: RecentPost[] | null;
	/** 글마다 조회·댓글·좋아요. null이면 아직 묻는 중이거나 서버가 없다 */
	stats: Record<string, Partial<PostStats>> | null;
}

export const postIndexStore = createStore<State>({ posts: null, stats: null });

let loadingPosts: Promise<void> | null = null;

/** 모든 글의 목록을 한 번 불러온다 (빌드한 목록이라 바뀌지 않는다) */
export function loadPostIndex(): Promise<void> {
	loadingPosts ??= import('virtual:post-index').then(({ default: posts }) =>
		postIndexStore.setState((state) => ({ ...state, posts }))
	);
	return loadingPosts;
}

/**
 * 글마다 조회수(/analytics/views)와 댓글·좋아요 수(/posts/stats)를 묻는다 (메모 앱의 인기글과 같은 값).
 * 둘 다 읽지 못하면 보던 값을 그대로 두고 실패를 알린다
 */
export async function loadPostStats(): Promise<void> {
	const [views, counts] = await Promise.all([
		fetchViews('memo'),
		env.apiUrl ? fetchPostCounts(env.apiUrl) : Promise.resolve(null),
	]);
	if (!views && !counts) throw new Error('post stats');
	const stats: Record<string, Partial<PostStats>> = {};
	for (const [slug, count] of Object.entries(views ?? {})) stats[slug] = { views: count };
	for (const [slug, { comments, likes }] of Object.entries(counts ?? {}))
		stats[slug] = { ...stats[slug], comments, likes };
	postIndexStore.setState((state) => {
		const next = keepIfSame(state.stats, stats);
		return next === state.stats ? state : { ...state, stats: next };
	});
}

export const postStatsPolling = createSharedPoller({ intervalMs: WIDGET_POLL_MS, run: loadPostStats });
