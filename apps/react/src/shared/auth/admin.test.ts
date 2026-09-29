import { describe, expect, it, vi } from 'vitest';
import { avatarUrl, checkAdmin, readLoginResult } from './admin';

describe('readLoginResult', () => {
	it('결과를 읽고 주소에서 뺀다 (다른 쿼리는 둔다)', () => {
		expect(readLoginResult('https://macfolio.hyeoniverse.com/?admin=signed-in&x=1')).toEqual({
			result: 'signed-in',
			cleanHref: 'https://macfolio.hyeoniverse.com/?x=1',
		});
	});

	it('결과가 없으면 주소를 그대로, 모르는 값은 무시하고 뺀다', () => {
		expect(readLoginResult('http://localhost:5173/')).toEqual({ result: null, cleanHref: 'http://localhost:5173/' });
		expect(readLoginResult('http://localhost:5173/?admin=hacked')).toEqual({
			result: null,
			cleanHref: 'http://localhost:5173/',
		});
	});
});

describe('checkAdmin', () => {
	const respond = (status: number, body?: unknown) =>
		vi.fn(async () => new Response(body ? JSON.stringify(body) : null, { status })) as unknown as typeof fetch;

	it('API 주소가 없으면 꺼 둔다 (요청하지 않는다)', async () => {
		const fetchImpl = respond(200);
		await expect(checkAdmin('', fetchImpl)).resolves.toEqual({ status: 'disabled', login: null });
		expect(fetchImpl).not.toHaveBeenCalled();
	});

	it('관리자면 signed-in, 쿠키를 함께 보낸다', async () => {
		const fetchImpl = respond(200, { login: 'hyeoniverse' });
		await expect(checkAdmin('http://api', fetchImpl)).resolves.toEqual({ status: 'signed-in', login: 'hyeoniverse' });
		expect(fetchImpl).toHaveBeenCalledWith('http://api/auth/me', { credentials: 'include' });
	});

	it('401이면 signed-out, 서버 오류나 연결 실패는 offline', async () => {
		await expect(checkAdmin('http://api', respond(401))).resolves.toEqual({ status: 'signed-out', login: null });
		await expect(checkAdmin('http://api', respond(503))).resolves.toEqual({ status: 'offline', login: null });
		const down = vi.fn(async () => {
			throw new TypeError('Failed to fetch');
		}) as unknown as typeof fetch;
		await expect(checkAdmin('http://api', down)).resolves.toEqual({ status: 'offline', login: null });
	});
});

describe('avatarUrl', () => {
	it('GitHub 프로필 사진', () => {
		expect(avatarUrl('hyeoniverse')).toBe('https://github.com/hyeoniverse.png?size=120');
	});
});
