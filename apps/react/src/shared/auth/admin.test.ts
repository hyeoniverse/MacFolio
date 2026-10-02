import { describe, expect, it, vi } from 'vitest';
import { avatarUrl, checkAdmin, formatSignedInAt, loginOutcome, readLoginResult } from './admin';

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

	it('로그인한 때를 받으면 함께 둔다 (예전 서버처럼 없거나 잘못된 값이면 뺀다)', async () => {
		const at = '2026-10-02T10:03:00.000Z';
		await expect(checkAdmin('http://api', respond(200, { login: 'hyeoniverse', signedInAt: at }))).resolves.toEqual({
			status: 'signed-in',
			login: 'hyeoniverse',
			signedInAt: new Date(at),
		});
		const broken = await checkAdmin('http://api', respond(200, { login: 'hyeoniverse', signedInAt: 'yesterday' }));
		expect(broken).not.toHaveProperty('signedInAt');
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

describe('formatSignedInAt', () => {
	it('날짜와 오전·오후 시각', () => {
		expect(formatSignedInAt(new Date(2026, 9, 2, 19, 3))).toBe('2026년 10월 2일 오후 7:03');
		expect(formatSignedInAt(new Date(2026, 0, 5, 0, 9))).toBe('2026년 1월 5일 오전 12:09');
		expect(formatSignedInAt(new Date(2026, 0, 5, 12, 0))).toBe('2026년 1월 5일 오후 12:00');
	});
});

describe('avatarUrl', () => {
	it('GitHub 프로필 사진', () => {
		expect(avatarUrl('hyeoniverse')).toBe('https://github.com/hyeoniverse.png?size=120');
	});
});

describe('loginOutcome', () => {
	const signedIn = { status: 'signed-in' as const, login: 'hyeoniverse' };
	const signedOut = { status: 'signed-out' as const, login: null };

	it('서버가 로그인했다고 하면 성공', () => {
		expect(loginOutcome('signed-in', signedIn)).toMatchObject({ tone: 'success', title: '로그인했습니다' });
		expect(loginOutcome('signed-in', signedIn).body).toContain('hyeoniverse');
	});

	it('관리자가 아니거나 취소했으면 그 이유를 알린다', () => {
		expect(loginOutcome('denied', signedOut)).toMatchObject({ tone: 'fail', title: '로그인할 수 없습니다' });
		expect(loginOutcome('cancelled', signedOut)).toMatchObject({ tone: 'fail', title: '로그인을 취소했습니다' });
	});

	it('주소는 성공인데 서버가 모른다고 하면 실패로 알린다 (쿠키가 막힌 경우)', () => {
		expect(loginOutcome('signed-in', signedOut)).toMatchObject({ tone: 'fail', title: '로그인을 확인하지 못했습니다' });
		expect(loginOutcome('signed-in', { status: 'offline', login: null }).tone).toBe('fail');
	});
});
