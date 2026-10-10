import type { INestApplication } from '@nestjs/common';
import { RequestMethod } from '@nestjs/common';
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { DiscoveryModule, DiscoveryService, MetadataScanner } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { AdminGuard } from '../src/auth/admin.guard.js';
import { GithubClient } from '../src/auth/github.client.js';
import { RATE_LIMIT_KEY, RATE_LIMIT_NAMES, type RateLimitName } from '../src/common/rate-limit.js';

// 모든 API 경로의 목록과 각 경로가 누구의 것인지(관리자·방문자·공개)를 한 표로 고정한다.
// 새 경로를 더하거나 가드를 바꾸면 이 표도 같이 고쳐야 시험이 통과한다. 그래서 가드를 빠뜨린 관리자 경로가 조용히 들어오지 못한다.
// 더해서, 관리자 경로는 로그인 없이 401, 몸통을 받는 경로는 엉뚱한 값에 400으로 답하는지(500이나 성공이 아닌지) 본다.
// 쓰기 경로(GET이 아닌 것)는 모두 요청 제한(@RateLimit)이 있어야 한다 (common/rate-limit.ts).

process.env.DATABASE_URL ??= 'postgresql://macfolio:macfolio@localhost:5432/macfolio';
process.env.GITHUB_CLIENT_ID = 'test-client-id';
process.env.GITHUB_CLIENT_SECRET = 'test-client-secret';
process.env.ADMIN_GITHUB_ID = '68999618';
process.env.AUTH_RATE_LIMIT = '1000';
process.env.COMMENT_RATE_LIMIT = '1000';
process.env.WRITE_RATE_LIMIT = '1000';
process.env.UPLOAD_RATE_LIMIT = '1000';
process.env.DEMO_RATE_LIMIT = '1000';
process.env.EVENTS_RATE_LIMIT = '1000';
process.env.LIKE_RATE_LIMIT = '1000';
// 메일 발송이 꺼져 있으면 /contact는 검사 전에 503으로 끝난다. 검사까지 가도록 켠다 (실제로 보내지는 않는다: 몸통이 거절된다)
process.env.RESEND_API_KEY = 're_test';
process.env.CONTACT_TO = 'admin@example.com';
process.env.CONTACT_FROM = 'MacFolio <noreply@example.com>';

const fakeGithub: Partial<GithubClient> = {
	exchangeCode: async () => 'token',
	getUser: async () => ({ id: 68999618, login: 'hyeoniverse', avatarUrl: '' }),
};

/**
 * admin: AdminGuard가 세션을 확인한다 · visitor: 방문자 쿠키로 자기 것만 다룬다 (서비스 안에서) · public: 누구나
 * 값이 'admin'인 경로에만 AdminGuard가 있어야 하고, 나머지에는 없어야 한다
 */
const ACCESS: Record<string, 'admin' | 'visitor' | 'public'> = {
	'GET /health': 'public',
	'GET /visitor': 'public',

	'GET /auth/github': 'public',
	'GET /auth/github/callback': 'public',
	'GET /auth/me': 'admin',
	'POST /auth/logout': 'public',

	'GET /posts': 'public',
	'GET /posts/admin': 'admin',
	'POST /posts': 'admin',
	'PUT /posts/:slug/draft': 'admin',
	'DELETE /posts/:slug/draft': 'admin',
	'POST /posts/:slug/publish': 'admin',
	'GET /posts/:slug/revisions': 'admin',
	'GET /posts/:slug/revisions/:id': 'admin',
	'POST /posts/:slug/restore': 'admin',
	'DELETE /posts/:slug/permanent': 'admin',
	'DELETE /posts/:slug': 'admin',

	'GET /posts/stats': 'public',
	'GET /posts/:slug/likes': 'public',
	'PUT /posts/:slug/like': 'visitor',
	'DELETE /posts/:slug/like': 'visitor',
	'PUT /comments/:id/like': 'visitor',
	'DELETE /comments/:id/like': 'visitor',

	'GET /posts/:slug/comments': 'public',
	'POST /posts/:slug/comments': 'visitor',
	'DELETE /comments/:id': 'visitor',

	'GET /memo/organization': 'public',
	'PUT /memo/organization': 'admin',

	'GET /messages/threads': 'public',
	'GET /messages/threads/:id': 'public',
	'POST /messages/threads': 'visitor',
	'POST /messages/threads/:id': 'visitor',
	'DELETE /messages/:id': 'visitor',

	'GET /files': 'admin',
	'POST /files': 'admin',
	'GET /files/:id': 'public',
	'DELETE /files/:id': 'admin',

	'GET /images/providers': 'admin',
	'GET /images/search': 'admin',
	'POST /images/unsplash/:id/download': 'admin',

	'GET /wallpapers': 'public',
	'POST /wallpapers': 'admin',
	'PATCH /wallpapers/:id': 'admin',
	'DELETE /wallpapers/:id': 'admin',

	'GET /github/profile': 'public',
	'GET /github/activity': 'public',
	'GET /github/candidates': 'admin',
	'GET /github/repos/:owner/:name': 'admin',
	'PUT /github/showcase': 'admin',

	'GET /photos/captions': 'public',
	'PUT /photos/captions': 'admin',

	'GET /contact': 'public',
	'POST /contact': 'visitor',
	'GET /contact/mine': 'visitor',
	'GET /contact/inbox': 'admin',
	'POST /contact/:id/reply': 'admin',

	'GET /summary': 'public',
	'POST /summary': 'public',
	'GET /translate': 'public',
	'POST /translate': 'public',
	'GET /speech': 'public',
	'POST /speech': 'public',
	'GET /cover': 'public',
	'POST /cover': 'public',

	'POST /analytics/events': 'public',
	'GET /analytics/today': 'public',
	'GET /analytics/summary': 'public',
	'GET /analytics/views': 'public',
	'GET /analytics/live': 'admin',

	'GET /resources': 'admin',

	'GET /security': 'public',
	'PUT /security': 'admin',
};

