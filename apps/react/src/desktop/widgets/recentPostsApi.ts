// 최근 글 위젯이 읽는 서버 글 (관리자가 사이트에서 쓴 글). 위젯끼리 한 일정(serverPostsPolling)을 나눠 쓴다:
// 바탕화면·홈 화면이 보이는 동안 10분마다 다시 묻고, 위젯이 여러 개여도 요청은 하나다
import type { ServerPost } from '@macfolio/contracts';
import { createStore } from '@macfolio/desktop-core';
import { api } from '@/shared/api/client';
import { env } from '@/shared/config/env';
import { createSharedPoller, keepIfSame } from '@/shared/lib/poller';

/** 위젯이 서버 글·인기글·GitHub 기여를 다시 묻는 간격. 글과 반응은 자주 바뀌지 않는다 */
export const WIDGET_POLL_MS = 10 * 60_000;

/** null이면 아직 묻지 않았거나 묻는 중 */
export const serverPostsStore = createStore<{ posts: ServerPost[] | null }>({ posts: null });

/**
 * 서버 글을 묻는다. API가 없거나 처음부터 읽지 못하면 빈 목록 (저장소 글만 보인다).
 * 한 번 읽은 뒤에 실패하면 보던 목록을 그대로 두고 실패를 알린다 (일정이 간격을 늘린다)
 */
export async function loadServerPosts(apiUrl = env.apiUrl, fetchImpl: typeof fetch = fetch): Promise<void> {
	const keepOrEmpty = () => {
		if (serverPostsStore.getState().posts === null) serverPostsStore.setState({ posts: [] });
	};
	if (!apiUrl) return keepOrEmpty();
	try {
		const posts = await api<ServerPost[]>('/posts', { apiUrl, fetchImpl });
		serverPostsStore.setState((state) => {
			const next = keepIfSame<ServerPost[] | null>(state.posts, posts);
			return next === state.posts ? state : { posts: next };
		});
	} catch (error) {
		keepOrEmpty();
		throw error;
	}
}

export const serverPostsPolling = createSharedPoller({
	intervalMs: WIDGET_POLL_MS,
	run: () => loadServerPosts(),
});

/** 시험에서 처음 상태로 */
export function resetServerPosts() {
	serverPostsStore.setState({ posts: null });
}
