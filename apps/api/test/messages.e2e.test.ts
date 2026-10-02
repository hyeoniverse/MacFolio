import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { GithubClient } from '../src/auth/github.client.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

process.env.DATABASE_URL ??= 'postgresql://macfolio:macfolio@localhost:5432/macfolio';
process.env.GITHUB_CLIENT_ID = 'test-client-id';
process.env.GITHUB_CLIENT_SECRET = 'test-client-secret';
process.env.ADMIN_GITHUB_ID = '68999618';
process.env.AUTH_RATE_LIMIT = '1000';
process.env.COMMENT_RATE_LIMIT = '1000';

const fakeGithub: Partial<GithubClient> = {
	exchangeCode: async () => 'token',
	getUser: async () => ({ id: 68999618, login: 'hyeoniverse', avatarUrl: '' }),
};

describe('메시지 (e2e)', () => {
	let app: INestApplication;
	let prisma: PrismaService;
	let adminCookie: string;
	const server = () => app.getHttpServer();

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
		await prisma.guestMessage.deleteMany();
		await prisma.messageThread.deleteMany();
	});

	afterAll(async () => {
		await app?.close();
	});

	const visitorCookie = (response: request.Response) =>
		([] as string[])
			.concat(response.headers['set-cookie'] ?? [])
			.find((cookie) => cookie.startsWith('macfolio_visitor='))
			?.split(';')[0];

	it('처음에는 주인 안내만 있고, 쓰기로 남긴 피드백마다 항목이 생긴다 (이름은 쿠키로)', async () => {
		const empty = await request(server()).get('/messages/threads').expect(200);
		expect(empty.body).toEqual([
			{ id: 'owner', title: '김정현', createdAt: '2026-09-28T00:00:00.000Z', pinned: true, mine: false },
		]);

		const created = await request(server())
			.post('/messages/threads')
			.send({ body: ' 디자인이 깔끔해요 ', nickname: '무시' })
			.expect(201);
		const cookie = visitorCookie(created)!;
		const name = created.body.thread.title as string;
		expect(name).toMatch(/^\S+ .+ \S+$/);
		expect(created.body.thread).toMatchObject({ mine: true, summary: '디자인이 깔끔해요' });
		expect(created.body.message).toMatchObject({
			text: '디자인이 깔끔해요',
			nickname: name,
			mine: true,
			fromOwner: false,
		});

		const second = await request(server())
			.post('/messages/threads')
			.set('Cookie', cookie)
			.send({ body: '음악 앱 건의' })
			.expect(201);
		expect(second.body.thread.title).toBe(name);

		const mine = await request(server()).get('/messages/threads').set('Cookie', cookie).expect(200);
		expect(mine.body).toHaveLength(3);
		expect(mine.body.slice(1).every((thread: { mine: boolean }) => thread.mine)).toBe(true);
		const stranger = await request(server()).get('/messages/threads').expect(200);
		expect(stranger.body.some((thread: { mine: boolean }) => thread.mine)).toBe(false);
	});

	it('누구나 피드백과 주인 안내에 답글을 달고, 같은 사람의 말풍선은 같은 authorId로 묶인다', async () => {
		const a = await request(server()).post('/messages/threads').send({ body: '모바일에서 깨져요' });
		const aCookie = visitorCookie(a)!;
		const reply = await request(server())
			.post(`/messages/threads/${a.body.thread.id}`)
			.send({ body: '저도 그래요' })
			.expect(201);
		const bCookie = visitorCookie(reply)!;
		await request(server())
			.post(`/messages/threads/${a.body.thread.id}`)
			.set('Cookie', aCookie)
			.send({ body: '고칠게요?' });

		const list = await request(server())
			.get(`/messages/threads/${a.body.thread.id}`)
			.set('Cookie', bCookie)
			.expect(200);
		expect(list.body.map((m: { text: string; mine: boolean }) => [m.text, m.mine])).toEqual([
			['모바일에서 깨져요', false],
			['저도 그래요', true],
			['고칠게요?', false],
		]);
		expect(list.body[0].authorId).toBe(list.body[2].authorId);
		expect(list.body[0].authorId).not.toBe(list.body[1].authorId);
		expect(JSON.stringify(list.body)).not.toContain('visitorHash');

		const thread = (await request(server()).get('/messages/threads')).body.find(
			(item: { id: string }) => item.id === a.body.thread.id
		);
		expect(thread).toMatchObject({ summary: '모바일에서 깨져요', lastMessage: { text: '고칠게요?' } });

		// 주인 안내에 단 답글
		await request(server()).post('/messages/threads/owner').send({ body: '반가워요' }).expect(201);
		const owner = await request(server()).get('/messages/threads/owner').expect(200);
		expect(owner.body).toMatchObject([{ threadId: 'owner', text: '반가워요' }]);
		expect((await request(server()).get('/messages/threads')).body[0].lastMessage.text).toBe('반가워요');

		await request(server()).get('/messages/threads/nope').expect(404);
		await request(server()).post('/messages/threads/nope').send({ body: 'hi' }).expect(404);
		await request(server()).post('/messages/threads').send({ body: ' ' }).expect(400);
	});

	it('같은 브라우저에서 쓴 글만 지우고, 관리자는 김정현으로 쓰고 무엇이든 지운다', async () => {
		const created = await request(server()).post('/messages/threads').send({ body: '지울 글' });
		const cookie = visitorCookie(created)!;
		const id = created.body.message.id;
		await request(server()).delete(`/messages/${id}`).expect(403);
		await request(server()).delete(`/messages/${id}`).set('Cookie', cookie).expect(204);
		await request(server()).delete(`/messages/${id}`).set('Cookie', cookie).expect(404);

		const own = await request(server())
			.post('/messages/threads/owner')
			.set('Cookie', adminCookie)
			.send({ body: '감사합니다' })
			.expect(201);
		expect(own.body).toMatchObject({ nickname: '김정현', fromOwner: true, authorId: 'owner' });
		expect(own.body.ipPrefix).toBeUndefined();
		await request(server()).delete(`/messages/${own.body.id}`).set('Cookie', cookie).expect(403);

		const spam = await request(server()).post('/messages/threads').send({ body: '광고' });
		await request(server()).delete(`/messages/${spam.body.message.id}`).set('Cookie', adminCookie).expect(204);
	});

	it('피드백을 지우면 답글도 함께 지워진다 (DB)', async () => {
		const created = await request(server()).post('/messages/threads').send({ body: '본문' });
		await request(server()).post(`/messages/threads/${created.body.thread.id}`).send({ body: '답글' });
		await prisma.messageThread.delete({ where: { id: created.body.thread.id } });
		expect(await prisma.guestMessage.count()).toBe(0);
	});
});