/** 어떤 경로든 타입이 틀린 몸통. 각 경로의 검사기가 거절해야 한다 */
const JUNK_BODY = {
	title: 1,
	body: 1,
	text: 1,
	name: 1,
	repos: 'x',
	folders: 'x',
	posts: 'x',
	captions: 'x',
	events: 'x',
	visitId: 1,
	texts: 1,
	email: 1,
	subject: 1,
};

/**
 * 경로의 :param을 시험용 값으로. 모양이 맞는 값을 넣어야 몸통 검사까지 간다
 * (배경화면 id는 16자, 버전 id는 숫자. 모양이 틀린 id는 404로 먼저 끝난다)
 */
const fill = (path: string) =>
	path.replace(/:[a-z]+/gi, (param) => {
		if (path.startsWith('/wallpapers')) return 'xxxxxxxxxxxxxxxx';
		if (param === ':id' && path.includes('revisions')) return '1';
		return 'x';
	});

interface Route {
	key: string;
	method: 'get' | 'post' | 'put' | 'patch' | 'delete';
	path: string;
	guards: string[];
	/** 컨트롤러 클래스에 건 가드 (모든 경로에 먼저 돈다) */
	classGuards: string[];
	/** @RateLimit로 건 제한 이름 (없으면 null) */
	limit: RateLimitName | null;
}

