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

const fakeGithub: Partial<GithubClient> = {
	exchangeCode: async () => 'token',
	getUser: async () => ({ id: 68999618, login: 'hyeoniverse', avatarUrl: '' }),
};

const POST = { title: '새 글', date: '2026-09-29', category: '개발기/MacFolio', summary: '한 줄', body: '## 본문' };

describe('블로그 글 (e2e)', () => {
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
		await prisma.post.deleteMany();
	});

	afterAll(async () => {
		await app?.close();
	});

	it('관리자가 아니면 쓰고 고치고 지울 수 없다 (401)', async () => {
		await request(server()).post('/posts').send(POST).expect(401);
		await request(server()).put('/posts/cra-to-vite').send(POST).expect(401);
		await request(server()).delete('/posts/cra-to-vite').expect(401);
		expect(await prisma.post.count()).toBe(0);
	});

	it('관리자가 새 글을 쓰면 날짜로 시작하는 주소가 붙고, 누구나 읽는다', async () => {
		const created = await request(server()).post('/posts').set('Cookie', adminCookie).send(POST).expect(201);
		expect(created.body).toMatchObject({ ...POST, deleted: false });
		expect(created.body.slug).toMatch(/^2026-09-29-[0-9a-f]{6}$/);

		const list = await request(server()).get('/posts').expect(200);
		expect(list.body.map((post: { slug: string }) => post.slug)).toEqual([created.body.slug]);
		expect((await prisma.post.findFirstOrThrow()).updatedBy).toBe('hyeoniverse');
	});

	it('저장소의 Markdown 글을 고치면 같은 주소로 서버에 생기고, 다시 고칠 수 있다', async () => {
		await request(server())
			.put('/posts/cra-to-vite')
			.set('Cookie', adminCookie)
			.send({ ...POST, title: 'CRA에서 Vite로 (고침)' })
			.expect(200);
		const again = await request(server())
			.put('/posts/cra-to-vite')
			.set('Cookie', adminCookie)
			.send({ ...POST, title: '두 번째 고침' })
			.expect(200);
		expect(again.body).toMatchObject({ slug: 'cra-to-vite', title: '두 번째 고침', deleted: false });
		expect(await prisma.post.count()).toBe(1);
	});

	it('지우면 지운 표시로 남고 (Markdown 글도 가린다), 다시 고치면 되살아난다', async () => {
		await request(server()).delete('/posts/cra-to-vite').set('Cookie', adminCookie).expect(204);
		const list = await request(server()).get('/posts').expect(200);
		expect(list.body).toEqual([expect.objectContaining({ slug: 'cra-to-vite', deleted: true })]);

		await request(server()).put('/posts/cra-to-vite').set('Cookie', adminCookie).send(POST).expect(200);
		expect((await prisma.post.findUniqueOrThrow({ where: { slug: 'cra-to-vite' } })).deleted).toBe(false);
	});

	it('규칙을 어기면 관리자라도 400', async () => {
		const response = await request(server())
			.post('/posts')
			.set('Cookie', adminCookie)
			.send({ ...POST, title: '', category: 'a/b/c/d' })
			.expect(400);
		expect(response.body.message).toEqual(['제목을 입력해주세요.', '폴더는 3단까지입니다: a/b/c/d']);
	});
});
