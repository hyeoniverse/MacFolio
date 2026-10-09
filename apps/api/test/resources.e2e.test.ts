import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { GithubClient } from '../src/auth/github.client.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { PROC_READER, ResourcesService, type ProcReader } from '../src/resources/resources.service.js';

process.env.DATABASE_URL ??= 'postgresql://macfolio:macfolio@localhost:5432/macfolio';

const fakeGithub: Partial<GithubClient> = {
	exchangeCode: async () => 'token',
	getUser: async () => ({ id: 68999618, login: 'hyeoniverse', avatarUrl: '' }),
};

/** 가짜 /proc: 부를 때마다 CPU·네트워크 카운터가 늘어난다 */
function fakeProc(): ProcReader {
	let tick = 0;
	return async (name) => {
		if (name === 'stat') {
			tick += 1;
			// 한 번에 쓴 시간 +10, 쉰 시간 +90 → 10%
			return `cpu  ${tick * 10} 0 0 ${tick * 90} 0 0 0 0 0 0\n`;
		}
		if (name === 'meminfo') return 'MemTotal: 1000000 kB\nMemAvailable: 700000 kB\n';
		return `h1\nh2\n  eth0: ${tick * 7_500_000} 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0\n`;
	};
}

async function start(env: Record<string, string | undefined>) {
	const saved = { ...process.env };
	Object.assign(process.env, {
		GITHUB_CLIENT_ID: 'test-client-id',
		GITHUB_CLIENT_SECRET: 'test-client-secret',
		ADMIN_GITHUB_ID: '68999618',
		AUTH_RATE_LIMIT: '1000',
		...env,
	});
	for (const [key, value] of Object.entries(env)) if (value === undefined) delete process.env[key];
	const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
		.overrideProvider(GithubClient)
		.useValue(fakeGithub)
		.overrideProvider(PROC_READER)
		.useValue(fakeProc())
		.compile();
	const app = configureApp(moduleRef.createNestApplication());
	await app.init();
	process.env = saved;

	const server = app.getHttpServer();
	const begin = await request(server).get('/auth/github');
	const state = new URL(begin.headers.location).searchParams.get('state');
	const stateCookie = ([] as string[]).concat(begin.headers['set-cookie'])[0].split(';')[0];
	const callback = await request(server)
		.get('/auth/github/callback')
		.query({ code: 'x', state })
		.set('Cookie', stateCookie);
	const adminCookie = ([] as string[])
		.concat(callback.headers['set-cookie'])
		.find((cookie) => cookie.startsWith('macfolio_session='))!
		.split(';')[0];
	return { app, server, adminCookie };
}

