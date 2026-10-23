import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import RECENT_POSTS from 'virtual:recent-posts';
import type { PostsMode } from './catalog';
import { mergeRecentPosts, popularOf, randomOf, seededRandom, type RecentPost } from './model';
import { env } from '@/shared/config/env';
import { useSharedPolling } from '@/shared/hooks/usePolling';
import { useHomeScreenShown } from '@/desktop/useAppWindowShown';
import { loadPostIndex, postIndexStore, postStatsPolling } from './postStats';
import { serverPostsPolling, serverPostsStore } from './recentPostsApi';

/** 빌드한 저장소의 최근 글에 서버 글을 합친 최근 글 limit편. 서버 글은 바탕화면·홈 화면이 보이는 동안 10분마다 묻는다 */
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
	// 서버 글과 반응 수는 위젯끼리 한 일정을 나눠 쓴다 (위젯이 여러 개여도 요청은 하나)
	const shown = useHomeScreenShown() && Boolean(env.apiUrl);
	useSharedPolling(serverPostsPolling, shown);
	useSharedPolling(postStatsPolling, shown && mode === 'popular');
	useEffect(() => {
		if (mode !== 'recent') void loadPostIndex();
	}, [mode]);
	return useMemo(() => {
		if (mode === 'recent') return { posts: mergeRecentPosts(RECENT_POSTS, server ?? [], limit), loading: false };
		if (!index.posts) return { posts: [], loading: true };
		const all = mergeRecentPosts(index.posts, server ?? [], Infinity);
		if (mode === 'random') return { posts: randomOf(all, limit, seededRandom(seed)), loading: false };
		return { posts: popularOf(all, index.stats ?? {}, limit), loading: false };
	}, [mode, limit, server, index, seed]);
}
