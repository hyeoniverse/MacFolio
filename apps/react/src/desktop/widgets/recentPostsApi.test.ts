import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadServerPosts, resetServerPosts, serverPostsStore } from './recentPostsApi';

const POST = { slug: 'a', title: '글', date: '2026-10-21', category: '개발기', summary: '', body: '', deleted: false };

afterEach(resetServerPosts);

describe('최근 글 위젯의 서버 글', () => {
	it('페이지마다 한 번만 묻고, 받은 글을 나눠 쓴다', async () => {
		const fetchImpl = vi.fn(async () => Response.json([POST]));
		await Promise.all([loadServerPosts('http://api', fetchImpl), loadServerPosts('http://api', fetchImpl)]);
		expect(fetchImpl).toHaveBeenCalledTimes(1);
		expect(serverPostsStore.getState().posts).toEqual([POST]);
	});

	it('서버가 없거나 읽지 못하면 빈 목록 (저장소 글만 보인다)', async () => {
		await loadServerPosts('', vi.fn());
		expect(serverPostsStore.getState().posts).toEqual([]);
	});
});
