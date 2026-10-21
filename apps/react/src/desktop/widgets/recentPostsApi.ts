// 최근 글 위젯이 읽는 서버 글 (관리자가 사이트에서 쓴 글). 페이지마다 한 번만 묻고 위젯끼리 나눠 쓴다
import type { ServerPost } from '@macfolio/contracts';
import { createStore } from '@macfolio/desktop-core';
import { fetchServerPosts } from '@/apps/memo/postsApi';
import { env } from '@/shared/config/env';

/** null이면 아직 묻지 않았거나 묻는 중 */
export const serverPostsStore = createStore<{ posts: ServerPost[] | null }>({ posts: null });

let asked: Promise<void> | null = null;

/** 서버 글을 한 번 묻는다 (API가 없거나 읽지 못하면 빈 목록: 저장소 글만 보인다) */
export function loadServerPosts(apiUrl = env.apiUrl, fetchImpl: typeof fetch = fetch): Promise<void> {
	asked ??= fetchServerPosts(apiUrl, fetchImpl).then((posts) => serverPostsStore.setState({ posts }));
	return asked;
}

/** 시험에서 처음 상태로 */
export function resetServerPosts() {
	asked = null;
	serverPostsStore.setState({ posts: null });
}
