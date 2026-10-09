import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { GithubClient } from '../src/auth/github.client.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

process.env.DATABASE_URL ??= 'postgresql://macfolio:macfolio@localhost:5432/macfolio';

const mail = { name: '민수', email: 'minsu@example.com', subject: '포트폴리오 잘 봤습니다', body: '안녕하세요' };

async function start(env: Record<string, string | undefined>) {
	const saved = { ...process.env };
	Object.assign(process.env, env);
	for (const [key, value] of Object.entries(env)) if (value === undefined) delete process.env[key];
	const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
		.overrideProvider(GithubClient)
		.useValue({
			exchangeCode: async () => 'token',
			getUser: async () => ({ id: 68999618, login: 'hyeoniverse', avatarUrl: '' }),
		})
		.compile();
	const app = configureApp(moduleRef.createNestApplication());
	await app.init();
	process.env = saved;
	return app;
}

describe('연락 메일 (e2e)', () => {
	describe('메일 설정이 없으면', () => {
		let app: INestApplication;
		beforeAll(async () => {
			app = await start({ RESEND_API_KEY: undefined, CONTACT_TO: undefined, CONTACT_FROM: undefined });
		});
		afterAll(async () => app?.close());

		it('꺼져 있다고 알리고 503 (사이트는 메일 앱 열기로 대신한다)', async () => {
			const status = await request(app.getHttpServer()).get('/contact').expect(200);
			expect(status.body).toEqual({ enabled: false, turnstileSiteKey: null });
			await request(app.getHttpServer()).post('/contact').send(mail).expect(503);
		});
	});

	describe('Resend와 Turnstile을 설정하면', () => {
		let app: INestApplication;
		const calls: { url: string; init: RequestInit }[] = [];
		let resendStatus = 200;
		let human = true;

		beforeAll(async () => {
			app = await start({
				RESEND_API_KEY: 're_test',
				CONTACT_TO: 'owner@example.com',
				CONTACT_FROM: 'MacFolio <contact@example.com>',
				TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
				TURNSTILE_SECRET_KEY: 'turnstile-secret',
				CONTACT_PER_IP_PER_DAY: '2',
				GITHUB_CLIENT_ID: 'test-client-id',
				GITHUB_CLIENT_SECRET: 'test-client-secret',
				ADMIN_GITHUB_ID: '68999618',
				AUTH_RATE_LIMIT: '1000',
				COMMENT_RATE_LIMIT: '1000',
			});
			// 바깥 호출(Resend, Turnstile)만 바꿔 끼운다
			const real = globalThis.fetch;
			vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
				const href = String(url);
				if (href.startsWith('https://api.resend.com') || href.startsWith('https://challenges.cloudflare.com')) {
					calls.push({ url: href, init: init ?? {} });
					if (href.includes('turnstile')) return Response.json({ success: human });
					return new Response('{}', { status: resendStatus });
				}
				return real(url, init);
			});
		});
		afterEach(() => {
			calls.length = 0;
			resendStatus = 200;
			human = true;
		});
		afterAll(async () => {
			vi.restoreAllMocks();
			await app?.close();
		});

		it('사이트에 켜져 있다고 Turnstile 사이트 키와 함께 알린다', async () => {
			const status = await request(app.getHttpServer()).get('/contact').expect(200);
			expect(status.body).toEqual({ enabled: true, turnstileSiteKey: '1x00000000000000000000AA' });
		});

		it('사람 확인을 거쳐 주인에게 보내고, 보낸 사람은 Reply-To로', async () => {
			const response = await request(app.getHttpServer())
				.post('/contact')
				.send({ ...mail, turnstileToken: 'token' })
				.expect(200);
			expect(response.body).toMatchObject({
				status: 'sent',
				mail: { name: '민수', subject: '포트폴리오 잘 봤습니다', replies: [] },
			});

			const [verify, send] = calls;
			expect(verify.url).toContain('turnstile/v0/siteverify');
			expect(JSON.parse(String(verify.init.body))).toMatchObject({ secret: 'turnstile-secret', response: 'token' });
			expect(send.url).toBe('https://api.resend.com/emails');
			expect((send.init.headers as Record<string, string>).Authorization).toBe('Bearer re_test');
			expect(JSON.parse(String(send.init.body))).toEqual({
				from: 'MacFolio <contact@example.com>',
				to: ['owner@example.com'],
				reply_to: 'minsu@example.com',
				subject: '[MacFolio] 포트폴리오 잘 봤습니다',
				text: expect.stringContaining('보낸 사람: 민수 <minsu@example.com>'),
			});
		});

		it('사람 확인이 없거나 실패하면 보내지 않는다. 입력이 틀리면 400', async () => {
			await request(app.getHttpServer()).post('/contact').send(mail).expect(400);
			human = false;
			await request(app.getHttpServer())
				.post('/contact')
				.send({ ...mail, turnstileToken: 'bot' })
				.expect(400);
			await request(app.getHttpServer())
				.post('/contact')
				.send({ ...mail, subject: '제목\nBcc: x@example.com', turnstileToken: 'token' })
				.expect(400);
			expect(calls.filter((call) => call.url.includes('resend'))).toHaveLength(0);
		});

		it('Resend가 받지 않으면 502이고 횟수를 돌려준다. IP마다 하루 상한(여기서는 2번)', async () => {
			// 앞 시험에서 이미 한 번 보냈다: 남은 횟수 1
			resendStatus = 500;
			await request(app.getHttpServer())
				.post('/contact')
				.send({ ...mail, turnstileToken: 'token' })
				.expect(502);
			resendStatus = 200;
			await request(app.getHttpServer())
				.post('/contact')
				.send({ ...mail, turnstileToken: 'token' })
				.expect(200);
			await request(app.getHttpServer())
				.post('/contact')
				.send({ ...mail, turnstileToken: 'token' })
				.expect(429);
		});
	});

	describe('보낸 편지함과 관리자 받은 편지함', () => {
		let app: INestApplication;
		let prisma: PrismaService;
		let adminCookie: string;
		const sent: { to: string[]; reply_to: string; subject: string; text: string }[] = [];
		const server = () => app.getHttpServer();
		const cookieOf = (response: request.Response, name: string) =>
			([] as string[])
				.concat(response.headers['set-cookie'] ?? [])
				.find((cookie) => cookie.startsWith(`${name}=`))
				?.split(';')[0];

		beforeAll(async () => {
			app = await start({
				RESEND_API_KEY: 're_test',
				CONTACT_TO: 'owner@example.com',
				CONTACT_FROM: 'MacFolio <contact@example.com>',
				TURNSTILE_SITE_KEY: undefined,
				TURNSTILE_SECRET_KEY: undefined,
				CONTACT_PER_IP_PER_DAY: '100',
				GITHUB_CLIENT_ID: 'test-client-id',
				GITHUB_CLIENT_SECRET: 'test-client-secret',
				ADMIN_GITHUB_ID: '68999618',
				AUTH_RATE_LIMIT: '1000',
				COMMENT_RATE_LIMIT: '1000',
			});
			prisma = app.get(PrismaService);
			await prisma.contactMail.deleteMany();
			const real = globalThis.fetch;
			vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
				if (String(url).startsWith('https://api.resend.com')) {
					sent.push(JSON.parse(String(init?.body)));
					return new Response('{}', { status: 200 });
				}
				return real(url, init);
			});
			const begin = await request(server()).get('/auth/github');
			const state = new URL(begin.headers.location).searchParams.get('state');
			const callback = await request(server())
				.get('/auth/github/callback')
				.query({ code: 'x', state })
				.set('Cookie', cookieOf(begin, 'macfolio_oauth_state')!);
			adminCookie = cookieOf(callback, 'macfolio_session')!;
		});
		afterAll(async () => {
			vi.restoreAllMocks();
			await prisma?.contactMail.deleteMany();
			await app?.close();
		});

		it('보낸 메일은 보낸 브라우저의 보낸 편지함에만 보인다 (다른 브라우저·쿠키 없음에는 없다)', async () => {
			const first = await request(server()).post('/contact').send(mail).expect(200);
			const visitorA = cookieOf(first, 'macfolio_visitor')!;
			expect(visitorA).toBeDefined();
			await request(server())
				.post('/contact')
				.set('Cookie', visitorA)
				.send({ ...mail, subject: '두 번째 메일' })
				.expect(200);
			const other = await request(server())
				.post('/contact')
				.send({ ...mail, name: '지수', email: 'jisu@example.com', subject: '다른 사람' })
				.expect(200);
			const visitorB = cookieOf(other, 'macfolio_visitor')!;

			const mineA = await request(server()).get('/contact/mine').set('Cookie', visitorA).expect(200);
			expect(mineA.body.map((entry: { subject: string }) => entry.subject)).toEqual([
				'두 번째 메일',
				'포트폴리오 잘 봤습니다',
			]);
			const mineB = await request(server()).get('/contact/mine').set('Cookie', visitorB).expect(200);
			expect(mineB.body.map((entry: { subject: string }) => entry.subject)).toEqual(['다른 사람']);
			const nobody = await request(server()).get('/contact/mine').expect(200);
			expect(nobody.body).toEqual([]);
			// 방문자 HMAC은 내보내지 않는다
			expect(JSON.stringify(mineA.body)).not.toContain('visitorHash');
		});

		it('받은 편지함과 답장은 관리자만', async () => {
			await request(server()).get('/contact/inbox').expect(401);
			const any = await prisma.contactMail.findFirstOrThrow();
			await request(server()).post(`/contact/${any.id}/reply`).send({ body: '안녕' }).expect(401);
			const inbox = await request(server()).get('/contact/inbox').set('Cookie', adminCookie).expect(200);
			expect(inbox.body.map((entry: { subject: string }) => entry.subject)).toEqual([
				'다른 사람',
				'두 번째 메일',
				'포트폴리오 잘 봤습니다',
			]);
		});

		it('관리자가 답장하면 방문자의 주소로 가고(Reply-To는 주인), 그 방문자의 보낸 편지함에 답장이 붙는다', async () => {
			const target = await prisma.contactMail.findFirstOrThrow({ where: { subject: '다른 사람' } });
			sent.length = 0;
			const replied = await request(server())
				.post(`/contact/${target.id}/reply`)
				.set('Cookie', adminCookie)
				.send({ body: '연락 주셔서 감사합니다!' })
				.expect(200);
			expect(replied.body.replies).toEqual([expect.objectContaining({ body: '연락 주셔서 감사합니다!' })]);
			expect(sent).toEqual([
				expect.objectContaining({
					to: ['jisu@example.com'],
					reply_to: 'owner@example.com',
					subject: 'Re: [MacFolio] 다른 사람',
				}),
			]);

			// 답장은 보낸 사람(지수)의 보낸 편지함에 붙는다
			const mine = await prisma.contactMail.findUniqueOrThrow({ where: { id: target.id }, include: { replies: true } });
			expect(mine.replies.map((reply) => reply.body)).toEqual(['연락 주셔서 감사합니다!']);
			await request(server()).post('/contact/nope/reply').set('Cookie', adminCookie).send({ body: '안녕' }).expect(404);
			await request(server())
				.post(`/contact/${target.id}/reply`)
				.set('Cookie', adminCookie)
				.send({ body: ' ' })
				.expect(400);
		});
	});
});
