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

	/** 응답의 방문자 쿠키 ("macfolio_visitor=…") */
	const visitorCookie = (response: request.Response) =>
		([] as string[])
			.concat(response.headers['set-cookie'] ?? [])
			.find((cookie) => cookie.startsWith('macfolio_visitor='))
			?.split(';')[0];

	it('방문자는 이름 없이 쓰고, 처음 쓴 브라우저에는 쿠키를 준다. 그 쿠키면 늘 같은 이름', async () => {
		const first = await request(server())
			.post('/posts/cra-to-vite/comments')
			.send({ name: '무시', password: '무시', body: '잘 봤어요!' })
			.expect(201);
		const cookie = visitorCookie(first)!;
		expect(cookie).toMatch(/^macfolio_visitor=[\w-]{32}$/);
		expect(([] as string[]).concat(first.headers['set-cookie']).join()).toMatch(/HttpOnly/i);
		expect(first.body).toMatchObject({ body: '잘 봤어요!', isAdmin: false, mine: true });
		expect(first.body.name).toMatch(/^\S+ .+ \S+$/);
		expect(first.body.name).not.toBe('무시');
		expect(first.body.ipPrefix).toMatch(/^[\d:.a-f]+$/);

		const again = await request(server())
			.post('/posts/cra-to-vite/comments')
			.set('Cookie', cookie)
			.send({ body: '또 왔어요' })
			.expect(201);
		expect(again.body.name).toBe(first.body.name);
		const named = await request(server()).get('/visitor').set('Cookie', cookie).expect(200);
		expect(named.body).toEqual({ name: first.body.name });

		// 목록의 mine은 쿠키로 정한다. 응답에 방문자·IP 해시가 없다 (좋아요도 수와 눌렀는지만)
		const mine = await request(server()).get('/posts/cra-to-vite/comments').set('Cookie', cookie).expect(200);
		expect(mine.body.map((comment: { mine: boolean }) => comment.mine)).toEqual([true, true]);
		expect(Object.keys(mine.body[0]).sort()).toEqual([
			'body',
			'createdAt',
			'id',
			'ipPrefix',
			'isAdmin',
			'liked',
			'likes',
			'mine',
			'name',
		]);
		const stranger = await request(server()).get('/posts/cra-to-vite/comments').expect(200);
		expect(stranger.body.every((comment: { mine: boolean }) => !comment.mine)).toBe(true);
		await request(server()).get('/posts/other-post/comments').expect(200, []);

		// DB에는 쿠키 원문도 IP 원문도 없다
		const row = await prisma.postComment.findFirstOrThrow();
		expect(row.visitorHash).toMatch(/^[0-9a-f]{64}$/);
		expect(JSON.stringify(row)).not.toContain(cookie.split('=')[1]);
		expect(row.passwordHash).toBeNull();
		expect(row.ipHash).toMatch(/^[0-9a-f]{64}$/);
	});

	it('내용이 비었거나 500자를 넘으면 400', async () => {
		const empty = await request(server()).post('/posts/cra-to-vite/comments').send({ body: ' ' }).expect(400);
		expect(empty.body.message).toEqual(['내용을 입력해주세요.']);
		await request(server())
			.post('/posts/cra-to-vite/comments')
			.send({ body: '가'.repeat(501) })
			.expect(400);
		await request(server()).post('/posts/..%2Fetc/comments').send({ body: 'x' }).expect(400);
	});

	it('같은 브라우저(쿠키)에서 쓴 댓글만 지운다 (다르면 403, 없으면 404)', async () => {
		const created = await request(server()).post('/posts/cra-to-vite/comments').send({ body: '지울 댓글' });
		const cookie = visitorCookie(created)!;
		const other = visitorCookie(await request(server()).get('/visitor'))!;
		await request(server()).delete(`/comments/${created.body.id}`).expect(403);
		await request(server()).delete(`/comments/${created.body.id}`).set('Cookie', other).expect(403);
		await request(server()).delete(`/comments/${created.body.id}`).set('Cookie', cookie).expect(204);
		await request(server()).delete(`/comments/${created.body.id}`).set('Cookie', cookie).expect(404);
	});

	it('관리자는 김정현으로 쓰고, 방문자 댓글과 예전(비밀번호) 댓글도 지운다', async () => {
		const own = await request(server())
			.post('/posts/cra-to-vite/comments')
			.set('Cookie', adminCookie)
			.send({ body: '읽어 주셔서 감사합니다' })
			.expect(201);
		expect(own.body).toMatchObject({ name: '김정현', isAdmin: true, ipPrefix: null });

		const visitor = await request(server()).post('/posts/cra-to-vite/comments').send({ body: '광고' });
		await request(server()).delete(`/comments/${visitor.body.id}`).set('Cookie', adminCookie).expect(204);

		// 이름·비밀번호를 받던 때의 댓글: 방문자 해시가 없어서 관리자만 지운다
		const legacy = await prisma.postComment.create({
			data: { postSlug: 'cra-to-vite', name: '민수', body: '예전 댓글', ipHash: 'x', passwordHash: 'scrypt$a$b' },
		});
		await request(server()).delete(`/comments/${legacy.id}`).set('Cookie', visitorCookie(visitor)!).expect(403);
		await request(server()).delete(`/comments/${legacy.id}`).set('Cookie', adminCookie).expect(204);

		// 관리자 댓글은 방문자가 지울 수 없다
		await request(server()).delete(`/comments/${own.body.id}`).set('Cookie', visitorCookie(visitor)!).expect(403);
	});

	it('DB에 바로 써도 이름·내용이 비거나 방문자 구분값이 없으면 거절된다 (CHECK 제약)', async () => {
		const base = { postSlug: 'cra-to-vite', name: '🦊 날쌘 여우', body: '내용', ipHash: 'x', visitorHash: 'v' };
		await expect(prisma.postComment.create({ data: { ...base, name: ' ' } })).rejects.toThrow(
			/PostComment_required_fields/
		);
		await expect(prisma.postComment.create({ data: { ...base, body: '' } })).rejects.toThrow(
			/PostComment_required_fields/
		);
		await expect(prisma.postComment.create({ data: { ...base, visitorHash: null } })).rejects.toThrow(
			/PostComment_required_fields/
		);
		await expect(
			prisma.postComment.create({ data: { ...base, visitorHash: null, isAdmin: true } })
		).resolves.toBeTruthy();
	});
});
