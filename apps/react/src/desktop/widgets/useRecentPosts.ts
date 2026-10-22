import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import RECENT_POSTS from 'virtual:recent-posts';
import type { PostsMode } from './catalog';
import { mergeRecentPosts, popularOf, randomOf, seededRandom, type RecentPost } from './model';
import { loadPostIndex, loadPostStats, postIndexStore } from './postStats';
import { loadServerPosts, serverPostsStore } from './recentPostsApi';

/** 빌드한 저장소의 최근 글에 서버 글을 합친 최근 글 limit편. 서버 글은 처음 부를 때 한 번 묻는다 */
export function useRecentPosts(limit: number): RecentPost[] {
	return useWidgetPosts('recent', limit).posts;
}

/**
 * 메모 위젯이 보일 글 limit편.
 * - recent: 최근 글 (첫 화면에 넣은 작은 목록과 서버 글)
 * - popular: 메모 앱의 인기글 순위. 서버가 없거나 반응이 아직 없으면 빈 목록
 * - random: 모든 글 중 무작위. 위젯이 처음 그려질 때 한 번 고르고 그대로 둔다
 * loading이면 아직 목록을 불러오는 중이다
 */
export function useWidgetPosts(mode: PostsMode, limit: number): { posts: RecentPost[]; loading: boolean } {
	const server = useSyncExternalStore(serverPostsStore.subscribe, () => serverPostsStore.getState().posts);
	const index = useSyncExternalStore(postIndexStore.subscribe, postIndexStore.getState);
	const [seed] = useState(Math.random);
	useEffect(() => {
		void loadServerPosts();
		if (mode === 'recent') return;
		void loadPostIndex();
		if (mode === 'popular') void loadPostStats();
	}, [mode]);
	return useMemo(() => {
		if (mode === 'recent') return { posts: mergeRecentPosts(RECENT_POSTS, server ?? [], limit), loading: false };
		if (!index.posts) return { posts: [], loading: true };
		const all = mergeRecentPosts(index.posts, server ?? [], Infinity);
		if (mode === 'random') return { posts: randomOf(all, limit, seededRandom(seed)), loading: false };
		return { posts: popularOf(all, index.stats ?? {}, limit), loading: false };
	}, [mode, limit, server, index, seed]);
}
