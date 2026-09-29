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

describe('댓글 (e2e)', () => {
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
		await prisma.postComment.deleteMany();
	});

	afterAll(async () => {
		await app?.close();
	});

	it('방문자는 이름·비밀번호로 쓰고, 누구나 읽는다. 응답에 비밀번호·IP 해시가 없다', async () => {
		const created = await request(server())
			.post('/posts/cra-to-vite/comments')
			.send({ name: '민수', password: '1234', body: '잘 봤어요!' })
			.expect(201);
		expect(created.body).toMatchObject({ name: '민수', body: '잘 봤어요!', isAdmin: false });
		expect(created.body.ipPrefix).toMatch(/^[\d:.a-f]+$/);

		const list = await request(server()).get('/posts/cra-to-vite/comments').expect(200);
		expect(list.body).toHaveLength(1);
		expect(Object.keys(list.body[0]).sort()).toEqual(['body', 'createdAt', 'id', 'ipPrefix', 'isAdmin', 'name']);
		await request(server()).get('/posts/other-post/comments').expect(200, []);

		// DB에는 비밀번호 원문도 IP 원문도 없다
		const row = await prisma.postComment.findFirstOrThrow();
		expect(row.passwordHash).toMatch(/^scrypt\$/);
		expect(JSON.stringify(row)).not.toContain('1234');
		expect(row.ipHash).toMatch(/^[0-9a-f]{64}$/);
	});

	it('입력 규칙을 어기면 400, 방문자는 관리자 이름을 쓸 수 없다', async () => {
		const response = await request(server())
			.post('/posts/cra-to-vite/comments')
			.send({ name: '김정현', password: '12', body: '' })
			.expect(400);
		expect(response.body.message).toEqual([
			'다른 이름을 입력해주세요.',
			'비밀번호는 4~20자로 입력해주세요.',
			'내용을 입력해주세요.',
		]);
		await request(server())
			.post('/posts/..%2Fetc/comments')
			.send({ name: 'a', password: '1234', body: 'x' })
			.expect(400);
	});

	it('비밀번호가 맞아야 지운다 (틀리면 403, 없으면 404)', async () => {
		const { body } = await request(server())
			.post('/posts/cra-to-vite/comments')
			.send({ name: '민수', password: '1234', body: '지울 댓글' });
		await request(server()).delete(`/comments/${body.id}`).send({ password: '4321' }).expect(403);
		await request(server()).delete(`/comments/${body.id}`).expect(403);
		await request(server()).delete(`/comments/${body.id}`).send({ password: '1234' }).expect(204);
		await request(server()).delete(`/comments/${body.id}`).send({ password: '1234' }).expect(404);
	});

	it('관리자는 비밀번호 없이 김정현으로 쓰고, 방문자 댓글도 지운다', async () => {
		const own = await request(server())
			.post('/posts/cra-to-vite/comments')
			.set('Cookie', adminCookie)
			.send({ body: '읽어 주셔서 감사합니다' })
			.expect(201);
		expect(own.body).toMatchObject({ name: '김정현', isAdmin: true, ipPrefix: null });

		const visitor = await request(server())
			.post('/posts/cra-to-vite/comments')
			.send({ name: '민수', password: '1234', body: '광고' });
		await request(server()).delete(`/comments/${visitor.body.id}`).set('Cookie', adminCookie).expect(204);

		// 관리자 댓글은 방문자가 비밀번호로 지울 수 없다
		await request(server()).delete(`/comments/${own.body.id}`).send({ password: '1234' }).expect(403);
	});

	it('DB에 바로 써도 이름·내용이 비거나 방문자 비밀번호가 없으면 거절된다 (CHECK 제약)', async () => {
		const base = { postSlug: 'cra-to-vite', name: '민수', body: '내용', ipHash: 'x', passwordHash: 'scrypt$a$b' };
		await expect(prisma.postComment.create({ data: { ...base, name: ' ' } })).rejects.toThrow(
			/PostComment_required_fields/
		);
		await expect(prisma.postComment.create({ data: { ...base, body: '' } })).rejects.toThrow(
			/PostComment_required_fields/
		);
		await expect(prisma.postComment.create({ data: { ...base, passwordHash: null } })).rejects.toThrow(
			/PostComment_required_fields/
		);
		await expect(
			prisma.postComment.create({ data: { ...base, passwordHash: null, isAdmin: true } })
		).resolves.toBeTruthy();
	});
});
