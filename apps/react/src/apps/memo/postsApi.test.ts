import { describe, expect, it, vi } from 'vitest';
import { deletePost, fetchServerPosts, savePost } from './postsApi';

const respond = (status: number, body?: unknown) =>
	vi.fn(
		async () => new Response(body === undefined ? null : JSON.stringify(body), { status })
	) as unknown as typeof fetch;
const DRAFT = { title: '새 글', date: '2026-09-29', category: '기타', summary: '', body: '본문' };
const POST = { ...DRAFT, slug: '2026-09-29-abc123', deleted: false };

describe('postsApi', () => {
	it('API가 없거나 실패하면 빈 목록', async () => {
		await expect(fetchServerPosts('', respond(200, [POST]))).resolves.toEqual([]);
		await expect(fetchServerPosts('http://api', respond(500))).resolves.toEqual([]);
		await expect(fetchServerPosts('http://api', respond(200, [POST]))).resolves.toEqual([POST]);
	});

	it('새 글은 POST, 고치면 PUT', async () => {
		const create = respond(201, POST);
		await expect(savePost('http://api', null, DRAFT, create)).resolves.toEqual({ ok: true, post: POST });
		expect(create).toHaveBeenCalledWith('http://api/posts', expect.objectContaining({ method: 'POST' }));
		const update = respond(200, POST);
		await savePost('http://api', 'cra-to-vite', DRAFT, update);
		expect(update).toHaveBeenCalledWith('http://api/posts/cra-to-vite', expect.objectContaining({ method: 'PUT' }));
	});

	it('거절되면 이유를 돌려준다', async () => {
		await expect(
			savePost('http://api', null, DRAFT, respond(400, { message: ['제목을 입력해주세요.'] }))
		).resolves.toEqual({
			ok: false,
			errors: ['제목을 입력해주세요.'],
		});
		await expect(savePost('http://api', null, DRAFT, respond(401))).resolves.toEqual({
			ok: false,
			errors: ['관리자 로그인이 끝났습니다. 다시 로그인해 주세요.'],
		});
	});

	it('지우기는 성공 여부', async () => {
		await expect(deletePost('http://api', 'a', respond(204))).resolves.toBe(true);
		await expect(deletePost('http://api', 'a', respond(401))).resolves.toBe(false);
	});
});
