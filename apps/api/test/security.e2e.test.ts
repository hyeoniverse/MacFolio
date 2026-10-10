import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { GithubClient } from '../src/auth/github.client.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

process.env.DATABASE_URL ??= 'postgresql://macfolio:macfolio@localhost:5432/macfolio';

async function start(env: Record<string, string | undefined>) {
	const saved = { ...process.env };
	Object.assign(process.env, {
		GITHUB_CLIENT_ID: 'test-client-id',
		GITHUB_CLIENT_SECRET: 'test-client-secret',
		ADMIN_GITHUB_ID: '68999618',
		AUTH_RATE_LIMIT: '1000',
		COMMENT_RATE_LIMIT: '1000',
		WRITE_RATE_LIMIT: '1000',
		...env,
	});
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

describe('보안 설정: 사람 확인 켜고 끄기 (e2e)', () => {
	describe('Turnstile 키가 있으면', () => {
		let ctx: Awaited<ReturnType<typeof start>>;
		let prisma: PrismaService;
		/** Cloudflare에 물은 토큰 */
		const asked: string[] = [];
		let human = true;

		beforeAll(async () => {
			ctx = await start({
				TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
				TURNSTILE_SECRET_KEY: 'turnstile-secret',
				RESEND_API_KEY: 're_test',
				CONTACT_TO: 'owner@example.com',
				CONTACT_FROM: 'MacFolio <contact@example.com>',
			});
			prisma = ctx.app.get(PrismaService);
			await prisma.securitySetting.deleteMany();
			const real = globalThis.fetch;
			vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
				if (String(url).includes('turnstile/v0/siteverify')) {
					asked.push(JSON.parse(String(init?.body)).response);
					return Response.json({ success: human });
				}
				return real(url, init);
			});
		});
		afterEach(() => {
			asked.length = 0;
			human = true;
		});
		afterAll(async () => {
			vi.restoreAllMocks();
			await prisma?.securitySetting.deleteMany();
			await prisma?.postComment.deleteMany();
			await prisma?.guestMessage.deleteMany();
			await prisma?.messageThread.deleteMany();
			await ctx?.app.close();
		});

		it('처음에는 메일만 확인한다. 누구나 읽고, 바꾸기는 관리자만', async () => {
			const view = await request(ctx.server).get('/security').expect(200);
			expect(view.body).toEqual({
				contact: true,
				comment: false,
				message: false,
				available: true,
				turnstileSiteKey: '1x00000000000000000000AA',
				updatedAt: null,
			});
			await request(ctx.server).put('/security').send({ comment: true }).expect(401);
			await request(ctx.server).put('/security').set('Cookie', ctx.adminCookie).send({ comment: 'yes' }).expect(400);
			await request(ctx.server).put('/security').set('Cookie', ctx.adminCookie).send({}).expect(400);
		});

		it('댓글: 켜면 토큰이 없거나 사람이 아니면 400, 사람이면 쓴다. 관리자는 확인하지 않는다. 끄면 다시 그냥', async () => {
			// 꺼져 있으면 토큰 없이 쓴다 (Cloudflare에 묻지 않는다)
			await request(ctx.server).post('/posts/cra-to-vite/comments').send({ body: '그냥' }).expect(201);
			expect(asked).toEqual([]);

			const on = await request(ctx.server)
				.put('/security')
				.set('Cookie', ctx.adminCookie)
				.send({ comment: true })
				.expect(200);
			expect(on.body).toMatchObject({ contact: true, comment: true, message: false });
			expect(on.body.updatedAt).not.toBeNull();

			await request(ctx.server).post('/posts/cra-to-vite/comments').send({ body: '토큰 없음' }).expect(400);
			human = false;
			const bot = await request(ctx.server)
				.post('/posts/cra-to-vite/comments')
				.send({ body: '봇', turnstileToken: 'bad' })
				.expect(400);
			expect(bot.body.message).toBe('사람인지 확인하지 못했습니다. 다시 시도해 주세요.');
			human = true;
			await request(ctx.server)
				.post('/posts/cra-to-vite/comments')
				.send({ body: '사람', turnstileToken: 'good' })
				.expect(201);
			expect(asked).toEqual(['bad', 'good']);
			// 관리자 댓글은 확인하지 않는다
			await request(ctx.server)
				.post('/posts/cra-to-vite/comments')
				.set('Cookie', ctx.adminCookie)
				.send({ body: '작성자' })
				.expect(201);
			expect(asked).toHaveLength(2);

			await request(ctx.server).put('/security').set('Cookie', ctx.adminCookie).send({ comment: false }).expect(200);
			await request(ctx.server).post('/posts/cra-to-vite/comments').send({ body: '다시 그냥' }).expect(201);
		});

		it('메시지: 켜면 새 피드백과 답글 모두 확인한다', async () => {
			await request(ctx.server).put('/security').set('Cookie', ctx.adminCookie).send({ message: true }).expect(200);
			await request(ctx.server).post('/messages/threads').send({ body: '토큰 없음' }).expect(400);
			const thread = await request(ctx.server)
				.post('/messages/threads')
				.send({ body: '피드백', turnstileToken: 't1' })
				.expect(201);
			await request(ctx.server).post(`/messages/threads/${thread.body.thread.id}`).send({ body: '답글' }).expect(400);
			await request(ctx.server)
				.post(`/messages/threads/${thread.body.thread.id}`)
				.send({ body: '답글', turnstileToken: 't2' })
				.expect(201);
			await request(ctx.server).put('/security').set('Cookie', ctx.adminCookie).send({ message: false }).expect(200);
		});

		it('메일: 끄면 사이트 키를 주지 않고, 토큰 없이도 사람 확인을 건너뛴다', async () => {
			const before = await request(ctx.server).get('/contact').expect(200);
			expect(before.body.turnstileSiteKey).toBe('1x00000000000000000000AA');
			await request(ctx.server).put('/security').set('Cookie', ctx.adminCookie).send({ contact: false }).expect(200);
			const after = await request(ctx.server).get('/contact').expect(200);
			expect(after.body).toEqual({ enabled: true, turnstileSiteKey: null });
			const view = await request(ctx.server).get('/security').expect(200);
			expect(view.body).toMatchObject({ contact: false, comment: false, message: false });
			await request(ctx.server).put('/security').set('Cookie', ctx.adminCookie).send({ contact: true }).expect(200);
		});
	});

	describe('Turnstile 키가 없으면', () => {
		let ctx: Awaited<ReturnType<typeof start>>;
		let prisma: PrismaService;
		beforeAll(async () => {
			ctx = await start({ TURNSTILE_SITE_KEY: undefined, TURNSTILE_SECRET_KEY: undefined });
			prisma = ctx.app.get(PrismaService);
			await prisma.securitySetting.deleteMany();
		});
		afterAll(async () => {
			await prisma?.securitySetting.deleteMany();
			await prisma?.postComment.deleteMany();
			await ctx?.app.close();
		});

		it('쓸 수 없다고 알리고, 켜 두어도 확인하지 않는다', async () => {
			await request(ctx.server).put('/security').set('Cookie', ctx.adminCookie).send({ comment: true }).expect(200);
			const view = await request(ctx.server).get('/security').expect(200);
			expect(view.body).toMatchObject({ comment: true, available: false, turnstileSiteKey: null });
			await request(ctx.server).post('/posts/cra-to-vite/comments').send({ body: '그냥' }).expect(201);
		});
	});
});