describe('서버 자원 감시 (e2e)', () => {
	describe('꺼져 있으면 (RESOURCE_MONITOR 없음)', () => {
		let ctx: Awaited<ReturnType<typeof start>>;
		beforeAll(async () => {
			ctx = await start({ RESOURCE_MONITOR: undefined });
		});
		afterAll(() => ctx?.app.close());

		it('모드만 알려 주고, 관리자가 아니면 401', async () => {
			const response = await request(ctx.server).get('/resources').set('Cookie', ctx.adminCookie).expect(200);
			expect(response.body).toEqual({ mode: 'off' });
			await request(ctx.server).get('/resources').expect(401);
		});
	});

	describe('Always Free (RESOURCE_MONITOR=free)', () => {
		let ctx: Awaited<ReturnType<typeof start>>;
		let prisma: PrismaService;
		let service: ResourcesService;
		beforeAll(async () => {
			ctx = await start({
				RESOURCE_MONITOR: 'free',
				RESEND_API_KEY: 'test-resend',
				CONTACT_FROM: 'MacFolio <contact@example.com>',
				CONTACT_TO: 'owner@example.com',
			});
			prisma = ctx.app.get(PrismaService);
			service = ctx.app.get(ResourcesService);
			await prisma.resourceSample.deleteMany();
			await prisma.resourceAlert.deleteMany();
		});
		afterEach(() => vi.restoreAllMocks());
		afterAll(() => ctx?.app.close());

		it('두 번 읽은 차이로 CPU·메모리·네트워크를 남긴다', async () => {
			await prisma.resourceSample.deleteMany();
			const now = Date.now();
			// 시작할 때 한 번 읽었으므로 이번 읽기부터 남는다
			const sample = await service.sample(new Date(now + 60_000));
			expect(sample).toMatchObject({ cpu: 10, memory: 30 });
			expect(sample!.network).toBeGreaterThan(0);
			expect(await prisma.resourceSample.count()).toBe(1);
		});

		it('7일 동안 사용률이 낮으면 위험으로 보이고, 메일은 3일에 한 번만 보낸다', async () => {
			await prisma.resourceSample.deleteMany();
			await prisma.resourceAlert.deleteMany();
			const now = new Date();
			await prisma.resourceSample.createMany({
				data: Array.from({ length: 7 * 24 }, (_, index) => ({
					at: new Date(now.getTime() - (index + 1) * 3_600_000),
					cpu: 3,
					memory: 40,
					network: 0.2,
				})),
			});
			const mails: unknown[] = [];
			const real = globalThis.fetch;
			vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
				if (String(url).startsWith('https://api.resend.com')) {
					mails.push(JSON.parse(String(init?.body)));
					return new Response('{}', { status: 200 });
				}
				return real(url, init);
			});

			const status = await request(ctx.server).get('/resources').set('Cookie', ctx.adminCookie).expect(200);
			expect(status.body).toMatchObject({ mode: 'free', shape: 'VM.Standard.E2.1.Micro', risk: { level: 'danger' } });
			expect(status.body.series.length).toBeGreaterThan(100);
			expect(status.body.alert).toEqual({ mailReady: true, lastSentAt: null });

			await service.maintain(now);
			expect(mails).toHaveLength(1);
			expect(mails[0]).toMatchObject({ to: ['owner@example.com'], subject: expect.stringContaining('유휴 회수') });
			// 3일 안에는 다시 보내지 않는다
			await service.maintain(new Date(now.getTime() + 60 * 60_000));
			expect(mails).toHaveLength(1);
			// 3일이 지나도 여전히 위험하면 다시 보낸다 (남은 4일치로도 기준 아래)
			await service.maintain(new Date(now.getTime() + 3 * 24 * 3_600_000 + 1));
			expect(mails).toHaveLength(2);

			const after = await request(ctx.server).get('/resources').set('Cookie', ctx.adminCookie).expect(200);
			expect(after.body.alert.lastSentAt).not.toBeNull();
		});

		it('사용률이 넉넉하면 알리지 않는다', async () => {
			await prisma.resourceSample.deleteMany();
			await prisma.resourceAlert.deleteMany();
			const now = new Date();
			await prisma.resourceSample.createMany({
				data: Array.from({ length: 48 }, (_, index) => ({
					at: new Date(now.getTime() - (index + 1) * 3_600_000),
					cpu: 60,
					memory: 40,
					network: 0.2,
				})),
			});
			const fetchSpy = vi.spyOn(globalThis, 'fetch');
			await service.maintain(now);
			expect(fetchSpy).not.toHaveBeenCalled();
			expect(await prisma.resourceAlert.count()).toBe(0);
		});

		it('14일이 지난 표본은 지운다', async () => {
			await prisma.resourceSample.deleteMany();
			const now = new Date();
			await prisma.resourceSample.create({
				data: { at: new Date(now.getTime() - 15 * 24 * 3_600_000), cpu: 1, memory: 1, network: 0 },
			});
			await service.maintain(now);
			expect(await prisma.resourceSample.count()).toBe(0);
		});
	});

	describe('종량제 (RESOURCE_MONITOR=payg)', () => {
		// Oracle 문서의 시험용 개인 키 (요청 서명만 확인한다)
		const PRIVATE_KEY = `-----BEGIN RSA PRIVATE KEY-----
MIICXgIBAAKBgQDCFENGw33yGihy92pDjZQhl0C36rPJj+CvfSC8+q28hxA161QF
NUd13wuCTUcq0Qd2qsBe/2hFyc2DCJJg0h1L78+6Z4UMR7EOcpfdUE9Hf3m/hs+F
UR45uBJeDK1HSFHD8bHKD6kv8FPGfJTotc+2xjJwoYi+1hqp1fIekaxsyQIDAQAB
AoGBAJR8ZkCUvx5kzv+utdl7T5MnordT1TvoXXJGXK7ZZ+UuvMNUCdN2QPc4sBiA
QWvLw1cSKt5DsKZ8UETpYPy8pPYnnDEz2dDYiaew9+xEpubyeW2oH4Zx71wqBtOK
kqwrXa/pzdpiucRRjk6vE6YY7EBBs/g7uanVpGibOVAEsqH1AkEA7DkjVH28WDUg
f1nqvfn2Kj6CT7nIcE3jGJsZZ7zlZmBmHFDONMLUrXR/Zm3pR5m0tCmBqa5RK95u
412jt1dPIwJBANJT3v8pnkth48bQo/fKel6uEYyboRtA5/uHuHkZ6FQF7OUkGogc
mSJluOdc5t6hI1VsLn0QZEjQZMEOWr+wKSMCQQCC4kXJEsHAve77oP6HtG/IiEn7
kpyUXRNvFsDE0czpJJBvL/aRFUJxuRK91jhjC68sA7NsKMGg5OXb5I5Jj36xAkEA
gIT7aFOYBFwGgQAQkWNKLvySgKbAZRTeLBacpHMuQdl1DfdntvAyqpAZ0lY0RKmW
G6aFKaqQfOXKCyWoUiVknQJAXrlgySFci/2ueKlIE1QqIiLSZ8V8OlpFLRnb1pzI
7U1yQXnTAEFYM560yJlzUpOb1V4cScGd365tiSMvxLOvTA==
-----END RSA PRIVATE KEY-----`;
		let ctx: Awaited<ReturnType<typeof start>>;
		let prisma: PrismaService;
		let service: ResourcesService;
		let spend = 0.5;
		const mails: { subject: string }[] = [];
		const oracleCalls: { url: string; authorization: string }[] = [];

		beforeAll(async () => {
			ctx = await start({
				RESOURCE_MONITOR: 'payg',
				RESEND_API_KEY: 'test-resend',
				CONTACT_FROM: 'MacFolio <contact@example.com>',
				CONTACT_TO: 'owner@example.com',
				OCI_TENANCY_OCID: 'ocid1.tenancy.oc1..aaaa',
				OCI_USER_OCID: 'ocid1.user.oc1..bbbb',
				OCI_FINGERPRINT: '20:3b:97:13',
				OCI_PRIVATE_KEY: PRIVATE_KEY.replace(/\n/g, '\\n'),
				OCI_REGION: 'ap-chuncheon-1',
			});
			prisma = ctx.app.get(PrismaService);
			service = ctx.app.get(ResourcesService);
			await prisma.resourceAlert.deleteMany();
		});
		beforeAll(() => {
			const real = globalThis.fetch;
			vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
				const address = String(url);
				if (address.startsWith('https://api.resend.com')) {
					mails.push(JSON.parse(String(init?.body)));
					return new Response('{}', { status: 200 });
				}
				if (address.includes('.oci.oraclecloud.com')) {
					oracleCalls.push({ url: address, authorization: (init?.headers as Record<string, string>).authorization });
					if (address.includes('/budgets'))
						return Response.json([
							{
								displayName: '월 1달러',
								amount: 1,
								actualSpend: spend,
								forecastedSpend: 0.9,
								resetPeriod: 'MONTHLY',
								timeSpendComputed: null,
							},
						]);
					return Response.json({ items: [{ computedAmount: spend, currency: 'USD' }] });
				}
				return real(url, init);
			});
		});
		afterAll(async () => {
			vi.restoreAllMocks();
			await ctx?.app.close();
		});

		it('요금과 예산을 서명한 요청으로 읽어 보여 준다 (회수 위험은 없다)', async () => {
			const status = await request(ctx.server).get('/resources').set('Cookie', ctx.adminCookie).expect(200);
			expect(status.body.mode).toBe('payg');
			expect(status.body.risk).toBeUndefined();
			expect(status.body.billing).toMatchObject({
				configured: true,
				error: null,
				data: {
					monthToDate: 0.5,
					currency: 'USD',
					budgets: [{ displayName: '월 1달러', amount: 1, actualSpend: 0.5 }],
				},
			});
			expect(oracleCalls[0].authorization).toMatch(
				/^Signature version="1",keyId="ocid1.tenancy.oc1..aaaa\/ocid1.user.oc1..bbbb\/20:3b:97:13",algorithm="rsa-sha256"/
			);
		});

		it('예산의 80%와 100%를 넘으면 달마다 한 번씩 알린다', async () => {
			const now = new Date();
			spend = 0.5;
			await service.maintain(now);
			expect(mails).toHaveLength(0);

			spend = 0.85;
			await service.maintain(now);
			await service.maintain(now);
			expect(mails.map((mail) => mail.subject)).toEqual([expect.stringContaining('85%')]);

			spend = 1.2;
			await service.maintain(now);
			expect(mails).toHaveLength(2);
			expect(mails[1].subject).toContain('한도를 넘었습니다');
			await service.maintain(now);
			expect(mails).toHaveLength(2);
		});
	});
});
