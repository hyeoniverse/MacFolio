import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { GithubClient } from '../src/auth/github.client.js';
import { MAX_REVISIONS } from '../src/posts/posts.service.js';
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

	const admin = (method: 'get' | 'post' | 'put' | 'delete', path: string) =>
		request(server())[method](path).set('Cookie', adminCookie);

	/** 서울 기준 오늘에서 days일 뒤 */
	const dayAfter = (days: number) =>
		new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date(Date.now() + days * 86_400_000));

	afterAll(async () => {
		await app?.close();
	});

	it('관리자가 아니면 쓰고 고치고 게시하고 지울 수 없다 (401)', async () => {
		await request(server()).get('/posts/admin').expect(401);
		await request(server()).post('/posts').send(POST).expect(401);
		await request(server()).put('/posts/cra-to-vite/draft').send(POST).expect(401);
		await request(server()).post('/posts/cra-to-vite/publish').send(POST).expect(401);
		await request(server()).delete('/posts/cra-to-vite/draft').expect(401);
		await request(server()).get('/posts/cra-to-vite/revisions').expect(401);
		await request(server()).delete('/posts/cra-to-vite').expect(401);
		expect(await prisma.post.count()).toBe(0);
	});

	it('새 글은 임시 저장으로 시작해서, 게시하기 전에는 방문자에게 보이지 않는다', async () => {
		const created = await admin('post', '/posts').send(POST).expect(201);
		expect(created.body.slug).toMatch(/^2026-09-29-[0-9a-f]{6}$/);
		expect(created.body).toMatchObject({ published: null, draft: POST, revisions: 0 });
		expect((await request(server()).get('/posts').expect(200)).body).toEqual([]);

		// 이어 쓰기는 임시 저장에만
		const { slug } = created.body;
		await admin('put', `/posts/${slug}/draft`)
			.send({ ...POST, body: '더 쓴 본문' })
			.expect(200);
		expect((await request(server()).get('/posts').expect(200)).body).toEqual([]);

		// 게시하면 보이고, 임시 저장은 비고, 버전이 하나 남는다
		const published = await admin('post', `/posts/${slug}/publish`)
			.send({ ...POST, body: '게시한 본문' })
			.expect(200);
		expect(published.body).toMatchObject({ draft: null, published: { body: '게시한 본문' }, revisions: 1 });
		expect(published.body.publishedAt).toEqual(expect.any(String));
		const list = await request(server()).get('/posts').expect(200);
		expect(list.body).toEqual([{ slug, ...POST, body: '게시한 본문', deleted: false }]);
	});

	it('게시한 글을 고쳐도 게시할 때까지 방문자는 게시한 내용을 본다. 버리면 게시한 내용으로 돌아간다', async () => {
		await admin('post', '/posts/cra-to-vite/publish').send(POST).expect(200);
		const draft = await admin('put', '/posts/cra-to-vite/draft')
			.send({ ...POST, title: '고치는 중' })
			.expect(200);
		expect(draft.body).toMatchObject({ published: { title: '새 글' }, draft: { title: '고치는 중' } });
		expect((await request(server()).get('/posts')).body[0].title).toBe('새 글');

		const discarded = await admin('delete', '/posts/cra-to-vite/draft').expect(200);
		expect(discarded.body).toMatchObject({ published: { title: '새 글' }, draft: null });
	});

	it('게시한 적 없는 글의 임시 저장을 버리면 글이 없어진다 (저장소 글이면 원래대로 보인다)', async () => {
		await admin('put', '/posts/cra-to-vite/draft').send(POST).expect(200);
		const discarded = await admin('delete', '/posts/cra-to-vite/draft').expect(200);
		expect(discarded.body).toEqual({});
		expect(await prisma.post.count()).toBe(0);
		await admin('delete', '/posts/cra-to-vite/draft').expect(404);
	});

	it('관리자 목록은 게시한 내용과 임시 저장을 따로 보여 준다', async () => {
		await admin('post', '/posts/a/publish').send(POST).expect(200);
		await admin('put', '/posts/a/draft')
			.send({ ...POST, title: '고치는 중' })
			.expect(200);
		await admin('put', '/posts/b/draft').send(POST).expect(200);
		const list = await admin('get', '/posts/admin').expect(200);
		expect(list.body).toEqual([
			expect.objectContaining({ slug: 'a', published: POST, draft: { ...POST, title: '고치는 중' }, revisions: 1 }),
			expect.objectContaining({ slug: 'b', published: null, draft: POST, revisions: 0 }),
		]);
	});

	it('날짜가 미래인 글은 게시해도 그날까지 가려진다 (예약 발행, 저장소 글도 가린다)', async () => {
		const future = dayAfter(3);
		await admin('post', '/posts/cra-to-vite/publish')
			.send({ ...POST, date: future })
			.expect(200);
		const hidden = await request(server()).get('/posts').expect(200);
		expect(hidden.body).toEqual([expect.objectContaining({ slug: 'cra-to-vite', deleted: true, title: '', body: '' })]);
		// 관리자는 예약한 내용을 본다
		const list = await admin('get', '/posts/admin').expect(200);
		expect(list.body[0].published.date).toBe(future);

		await admin('post', '/posts/cra-to-vite/publish')
			.send({ ...POST, date: dayAfter(0) })
			.expect(200);
		expect((await request(server()).get('/posts')).body[0]).toMatchObject({ deleted: false, title: '새 글' });
	});

	it('게시할 때마다 버전을 남기고, 버전의 내용을 읽을 수 있다', async () => {
		await admin('post', '/posts/cra-to-vite/publish')
			.send({ ...POST, title: '첫 판' })
			.expect(200);
		await admin('post', '/posts/cra-to-vite/publish')
			.send({ ...POST, title: '둘째 판' })
			.expect(200);
		const revisions = await admin('get', '/posts/cra-to-vite/revisions').expect(200);
		expect(revisions.body.map((item: { title: string }) => item.title)).toEqual(['둘째 판', '첫 판']);
		expect(revisions.body[0]).toMatchObject({ createdBy: 'hyeoniverse', createdAt: expect.any(String) });

		const first = await admin('get', `/posts/cra-to-vite/revisions/${revisions.body[1].id}`).expect(200);
		expect(first.body).toMatchObject({ ...POST, title: '첫 판' });
		await admin('get', `/posts/other/revisions/${revisions.body[1].id}`).expect(404);
		await admin('get', '/posts/cra-to-vite/revisions/abc').expect(400);
	});

	it(`버전은 글마다 최근 ${MAX_REVISIONS}개만 남긴다`, async () => {
		await admin('post', '/posts/cra-to-vite/publish').send(POST).expect(200);
		await prisma.postRevision.createMany({
			data: Array.from({ length: MAX_REVISIONS }, (_, index) => ({
				postSlug: 'cra-to-vite',
				...POST,
				title: `옛 판 ${index}`,
				createdAt: new Date(Date.UTC(2020, 0, 1 + index)),
				createdBy: 'x',
			})),
		});
		await admin('post', '/posts/cra-to-vite/publish')
			.send({ ...POST, title: '새 판' })
			.expect(200);
		const revisions = await admin('get', '/posts/cra-to-vite/revisions').expect(200);
		expect(revisions.body).toHaveLength(MAX_REVISIONS);
		expect(revisions.body[0].title).toBe('새 판');
		expect(revisions.body.map((item: { title: string }) => item.title)).not.toContain('옛 판 0');
	});

	it('지우면 지운 표시로 남고 (저장소 글도 가린다), 다시 게시하면 되살아난다', async () => {
		await admin('put', '/posts/cra-to-vite/draft').send(POST).expect(200);
		await admin('delete', '/posts/cra-to-vite').expect(204);
		const list = await request(server()).get('/posts').expect(200);
		expect(list.body).toEqual([expect.objectContaining({ slug: 'cra-to-vite', deleted: true })]);
		expect((await admin('get', '/posts/admin')).body[0]).toMatchObject({ deleted: true, draft: null });

		await admin('post', '/posts/cra-to-vite/publish').send(POST).expect(200);
		expect((await request(server()).get('/posts')).body[0]).toMatchObject({ deleted: false });
	});

	it('규칙을 어기면 관리자라도 400 (임시 저장도 같은 규칙)', async () => {
		const response = await admin('post', '/posts')
			.send({ ...POST, title: '', category: 'a/b/c/d' })
			.expect(400);
		expect(response.body.message).toEqual(['제목을 입력해주세요.', '폴더는 3단까지입니다: a/b/c/d']);
		await admin('put', '/posts/x/draft')
			.send({ ...POST, body: '' })
			.expect(400);
		await admin('post', '/posts/x/publish')
			.send({ ...POST, date: '2026-02-30' })
			.expect(400);
		expect(await prisma.post.count()).toBe(0);
	});

	it('API를 거치지 않고 DB에 바로 써도 규칙이 지켜진다 (CHECK 제약)', async () => {
		const base = { slug: 'x', updatedBy: 'x' };
		const published = {
			title: '제목',
			date: '2026-09-29',
			category: '기타',
			summary: '',
			body: '본문',
			publishedAt: new Date(),
		};
		// 게시한 내용이 일부만 있거나 비었다
		await expect(prisma.post.create({ data: { ...base, ...published, title: '  ' } })).rejects.toThrow(
			/Post_published_fields/
		);
		await expect(prisma.post.create({ data: { ...base, ...published, body: null } })).rejects.toThrow(
			/Post_published_fields/
		);
		await expect(prisma.post.create({ data: { ...base, ...published, date: '어제' } })).rejects.toThrow(
			/Post_published_fields/
		);
		// 임시 저장도 같은 규칙
		await expect(
			prisma.post.create({
				data: {
					...base,
					draftTitle: '제목',
					draftDate: '2026-09-29',
					draftCategory: '기타',
					draftSummary: '',
					draftBody: ' ',
					draftUpdatedAt: new Date(),
				},
			})
		).rejects.toThrow(/Post_draft_fields/);
		// 내용이 하나도 없는 글은 지운 표시일 때만
		await expect(prisma.post.create({ data: base })).rejects.toThrow(/Post_has_content/);
		await expect(prisma.post.create({ data: { ...base, deleted: true } })).resolves.toBeTruthy();
		// 버전도 필수 항목이 있어야 한다
		await expect(
			prisma.postRevision.create({
				data: {
					postSlug: 'x',
					title: '',
					date: '2026-09-29',
					category: '기타',
					summary: '',
					body: '본문',
					createdBy: 'x',
				},
			})
		).rejects.toThrow(/PostRevision_required_fields/);
	});
});
