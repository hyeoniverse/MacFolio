import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadServerPosts, resetServerPosts, serverPostsStore } from './recentPostsApi';

const POST = { slug: 'a', title: '글', date: '2026-10-21', category: '개발기', summary: '', body: '', deleted: false };

afterEach(resetServerPosts);

describe('최근 글 위젯의 서버 글', () => {
	it('받은 글을 저장소에 둔다. 같은 목록을 다시 받으면 저장소의 값을 바꾸지 않는다 (위젯을 다시 그리지 않게)', async () => {
		const fetchImpl = vi.fn(async () => Response.json([POST]));
		await loadServerPosts('http://api', fetchImpl);
		const first = serverPostsStore.getState().posts;
		expect(first).toEqual([POST]);
		await loadServerPosts('http://api', fetchImpl);
		expect(serverPostsStore.getState().posts).toBe(first);
	});

	it('서버가 없거나 처음부터 읽지 못하면 빈 목록 (저장소 글만 보인다)', async () => {
		await loadServerPosts('', vi.fn());
		expect(serverPostsStore.getState().posts).toEqual([]);
		resetServerPosts();
		await expect(
			loadServerPosts(
				'http://api',
				vi.fn(async () => new Response('', { status: 502 }))
			)
		).rejects.toThrow();
		expect(serverPostsStore.getState().posts).toEqual([]);
	});

	it('한 번 읽은 뒤에 실패하면 보던 목록을 그대로 두고 reject한다 (일정이 간격을 늘린다)', async () => {
		await loadServerPosts(
			'http://api',
			vi.fn(async () => Response.json([POST]))
		);
		await expect(
			loadServerPosts(
				'http://api',
				vi.fn(async () => new Response('', { status: 502 }))
			)
		).rejects.toThrow();
		expect(serverPostsStore.getState().posts).toEqual([POST]);
	});
});
