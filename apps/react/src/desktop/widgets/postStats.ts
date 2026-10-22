// 메모 위젯의 인기글·랜덤이 읽는 것: 저장소의 모든 글(빌드한 목록)과 글마다 조회·댓글·좋아요.
// 첫 화면에는 넣지 않고 인기글·랜덤 위젯이 처음 그려질 때 한 번만 불러와 위젯끼리 나눠 쓴다
import type { PostStats } from '@macfolio/desktop-core/memo';
import { createStore } from '@macfolio/desktop-core';
import { fetchPostCounts } from '@/apps/memo/likes/likesApi';
import { fetchViews } from '@/shared/analytics/analytics';
import { env } from '@/shared/config/env';
import type { RecentPost } from './model';

interface State {
	/** 저장소의 모든 글 (최신 글이 먼저). null이면 아직 불러오는 중 */
	posts: RecentPost[] | null;
	/** 글마다 조회·댓글·좋아요. null이면 아직 묻는 중이거나 서버가 없다 */
	stats: Record<string, Partial<PostStats>> | null;
}

export const postIndexStore = createStore<State>({ posts: null, stats: null });

let loadingPosts: Promise<void> | null = null;
let loadingStats: Promise<void> | null = null;

/** 모든 글의 목록을 한 번 불러온다 */
export function loadPostIndex(): Promise<void> {
	loadingPosts ??= import('virtual:post-index').then(({ default: posts }) =>
		postIndexStore.setState((state) => ({ ...state, posts }))
	);
	return loadingPosts;
}

/** 글마다 조회수(/analytics/views)와 댓글·좋아요 수(/posts/stats)를 한 번 묻는다 (메모 앱의 인기글과 같은 값) */
export function loadPostStats(): Promise<void> {
	loadingStats ??= Promise.all([
		fetchViews('memo'),
		env.apiUrl ? fetchPostCounts(env.apiUrl) : Promise.resolve(null),
	]).then(([views, counts]) => {
		if (!views && !counts) return;
		const stats: Record<string, Partial<PostStats>> = {};
		for (const [slug, count] of Object.entries(views ?? {})) stats[slug] = { views: count };
		for (const [slug, { comments, likes }] of Object.entries(counts ?? {}))
			stats[slug] = { ...stats[slug], comments, likes };
		postIndexStore.setState((state) => ({ ...state, stats }));
	});
	return loadingStats;
}
