import { generateKeyPairSync } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { kstDay, shiftDay } from '../src/analytics/rules.js';
import { SearchKeywordsService } from '../src/analytics/search-keywords.service.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { GithubClient } from '../src/auth/github.client.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

process.env.DATABASE_URL ??= 'postgresql://macfolio:macfolio@localhost:5432/macfolio';

const fakeGithub: Partial<GithubClient> = {
	exchangeCode: async () => 'token',
	getUser: async () => ({ id: 68999618, login: 'hyeoniverse', avatarUrl: '' }),
};

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });

describe('Search Console 검색어 (e2e)', () => {
	let app: INestApplication;
	let prisma: PrismaService;
	let adminCookie: string;
	const server = () => app.getHttpServer();
	const today = kstDay(new Date());
	const yesterday = shiftDay(today, -1);
	/** Google에 보낸 검색어 요청의 기간과, 돌려줄 줄 */
	const asked: { startDate: string; endDate: string }[] = [];
	let rows: { keys: string[]; clicks: number; impressions: number; position: number }[] = [];
	let denied = false;

	beforeAll(async () => {
		const saved = { ...process.env };
		Object.assign(process.env, {
			GITHUB_CLIENT_ID: 'test-client-id',
			GITHUB_CLIENT_SECRET: 'test-client-secret',
			ADMIN_GITHUB_ID: '68999618',
			AUTH_RATE_LIMIT: '1000',
			GSC_SITE_URL: 'sc-domain:example.com',
			// 도메인 속성에서 이 사이트(example.com)의 페이지만 받는다
			GSC_PAGE_PREFIX: 'https://example.com/',
			GSC_CLIENT_EMAIL: 'search@project.iam.gserviceaccount.com',
			GSC_PRIVATE_KEY: (privateKey.export({ type: 'pkcs8', format: 'pem' }) as string).replace(/\n/g, '\\n'),
		});
		const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
			.overrideProvider(GithubClient)
			.useValue(fakeGithub)
			.compile();
		app = configureApp(moduleRef.createNestApplication());
		await app.init();
		process.env = saved;
		prisma = app.get(PrismaService);

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

		const real = globalThis.fetch;
		vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
			const address = String(url);
			if (address === 'https://oauth2.googleapis.com/token') return Response.json({ access_token: 'token-1' });
			if (address.startsWith('https://www.googleapis.com/webmasters/v3/sites/sc-domain%3Aexample.com/')) {
				if (denied)
					return Response.json({ error: { status: 'PERMISSION_DENIED', message: 'no access' } }, { status: 403 });
				asked.push(JSON.parse(String(init?.body)));
				return Response.json({ rows });
			}
			return real(url, init);
		});
	});

	beforeEach(async () => {
		await prisma.searchQueryStat.deleteMany();
		asked.length = 0;
		denied = false;
	});

	afterAll(async () => {
		vi.restoreAllMocks();
		await prisma?.searchQueryStat.deleteMany();
		await app?.close();
	});

	it('처음에는 16개월을 가져오고, 기간의 검색어·페이지마다 합과 노출로 가중한 순위를 노출 많은 순으로 준다', async () => {
		const twoDaysAgo = shiftDay(today, -2);
		rows = [
			{ keys: [twoDaysAgo, 'macfolio', 'https://example.com/'], clicks: 3, impressions: 10, position: 2 },
			{ keys: [yesterday, 'macfolio', 'https://example.com/'], clicks: 1, impressions: 30, position: 4 },
			{
				keys: [yesterday, '김정현 포트폴리오', 'https://example.com/memo/a'],
				clicks: 0,
				impressions: 5,
				position: 8.25,
			},
		];
		const synced = await request(server())
			.post('/analytics/search/sync')
			.set('Cookie', adminCookie)
			.query({ from: shiftDay(today, -6), to: today })
			.expect(200);
		expect(asked).toEqual([expect.objectContaining({ startDate: shiftDay(yesterday, -480), endDate: yesterday })]);
		expect(synced.body).toMatchObject({ configured: true, error: null, latestDay: yesterday });
		expect(synced.body.rows).toEqual([
			// (2 × 10 + 4 × 30) / 40 = 3.5
			{ query: 'macfolio', page: 'https://example.com/', clicks: 4, impressions: 40, position: 3.5 },
			{ query: '김정현 포트폴리오', page: 'https://example.com/memo/a', clicks: 0, impressions: 5, position: 8.3 },
		]);

		// 기간 밖은 빼고 센다
		const narrow = await request(server())
			.get('/analytics/search')
			.set('Cookie', adminCookie)
			.query({ from: yesterday, to: yesterday })
			.expect(200);
		expect(narrow.body.rows[0]).toMatchObject({ query: 'macfolio', clicks: 1, impressions: 30, position: 4 });
	});

	it('다음부터는 마지막 날의 7일 전부터 다시 받아 그 날들을 갈아 끼운다', async () => {
		const old = shiftDay(today, -20);
		await prisma.searchQueryStat.createMany({
			data: [
				{ day: old, query: '남는 것', page: 'https://example.com/', clicks: 1, impressions: 1, position: 1 },
				{ day: yesterday, query: '바뀌는 것', page: 'https://example.com/', clicks: 1, impressions: 1, position: 1 },
			],
		});
		rows = [{ keys: [yesterday, '바뀌는 것', 'https://example.com/'], clicks: 5, impressions: 9, position: 1 }];
		await app.get(SearchKeywordsService).sync();
		expect(asked).toEqual([expect.objectContaining({ startDate: shiftDay(yesterday, -7), endDate: yesterday })]);
		const stored = await prisma.searchQueryStat.findMany({ orderBy: { day: 'asc' } });
		expect(stored.map(({ day, query, clicks }) => [day, query, clicks])).toEqual([
			[old, '남는 것', 1],
			[yesterday, '바뀌는 것', 5],
		]);
	});

	it('Google이 거절하면 이유를 남기고 가져 둔 자료는 그대로 둔다', async () => {
		await prisma.searchQueryStat.create({
			data: { day: yesterday, query: 'macfolio', page: 'https://example.com/', clicks: 1, impressions: 2, position: 3 },
		});
		denied = true;
		const response = await request(server()).post('/analytics/search/sync').set('Cookie', adminCookie).expect(200);
		expect(response.body.error).toBe('Google API가 거절했습니다 (403): PERMISSION_DENIED no access');
		expect(response.body.rows).toHaveLength(1);
	});

	it('도메인 속성: 이 사이트 페이지만 달라고 묻고, 전에 가져 둔 다른 하위 도메인의 줄은 보이지 않다가 다음 가져오기에서 지운다', async () => {
		await prisma.searchQueryStat.createMany({
			data: [
				{
					day: yesterday,
					query: '블로그 글',
					page: 'https://blog.example.com/a',
					clicks: 4,
					impressions: 50,
					position: 2,
				},
				{ day: yesterday, query: 'macfolio', page: 'https://example.com/', clicks: 1, impressions: 3, position: 1 },
			],
		});
		const before = await request(server())
			.get('/analytics/search')
			.set('Cookie', adminCookie)
			.query({ from: yesterday, to: yesterday })
			.expect(200);
		expect(before.body.rows.map((row: { query: string }) => row.query)).toEqual(['macfolio']);

		rows = [];
		await app.get(SearchKeywordsService).sync();
		expect(asked[0]).toMatchObject({
			dimensionFilterGroups: [
				{ filters: [{ dimension: 'page', operator: 'includingRegex', expression: '^https://example\\.com/' }] },
			],
		});
		const stored = await prisma.searchQueryStat.findMany();
		expect(stored.map(({ page }) => page)).not.toContain('https://blog.example.com/a');
	});
});
