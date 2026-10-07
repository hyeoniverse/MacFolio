import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';

process.env.DATABASE_URL ??= 'postgresql://macfolio:macfolio@localhost:5432/macfolio';

const mail = { name: '민수', email: 'minsu@example.com', subject: '포트폴리오 잘 봤습니다', body: '안녕하세요' };

async function start(env: Record<string, string | undefined>) {
	const saved = { ...process.env };
	Object.assign(process.env, env);
	for (const [key, value] of Object.entries(env)) if (value === undefined) delete process.env[key];
	const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
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
			expect(response.body).toEqual({ status: 'sent' });

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
});
