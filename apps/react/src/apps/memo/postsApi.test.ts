import { describe, expect, it, vi } from 'vitest';
import {
	deletePost,
	discardDraft,
	fetchAdminPosts,
	fetchRevision,
	fetchRevisions,
	fetchServerPosts,
	publishPost,
	saveDraft,
} from './postsApi';

const respond = (status: number, body?: unknown) =>
	vi.fn(
		async () => new Response(body === undefined ? null : JSON.stringify(body), { status })
	) as unknown as typeof fetch;
const DRAFT = { title: '새 글', date: '2026-09-29', category: '기타', summary: '', body: '본문' };
const POST = { ...DRAFT, slug: '2026-09-29-abc123', deleted: false };
const ADMIN = {
	slug: 'a',
	published: null,
	publishedAt: null,
	draft: DRAFT,
	draftUpdatedAt: 'x',
	deleted: false,
	revisions: 0,
};

describe('postsApi', () => {
	it('API가 없거나 실패하면 빈 목록', async () => {
		await expect(fetchServerPosts('', respond(200, [POST]))).resolves.toEqual([]);
		await expect(fetchServerPosts('http://api', respond(500))).resolves.toEqual([]);
		await expect(fetchServerPosts('http://api', respond(200, [POST]))).resolves.toEqual([POST]);
	});

	it('임시 저장: 새 글은 POST /posts, 고치면 PUT /posts/:slug/draft', async () => {
		const create = respond(201, ADMIN);
		await expect(saveDraft('http://api', null, DRAFT, create)).resolves.toEqual({ ok: true, post: ADMIN });
		expect(create).toHaveBeenCalledWith('http://api/posts', expect.objectContaining({ method: 'POST' }));
		const update = respond(200, ADMIN);
		await saveDraft('http://api', 'cra-to-vite', DRAFT, update);
		expect(update).toHaveBeenCalledWith(
			'http://api/posts/cra-to-vite/draft',
			expect.objectContaining({ method: 'PUT', body: JSON.stringify(DRAFT) })
		);
	});

	it('게시는 지금 내용을 보내고, 버리기는 게시한 적 없는 글이면 null', async () => {
		const publish = respond(200, ADMIN);
		await expect(publishPost('http://api', 'a', DRAFT, publish)).resolves.toEqual({ ok: true, post: ADMIN });
		expect(publish).toHaveBeenCalledWith('http://api/posts/a/publish', expect.objectContaining({ method: 'POST' }));
		await expect(discardDraft('http://api', 'a', respond(200, ADMIN))).resolves.toEqual({ ok: true, post: ADMIN });
		await expect(discardDraft('http://api', 'a', respond(200))).resolves.toEqual({ ok: true, post: null });
	});

	it('관리자 목록과 버전은 읽지 못하면 null', async () => {
		await expect(fetchAdminPosts('http://api', respond(200, [ADMIN]))).resolves.toEqual([ADMIN]);
		await expect(fetchAdminPosts('http://api', respond(401))).resolves.toBeNull();
		await expect(fetchAdminPosts('', respond(200, [ADMIN]))).resolves.toBeNull();
		const list = respond(200, [{ id: 1 }]);
		await expect(fetchRevisions('http://api', 'a b', list)).resolves.toEqual([{ id: 1 }]);
		expect(list).toHaveBeenCalledWith('http://api/posts/a%20b/revisions', expect.anything());
		await expect(fetchRevision('http://api', 'a', 1, respond(404))).resolves.toBeNull();
	});

	it('거절되면 이유를 돌려준다', async () => {
		await expect(
			saveDraft('http://api', null, DRAFT, respond(400, { message: ['제목을 입력해주세요.'] }))
		).resolves.toEqual({
			ok: false,
			errors: ['제목을 입력해주세요.'],
		});
		await expect(publishPost('http://api', 'a', DRAFT, respond(401))).resolves.toEqual({
			ok: false,
			errors: ['관리자 로그인이 끝났습니다. 다시 로그인해 주세요.'],
		});
		const offline = vi.fn(async () => {
			throw new TypeError('offline');
		}) as unknown as typeof fetch;
		await expect(saveDraft('http://api', 'a', DRAFT, offline)).resolves.toEqual({
			ok: false,
			errors: ['서버에 연결할 수 없습니다.'],
		});
	});

	it('지우기는 성공 여부', async () => {
		await expect(deletePost('http://api', 'a', respond(204))).resolves.toBe(true);
		await expect(deletePost('http://api', 'a', respond(401))).resolves.toBe(false);
	});
});
