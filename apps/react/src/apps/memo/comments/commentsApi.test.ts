import { describe, expect, it, vi } from 'vitest';
import { createComment, deleteComment, formatCommentTime, listComments } from './commentsApi';

const respond = (status: number, body?: unknown) =>
	vi.fn(
		async () => new Response(body === undefined ? null : JSON.stringify(body), { status })
	) as unknown as typeof fetch;
const COMMENT = {
	id: 'c1',
	name: '민수',
	ipPrefix: '211.234',
	isAdmin: false,
	body: '잘 봤어요',
	createdAt: '2026-09-29T05:05:00.000Z',
};

describe('listComments', () => {
	it('글의 댓글을 읽고, 실패하면 null', async () => {
		const fetchImpl = respond(200, [COMMENT]);
		await expect(listComments('http://api', 'cra-to-vite', fetchImpl)).resolves.toEqual([COMMENT]);
		expect(fetchImpl).toHaveBeenCalledWith('http://api/posts/cra-to-vite/comments', { credentials: 'include' });
		await expect(listComments('http://api', 'x', respond(500))).resolves.toBeNull();
	});
});

describe('createComment', () => {
	it('성공하면 쓴 댓글, 규칙을 어기면 서버가 모은 이유', async () => {
		await expect(createComment('http://api', 'a', { body: 'x' }, respond(201, COMMENT))).resolves.toEqual({
			ok: true,
			comment: COMMENT,
		});
		await expect(
			createComment('http://api', 'a', { body: '' }, respond(400, { message: ['내용을 입력해주세요.'] }))
		).resolves.toEqual({ ok: false, errors: ['내용을 입력해주세요.'] });
	});

	it('너무 자주 쓰면 잠시 뒤에', async () => {
		await expect(createComment('http://api', 'a', { body: 'x' }, respond(429, {}))).resolves.toEqual({
			ok: false,
			errors: ['잠시 뒤에 다시 써 주세요.'],
		});
	});
});

describe('deleteComment', () => {
	it('응답 상태를 결과로', async () => {
		await expect(deleteComment('http://api', 'c1', '1234', respond(204))).resolves.toBe('ok');
		await expect(deleteComment('http://api', 'c1', '0000', respond(403))).resolves.toBe('forbidden');
		await expect(deleteComment('http://api', 'c1', null, respond(404))).resolves.toBe('not-found');
	});
});

describe('formatCommentTime', () => {
	it('날짜와 24시간제 시각', () => {
		expect(formatCommentTime('2026-09-29T05:05:00.000Z', 'Asia/Seoul')).toBe('2026. 9. 29. 14:05');
	});
});
