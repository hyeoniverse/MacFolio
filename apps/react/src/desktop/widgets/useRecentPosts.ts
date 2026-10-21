import { useEffect, useMemo, useSyncExternalStore } from 'react';
import RECENT_POSTS from 'virtual:recent-posts';
import { mergeRecentPosts, type RecentPost } from './model';
import { loadServerPosts, serverPostsStore } from './recentPostsApi';

/** 빌드한 저장소의 최근 글에 서버 글을 합친 최근 글 limit편. 서버 글은 처음 부를 때 한 번 묻는다 */
export function useRecentPosts(limit: number): RecentPost[] {
	const server = useSyncExternalStore(serverPostsStore.subscribe, () => serverPostsStore.getState().posts);
	useEffect(() => {
		void loadServerPosts();
	}, []);
	return useMemo(() => mergeRecentPosts(RECENT_POSTS, server ?? [], limit), [server, limit]);
}
