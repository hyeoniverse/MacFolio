import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { GithubClient } from '../src/auth/github.client.js';
import { hashToken } from '../src/auth/session.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

process.env.DATABASE_URL ??= 'postgresql://macfolio:macfolio@localhost:5432/macfolio';
process.env.CORS_ORIGINS = 'http://localhost:5173';
process.env.GITHUB_CLIENT_ID = 'test-client-id';
process.env.GITHUB_CLIENT_SECRET = 'test-client-secret';
process.env.ADMIN_GITHUB_ID = '68999618';
// 이 파일은 로그인을 여러 번 하므로 요청 제한을 넉넉히 (제한은 throttle.e2e.test.ts에서 확인)
process.env.AUTH_RATE_LIMIT = '1000';

/** GitHub 대신: 인가 코드마다 정해 둔 계정으로 로그인된다 */
const ACCOUNTS: Record<string, { id: number; login: string }> = {
	'admin-code': { id: 68999618, login: 'hyeoniverse' },
	'visitor-code': { id: 1, login: 'someone' },
	// 관리자가 이름을 바꾼 뒤 옛 이름을 가져간 다른 사람
	'impostor-code': { id: 2, login: 'hyeoniverse' },
};
const fakeGithub: Partial<GithubClient> = {
	exchangeCode: async ({ code }) => (ACCOUNTS[code] ? `token-${code}` : null),
	getUser: async (token) => ({ ...ACCOUNTS[token.replace('token-', '')], avatarUrl: '' }),
};

/** set-cookie 헤더에서 쿠키 하나 */
const cookieFrom = (response: request.Response, name: string) =>
	([] as string[]).concat(response.headers['set-cookie'] ?? []).find((cookie) => cookie.startsWith(`${name}=`));
const valueOf = (cookie: string | undefined) => cookie?.split(';')[0].split('=')[1];

describe('관리자 로그인 (e2e)', () => {
	let app: INestApplication;
	let prisma: PrismaService;

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
			.overrideProvider(GithubClient)
			.useValue(fakeGithub)
			.compile();
		app = configureApp(moduleRef.createNestApplication());
		await app.init();
		prisma = app.get(PrismaService);
	});

	beforeEach(async () => {
		await prisma.adminSession.deleteMany();
	});

	afterAll(async () => {
		await app?.close();
	});

	/** 로그인 시작 → GitHub에서 돌아오기까지 */
	async function signIn(code: string) {
		const start = await request(app.getHttpServer()).get('/auth/github').expect(302);
		const stateCookie = cookieFrom(start, 'macfolio_oauth_state')!;
		const state = new URL(start.headers.location).searchParams.get('state');
		return request(app.getHttpServer())
			.get('/auth/github/callback')
			.query({ code, state })
			.set('Cookie', stateCookie.split(';')[0]);
	}

	it('로그인 시작: GitHub로 보내고 state를 httpOnly 쿠키로 기억한다', async () => {
		const response = await request(app.getHttpServer()).get('/auth/github').expect(302);
		const location = new URL(response.headers.location);
		expect(location.origin).toBe('https://github.com');
		expect(location.searchParams.get('client_id')).toBe('test-client-id');

		const cookie = cookieFrom(response, 'macfolio_oauth_state');
		expect(valueOf(cookie)).toBe(location.searchParams.get('state'));
		expect(cookie).toMatch(/HttpOnly/);
		expect(cookie).toMatch(/SameSite=Lax/);
	});

	it('관리자: 세션 쿠키를 받고 프론트엔드로 돌아가며, /auth/me가 관리자를 알려 준다', async () => {
		const callback = await signIn('admin-code');
		expect(callback.status).toBe(302);
		expect(callback.headers.location).toBe('http://localhost:5173/?admin=signed-in');

		const session = cookieFrom(callback, 'macfolio_session');
		expect(session).toMatch(/HttpOnly/);
		const token = valueOf(session)!;

		const me = await request(app.getHttpServer()).get('/auth/me').set('Cookie', `macfolio_session=${token}`);
		expect(me.status).toBe(200);
		expect(me.body).toEqual({ login: 'hyeoniverse' });

		// DB에는 토큰이 아니라 해시만
		const rows = await prisma.adminSession.findMany();
		expect(rows).toHaveLength(1);
		expect(rows[0].tokenHash).toBe(hashToken(token));
		expect(JSON.stringify(rows)).not.toContain(token);
	});

	it('관리자가 아닌 계정: 세션 없이 denied로 돌아간다', async () => {
		for (const code of ['visitor-code', 'impostor-code']) {
			const callback = await signIn(code);
			expect(callback.headers.location).toBe('http://localhost:5173/?admin=denied');
			expect(cookieFrom(callback, 'macfolio_session')).toBeUndefined();
		}
		expect(await prisma.adminSession.count()).toBe(0);
	});

	it('state가 없거나 다르면 400 (다른 사이트가 로그인을 끼워 넣지 못한다)', async () => {
		await request(app.getHttpServer())
			.get('/auth/github/callback')
			.query({ code: 'admin-code', state: 'forged' })
			.expect(400);
		await request(app.getHttpServer())
			.get('/auth/github/callback')
			.query({ code: 'admin-code', state: 'forged' })
			.set('Cookie', 'macfolio_oauth_state=other')
			.expect(400);
		expect(await prisma.adminSession.count()).toBe(0);
	});

	it('GitHub 화면에서 취소하면 cancelled로 돌아간다', async () => {
		const response = await request(app.getHttpServer())
			.get('/auth/github/callback')
			.query({ error: 'access_denied' })
			.expect(302);
		expect(response.headers.location).toBe('http://localhost:5173/?admin=cancelled');
	});

	it('로그인하지 않았거나 토큰이 틀리면 /auth/me는 401', async () => {
		await request(app.getHttpServer()).get('/auth/me').expect(401);
		await request(app.getHttpServer()).get('/auth/me').set('Cookie', 'macfolio_session=guess').expect(401);
	});

	it('로그아웃하면 세션이 지워져 같은 쿠키로도 들어올 수 없다', async () => {
		const token = valueOf(cookieFrom(await signIn('admin-code'), 'macfolio_session'))!;
		const cookie = `macfolio_session=${token}`;

		await request(app.getHttpServer()).post('/auth/logout').set('Cookie', cookie).expect(204);
		expect(await prisma.adminSession.count()).toBe(0);
		await request(app.getHttpServer()).get('/auth/me').set('Cookie', cookie).expect(401);
	});
});
