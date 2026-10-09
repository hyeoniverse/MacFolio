import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

process.env.DATABASE_URL ??= 'postgresql://macfolio:macfolio@localhost:5432/macfolio';
process.env.AUTH_RATE_LIMIT = '1000';
process.env.COMMENT_RATE_LIMIT = '1000';
process.env.LIKE_RATE_LIMIT = '1000';

describe('좋아요 (e2e)', () => {
	let app: INestApplication;
	let prisma: PrismaService;
	const server = () => app.getHttpServer();

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
		app = configureApp(moduleRef.createNestApplication());
		await app.init();
		prisma = app.get(PrismaService);
	});

	beforeEach(async () => {
		await prisma.postLike.deleteMany();
		await prisma.postComment.deleteMany();
	});

	afterAll(async () => {
		await prisma?.postLike.deleteMany();
		await prisma?.postComment.deleteMany();
		await app?.close();
	});

	/** 응답의 방문자 쿠키 ("macfolio_visitor=…") */
	const visitorCookie = (response: request.Response) =>
		([] as string[])
			.concat(response.headers['set-cookie'] ?? [])
			.find((cookie) => cookie.startsWith('macfolio_visitor='))!
			.split(';')[0];

	it('글: 브라우저마다 한 번만 세고, 다시 눌러도 그대로, 취소하면 빠진다', async () => {
		expect((await request(server()).get('/posts/cra-to-vite/likes').expect(200)).body).toEqual({
			count: 0,
			liked: false,
		});

		const first = await request(server()).put('/posts/cra-to-vite/like').expect(200);
		expect(first.body).toEqual({ count: 1, liked: true });
		const alice = visitorCookie(first);
		// 같은 브라우저가 다시 눌러도 한 번
		await request(server()).put('/posts/cra-to-vite/like').set('Cookie', alice).expect(200, { count: 1, liked: true });

		// 다른 브라우저
		const second = await request(server()).put('/posts/cra-to-vite/like').expect(200);
		expect(second.body).toEqual({ count: 2, liked: true });

		// 읽을 때 누른 브라우저에는 liked, 쿠키 없는 브라우저에는 아니다
		await request(server()).get('/posts/cra-to-vite/likes').set('Cookie', alice).expect(200, { count: 2, liked: true });
		await request(server()).get('/posts/cra-to-vite/likes').expect(200, { count: 2, liked: false });

		await request(server())
			.delete('/posts/cra-to-vite/like')
			.set('Cookie', alice)
			.expect(200, { count: 1, liked: false });
		// 이미 취소했으면 그대로
		await request(server())
			.delete('/posts/cra-to-vite/like')
			.set('Cookie', alice)
			.expect(200, { count: 1, liked: false });

		await request(server()).put('/posts/no%20good/like').expect(400);
	});

	it('댓글: 목록에 좋아요 수와 내가 눌렀는지가 오고, 댓글을 지우면 함께 지워진다', async () => {
		const created = await request(server()).post('/posts/cra-to-vite/comments').send({ body: '잘 봤어요' }).expect(201);
		expect(created.body).toMatchObject({ likes: 0, liked: false });
		const writer = visitorCookie(created);
		const id = created.body.id as string;

		const liked = await request(server()).put(`/comments/${id}/like`).expect(200);
		expect(liked.body).toEqual({ count: 1, liked: true });
		const fan = visitorCookie(liked);
		await request(server()).put(`/comments/${id}/like`).set('Cookie', writer).expect(200, { count: 2, liked: true });

		const list = await request(server()).get('/posts/cra-to-vite/comments').set('Cookie', fan).expect(200);
		expect(list.body[0]).toMatchObject({ likes: 2, liked: true, mine: false });
		const anonymous = await request(server()).get('/posts/cra-to-vite/comments').expect(200);
		expect(anonymous.body[0]).toMatchObject({ likes: 2, liked: false });

		await request(server()).delete(`/comments/${id}/like`).set('Cookie', fan).expect(200, { count: 1, liked: false });
		await request(server()).put('/comments/nothing/like').expect(404);

		await request(server()).delete(`/comments/${id}`).set('Cookie', writer).expect(204);
		expect(await prisma.commentLike.count()).toBe(0);
	});

	it('글마다 댓글 수와 좋아요 수 (하나라도 있는 글만)', async () => {
		await request(server()).post('/posts/cra-to-vite/comments').send({ body: '하나' }).expect(201);
		await request(server()).post('/posts/cra-to-vite/comments').send({ body: '둘' }).expect(201);
		await request(server()).put('/posts/cra-to-vite/like').expect(200);
		await request(server()).put('/posts/post-editor/like').expect(200);
		await request(server()).put('/posts/post-editor/like').expect(200);

		const stats = await request(server()).get('/posts/stats').expect(200);
		expect(stats.body).toEqual({
			'cra-to-vite': { comments: 2, likes: 1 },
			'post-editor': { comments: 0, likes: 2 },
		});
	});
});