describe('API 경로 목록과 권한 (e2e)', () => {
	let app: INestApplication;
	let routes: Route[];
	let adminCookie: string;
	const server = () => app.getHttpServer();

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({ imports: [AppModule, DiscoveryModule] })
			.overrideProvider(GithubClient)
			.useValue(fakeGithub)
			.compile();
		app = configureApp(moduleRef.createNestApplication());
		await app.init();

		// 컨트롤러의 데코레이터 메타데이터에서 경로와 가드를 읽는다 (NestJS가 라우터를 만들 때 쓰는 것과 같은 정보)
		const discovery = moduleRef.get(DiscoveryService);
		const scanner = moduleRef.get(MetadataScanner);
		routes = [];
		for (const { metatype, instance } of discovery.getControllers()) {
			if (!metatype || !instance) continue;
			const prefix = Reflect.getMetadata(PATH_METADATA, metatype) as string;
			const classGuards = (Reflect.getMetadata(GUARDS_METADATA, metatype) ?? []) as { name: string }[];
			const proto = Object.getPrototypeOf(instance) as Record<string, unknown>;
			for (const name of scanner.getAllMethodNames(proto)) {
				const handler = proto[name] as object;
				const path = Reflect.getMetadata(PATH_METADATA, handler) as string | undefined;
				if (path === undefined) continue;
				const method = RequestMethod[Reflect.getMetadata(METHOD_METADATA, handler) as number];
				const guards = [
					...classGuards,
					...((Reflect.getMetadata(GUARDS_METADATA, handler) ?? []) as { name: string }[]),
				];
				const full = `/${[prefix, path].filter((part) => part && part !== '/').join('/')}`.replace(/\/+/g, '/');
				routes.push({
					key: `${method} ${full}`,
					method: method.toLowerCase() as Route['method'],
					path: full,
					guards: guards.map((guard) => guard.name),
					classGuards: classGuards.map((guard) => guard.name),
					limit: (Reflect.getMetadata(RATE_LIMIT_KEY, handler) as RateLimitName | undefined) ?? null,
				});
			}
		}

		const start = await request(server()).get('/auth/github');
		const state = new URL(start.headers.location).searchParams.get('state');
		const stateCookie = ([] as string[]).concat(start.headers['set-cookie'])[0].split(';')[0];
		const callback = await request(server())
			.get('/auth/github/callback')
			.query({ code: 'x', state })
			.set('Cookie', stateCookie);
		adminCookie = ([] as string[])
			.concat(callback.headers['set-cookie'])
			.find((cookie) => cookie.startsWith('macfolio_session='))!
			.split(';')[0];
	});

	afterAll(async () => {
		await app?.close();
	});

	it('실제 경로 목록이 표와 같다 (새 경로는 표에 더해야 한다)', () => {
		expect(routes.map((route) => route.key).sort()).toEqual(Object.keys(ACCESS).sort());
	});

	it("표에서 'admin'인 경로에만 AdminGuard가 있다", () => {
		const guarded = routes.filter((route) => route.guards.includes(AdminGuard.name)).map((route) => route.key);
		const expected = Object.entries(ACCESS)
			.filter(([, access]) => access === 'admin')
			.map(([key]) => key);
		expect(guarded.sort()).toEqual(expected.sort());
	});

	it('쓰기 경로는 모두 요청 제한이 있고, 읽기 경로는 로그인 시작·콜백에만 있다', () => {
		const limited = routes.filter((route) => route.limit !== null);
		// 제한이 있는 경로에만 ThrottlerGuard가 있다 (@RateLimit가 둘을 같이 건다)
		expect(
			routes
				.filter((route) => route.guards.includes('ThrottlerGuard'))
				.map((route) => route.key)
				.sort()
		).toEqual(limited.map((route) => route.key).sort());
		const unlimitedWrites = routes.filter((route) => route.method !== 'get' && route.limit === null);
		expect(unlimitedWrites.map((route) => route.key)).toEqual([]);
		const limitedReads = routes.filter((route) => route.method === 'get' && route.limit !== null);
		expect(limitedReads.map((route) => `${route.key} ${route.limit}`).sort()).toEqual([
			'GET /auth/github login',
			'GET /auth/github/callback login',
		]);
		// 관리자 경로는 제한이 로그인 확인보다 먼저 돈다 (로그인하지 않은 요청도 횟수에 들고, 세션 조회 전에 막는다).
		// 클래스에 AdminGuard를 건 컨트롤러(images)는 클래스 가드가 늘 먼저라 뺀다
		const wrongOrder = limited
			.filter((route) => route.guards.includes(AdminGuard.name) && !route.classGuards.includes(AdminGuard.name))
			.filter((route) => route.guards.indexOf('ThrottlerGuard') > route.guards.indexOf(AdminGuard.name));
		expect(wrongOrder.map((route) => route.key)).toEqual([]);
		// 이름 여섯 개가 모두 어딘가에 쓰인다 (안 쓰는 이름이 남지 않게)
		expect([...new Set(limited.map((route) => route.limit))].sort()).toEqual([...RATE_LIMIT_NAMES].sort());
	});

	it('관리자 경로는 로그인 없이 401 (파라미터·몸통을 보기 전에 막는다)', async () => {
		for (const route of routes) {
			if (ACCESS[route.key] !== 'admin') continue;
			const response = await request(server())[route.method](fill(route.path)).send(JUNK_BODY);
			expect(response.status, route.key).toBe(401);
			expect(response.body, route.key).toMatchObject({ statusCode: 401, error: 'Unauthorized' });
		}
	});

	it('몸통을 받는 경로는 타입이 틀린 값에 400으로 답한다 (500이나 성공이 아니다)', async () => {
		// 몸통 없이 동작하는 쓰기 경로와, 파일 업로드가 아닌 몸통이 필요 없는 경로는 뺀다
		const noBody = new Set([
			'POST /auth/logout',
			'POST /posts/:slug/restore',
			'DELETE /posts/:slug/permanent',
			'DELETE /posts/:slug',
			'DELETE /posts/:slug/draft',
			'DELETE /comments/:id',
			'DELETE /messages/:id',
			'DELETE /files/:id',
			'DELETE /wallpapers/:id',
			'POST /images/unsplash/:id/download',
			'PUT /posts/:slug/like',
			'DELETE /posts/:slug/like',
			'PUT /comments/:id/like',
			'DELETE /comments/:id/like',
		]);
		for (const route of routes) {
			if (route.method === 'get' || noBody.has(route.key)) continue;
			const send = request(server())[route.method](fill(route.path));
			const response = await send.set('Cookie', ACCESS[route.key] === 'admin' ? adminCookie : '').send(JUNK_BODY);
			expect(response.status, `${route.key}: ${JSON.stringify(response.body)}`).toBe(400);
			expect(response.body, route.key).toMatchObject({ statusCode: 400, error: 'Bad Request' });
		}
	});

	it('쿼리·파라미터가 틀리면 400', async () => {
		await request(server()).get('/analytics/summary').query({ from: '2026-12-31', to: '2026-01-01' }).expect(400);
		await request(server()).get('/analytics/views').expect(400);
		await request(server()).get('/posts/x/revisions/abc').set('Cookie', adminCookie).expect(400);
		await request(server()).get('/images/search').set('Cookie', adminCookie).query({ q: '' }).expect(400);
		await request(server()).post('/images/unsplash/!/download').set('Cookie', adminCookie).expect(400);
	});
});
