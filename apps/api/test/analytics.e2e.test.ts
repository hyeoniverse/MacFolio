import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AnalyticsService } from '../src/analytics/analytics.service.js';
import { kstDay, shiftDay } from '../src/analytics/rules.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { GithubClient } from '../src/auth/github.client.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

process.env.DATABASE_URL ??= 'postgresql://macfolio:macfolio@localhost:5432/macfolio';
process.env.GITHUB_CLIENT_ID = 'test-client-id';
process.env.GITHUB_CLIENT_SECRET = 'test-client-secret';
process.env.ADMIN_GITHUB_ID = '68999618';
process.env.AUTH_RATE_LIMIT = '1000';

const fakeGithub: Partial<GithubClient> = {
	exchangeCode: async () => 'token',
	getUser: async () => ({ id: 68999618, login: 'hyeoniverse', avatarUrl: '' }),
};

const CHROME_MAC =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

describe('트래픽 분석 (e2e)', () => {
	let app: INestApplication;
	let prisma: PrismaService;
	let adminCookie: string;
	const server = () => app.getHttpServer();

	/** sendBeacon처럼 text/plain으로 보낸다 */
	const send = (body: unknown, headers: Record<string, string> = {}) =>
		request(server())
			.post('/analytics/events')
			.set('Content-Type', 'text/plain;charset=UTF-8')
			.set('User-Agent', CHROME_MAC)
			.set(headers)
			.send(JSON.stringify(body));

	const visit = (visitId: string, extra: Record<string, unknown> = {}) => ({
		visitId,
		events: [
			{ type: 'visit', path: '/memo/hello', referrer: 'github.com', device: 'desktop', language: 'ko-KR', ...extra },
			{ type: 'app', app: 'memo' },
			{ type: 'item', app: 'memo', item: 'hello' },
			{ type: 'link', item: 'github.com/hyeoniverse' },
			{ type: 'leave', duration: 95_000 },
		],
	});

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
			.overrideProvider(GithubClient)
			.useValue(fakeGithub)
			.compile();
		app = configureApp(moduleRef.createNestApplication());
		await app.init();
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
	});

	beforeEach(async () => {
		await prisma.analyticsEvent.deleteMany();
		await prisma.dailyStat.deleteMany();
	});

	afterAll(async () => {
		await app?.close();
	});

	it('sendBeacon(text/plain)으로 받아, 나라·브라우저·하루 해시·가린 IP를 붙여 저장한다. 원래 IP와 User-Agent는 없다', async () => {
		await send(visit('v-aaaaaaaa'), { 'CF-IPCountry': 'KR' }).expect(204);
		const rows = await prisma.analyticsEvent.findMany({ orderBy: { createdAt: 'asc' } });
		expect(rows).toHaveLength(5);
		expect(rows[0]).toMatchObject({
			type: 'visit',
			visitId: 'v-aaaaaaaa',
			referrer: 'github.com',
			country: 'KR',
			browser: 'Chrome',
			os: 'macOS',
			device: 'desktop',
			maskedIp: '127.0.0.x',
			day: kstDay(new Date()),
		});
		expect(rows[0].dayHash).toMatch(/^[0-9a-f]{64}$/);
		const stored = JSON.stringify(rows);
		expect(stored).not.toContain('127.0.0.1');
		expect(stored).not.toContain('AppleWebKit');
	});

	it('로봇과 관리자 세션은 받기만 하고 저장하지 않는다. 형식이 틀리면 400', async () => {
		await send(visit('v-bbbbbbbb'), { 'User-Agent': 'Googlebot/2.1' }).expect(204);
		await send(visit('v-cccccccc'), { Cookie: adminCookie }).expect(204);
		expect(await prisma.analyticsEvent.count()).toBe(0);

		const bad = await send({
			visitId: 'v-dddddddd',
			events: [{ type: 'visit', referrer: 'https://x.com/a?b' }],
		}).expect(400);
		expect(JSON.stringify(bad.body)).toContain('referrer');
	});

	it('오늘 방문자: 누구나 본다. 같은 사람(IP·브라우저)의 두 방문은 한 명', async () => {
		await send(visit('v-eeeeeeee')).expect(204);
		await send(visit('v-ffffffff')).expect(204);
		await send(visit('v-gggggggg'), { 'User-Agent': `${CHROME_MAC} Edg/140.0` }).expect(204);
		const response = await request(server()).get('/analytics/today').expect(200);
		expect(response.body).toEqual({ day: kstDay(new Date()), visitors: 2 });
	});

	it('요약은 누구나 보지만 방문자에게는 들어온 곳의 호스트·utm이 없다. 실시간은 관리자만', async () => {
		await send(visit('v-kkkkkkkk', { utmSource: 'resume', utmCampaign: 'kakao-2026' })).expect(204);
		const today = kstDay(new Date());

		const visitor = await request(server()).get('/analytics/summary').query({ from: today, to: today }).expect(200);
		expect(visitor.body.scope).toBe('public');
		expect(visitor.body.totals.visits).toBe(1);
		expect(visitor.body.breakdown.referrerGroup).toEqual([{ key: '링크', value: 1 }]);
		expect(visitor.body.breakdown.referrer).toEqual([]);
		expect(visitor.body.breakdown.source).toEqual([]);
		expect(visitor.body.breakdown.campaign).toEqual([]);
		expect(visitor.body.breakdown.item).toEqual([{ key: 'memo/hello', value: 1 }]);
		expect(JSON.stringify(visitor.body)).not.toMatch(/github\.com"|kakao-2026|resume/);

		const admin = await request(server())
			.get('/analytics/summary')
			.set('Cookie', adminCookie)
			.query({ from: today, to: today })
			.expect(200);
		expect(admin.body.scope).toBe('admin');
		expect(admin.body.breakdown.campaign).toEqual([{ key: 'kakao-2026', value: 1 }]);
		expect(admin.body.breakdown.referrer).toEqual([{ key: 'github.com', value: 1 }]);

		await request(server()).get('/analytics/live').expect(401);
		await request(server())
			.get('/analytics/summary')
			.set('Cookie', adminCookie)
			.query({ from: '2026-01-02', to: '2026-01-01' })
			.expect(400);
	});

	it('글 조회수: 전체 기간, 한 방문에서 같은 글은 한 번. 누구나 본다', async () => {
		const today = kstDay(new Date());
		const yesterday = shiftDay(today, -1);
		await prisma.dailyStat.createMany({
			data: [
				{ day: shiftDay(today, -30), metric: 'item', key: 'memo/hello', value: 5 },
				{ day: yesterday, metric: 'item', key: 'memo/hello', value: 2 },
				{ day: yesterday, metric: 'item', key: 'memo/other', value: 1 },
				{ day: yesterday, metric: 'item', key: 'safari/macfolio', value: 9 },
				{ day: yesterday, metric: 'visits', key: '', value: 0 },
			],
		});
		// 오늘: 같은 방문에서 hello를 두 번 열어도 1
		await send({
			visitId: 'v-llllllll',
			events: [
				{ type: 'item', app: 'memo', item: 'hello' },
				{ type: 'item', app: 'memo', item: 'other' },
				{ type: 'item', app: 'memo', item: 'hello' },
			],
		}).expect(204);

		const response = await request(server()).get('/analytics/views').query({ app: 'memo' }).expect(200);
		expect(response.body).toEqual({ app: 'memo', views: { hello: 8, other: 2 } });
		await request(server()).get('/analytics/views').query({ app: 'Memo App' }).expect(400);
	});

	it('지난 날은 DailyStat으로 모으고 오늘은 이벤트에서 바로 센다. 앞 기간과 비교한다', async () => {
		const now = new Date();
		const today = kstDay(now);
		const yesterday = shiftDay(today, -1);
		const lastWeek = shiftDay(today, -7);
		// 어제와 지난주 방문 (받은 날짜를 직접 넣는다)
		const past = (day: string, visitId: string, dayHash: string) => [
			{
				type: 'visit',
				day,
				dayHash,
				visitId,
				referrer: 'linkedin.com',
				country: 'US',
				createdAt: new Date(`${day}T03:00:00Z`),
			},
			{ type: 'app', app: 'safari', day, dayHash, visitId, createdAt: new Date(`${day}T03:01:00Z`) },
		];
		await prisma.analyticsEvent.createMany({
			data: [...past(yesterday, 'v-y1', 'h1'), ...past(yesterday, 'v-y2', 'h2'), ...past(lastWeek, 'v-w1', 'h3')],
		});
		await send(visit('v-hhhhhhhh', { utmSource: 'resume', utmCampaign: 'kakao-2026' }), {
			'CF-IPCountry': 'KR',
		}).expect(204);

		const response = await request(server())
			.get('/analytics/summary')
			.set('Cookie', adminCookie)
			.query({ from: shiftDay(today, -6), to: today })
			.expect(200);
		const summary = response.body;
		expect(summary.days).toHaveLength(7);
		expect(summary.days.at(-1)).toEqual({ day: today, visits: 1, visitors: 1 });
		expect(summary.days.at(-2)).toEqual({ day: yesterday, visits: 2, visitors: 2 });
		expect(summary.totals).toEqual({ visits: 3, visitors: 3, appOpens: 3, avgDurationSec: 95 });
		// 앞의 7일: 지난주 방문 하나
		expect(summary.previous).toMatchObject({ visits: 1, visitors: 1 });
		expect(summary.breakdown.referrer).toEqual([
			{ key: 'linkedin.com', value: 2 },
			{ key: 'github.com', value: 1 },
		]);
		expect(summary.breakdown.app).toEqual([
			{ key: 'safari', value: 2 },
			{ key: 'memo', value: 1 },
		]);
		expect(summary.breakdown.item).toEqual([{ key: 'memo/hello', value: 1 }]);
		expect(summary.breakdown.campaign).toEqual([{ key: 'kakao-2026', value: 1 }]);
		expect(summary.breakdown.country).toEqual([
			{ key: 'US', value: 2 },
			{ key: 'KR', value: 1 },
		]);
		// 어제는 모아 두었다 (오늘은 아직)
		expect(await prisma.dailyStat.count({ where: { day: yesterday, metric: 'visits' } })).toBe(1);
		expect(await prisma.dailyStat.count({ where: { day: today } })).toBe(0);
	});

	it('정리: 90일이 지난 이벤트는 지우고(집계는 남는다), 7일이 지난 가린 IP는 지운다', async () => {
		const now = new Date();
		const day = (daysAgo: number) => kstDay(new Date(now.getTime() - daysAgo * 86_400_000));
		const at = (daysAgo: number) => new Date(now.getTime() - daysAgo * 86_400_000);
		await prisma.analyticsEvent.createMany({
			data: [
				{ type: 'visit', day: day(91), dayHash: 'h', visitId: 'v-old', createdAt: at(91), maskedIp: '203.0.113.x' },
				{ type: 'visit', day: day(8), dayHash: 'h', visitId: 'v-week', createdAt: at(8), maskedIp: '203.0.113.x' },
				{ type: 'visit', day: day(1), dayHash: 'h', visitId: 'v-new', createdAt: at(1), maskedIp: '203.0.113.x' },
			],
		});
		await app.get(AnalyticsService).maintain(now);

		const rows = await prisma.analyticsEvent.findMany({ orderBy: { createdAt: 'asc' } });
		expect(rows.map((row) => [row.visitId, row.maskedIp])).toEqual([
			['v-week', null],
			['v-new', '203.0.113.x'],
		]);
		expect(
			await prisma.dailyStat.findUnique({ where: { day_metric_key: { day: day(91), metric: 'visits', key: '' } } })
		).toMatchObject({
			value: 1,
		});
	});

	it('실시간: 방문마다 나라·기기·들어온 곳·가린 IP와 흐름(앱 열기 → 글 보기 → 링크)', async () => {
		await send(visit('v-iiiiiiii'), { 'CF-IPCountry': 'JP' }).expect(204);
		const response = await request(server()).get('/analytics/live').set('Cookie', adminCookie).expect(200);
		expect(response.body).toHaveLength(1);
		expect(response.body[0]).toMatchObject({
			visitId: 'v-iiiiiiii',
			country: 'JP',
			device: 'desktop',
			browser: 'Chrome',
			referrer: 'github.com',
			path: '/memo/hello',
			ip: '127.0.0.x',
		});
		expect(response.body[0].visitor).toHaveLength(4);
		expect(response.body[0].events.map((event: { type: string }) => event.type)).toEqual([
			'visit',
			'app',
			'item',
			'link',
		]);
	});

	it('IP마다 1분에 30번까지', async () => {
		const statuses: number[] = [];
		for (let index = 0; index < 32; index++)
			statuses.push((await send({ visitId: 'v-jjjjjjjj', events: [{ type: 'app', app: 'memo' }] })).status);
		expect(statuses).toContain(429);
	});
});
