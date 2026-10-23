import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { kstDay, shiftDay } from '../src/analytics/rules.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { GithubClient } from '../src/auth/github.client.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

// 비밀 글: 관리자 세션이 아닌 요청에는 어디에도 나오지 않고, 주소로 물어도 없는 글과 같게 답한다.
// 글 주소를 받는 공개 경로(목록, 공유 카드, 댓글, 좋아요, 인기글, 조회수, 트래픽 요약, 메모 정리 내용)를 모두 확인한다

process.env.DATABASE_URL ??= 'postgresql://macfolio:macfolio@localhost:5432/macfolio';
process.env.GITHUB_CLIENT_ID = 'test-client-id';
process.env.GITHUB_CLIENT_SECRET = 'test-client-secret';
process.env.ADMIN_GITHUB_ID = '68999618';
process.env.AUTH_RATE_LIMIT = '1000';
process.env.WRITE_RATE_LIMIT = '1000';
process.env.COMMENT_RATE_LIMIT = '1000';
process.env.LIKE_RATE_LIMIT = '1000';

const fakeGithub: Partial<GithubClient> = {
	exchangeCode: async () => 'token',
	getUser: async () => ({ id: 68999618, login: 'hyeoniverse', avatarUrl: '' }),
};

const POST = {
	title: '나만 보는 글',
	date: '2026-09-29',
	category: '일기',
	summary: '비밀',
	body: '## 본문\n\n비밀 내용',
};
/** 함께 두는 공개 글 */
const PUBLIC = { ...POST, title: '공개 글', summary: '공개', body: '공개 내용' };

describe('비밀 글 (e2e)', () => {
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

	const clean = async () => {
		await prisma.commentLike.deleteMany();
		await prisma.postLike.deleteMany();
		await prisma.postComment.deleteMany();
		await prisma.postRevision.deleteMany();
		await prisma.post.deleteMany();
		await prisma.memoOrganization.deleteMany();
		await prisma.dailyStat.deleteMany();
		await prisma.analyticsEvent.deleteMany();
	};
	beforeEach(clean);

	afterAll(async () => {
		await clean();
		await app?.close();
	});

	const admin = (method: 'get' | 'post' | 'put' | 'delete', path: string) =>
		request(server())[method](path).set('Cookie', adminCookie);
	const visitor = (method: 'get' | 'post' | 'put' | 'delete', path: string) => request(server())[method](path);

	/** 관리자가 글을 쓰고 게시한다. 주소를 돌려준다 */
	const publish = async (post = POST) => {
		const created = await admin('post', '/posts').send(post).expect(201);
		const slug: string = created.body.slug;
		await admin('post', `/posts/${slug}/publish`).send(post).expect(200);
		return slug;
	};

	const setSecret = (slug: string, secret: boolean) => admin('put', `/posts/${slug}/secret`).send({ secret });

	it('관리자만 지정·해제한다. 몸통이 틀리면 400, 서버에 없는 글은 404, 잠긴 메모는 409', async () => {
		const slug = await publish();
		await visitor('put', `/posts/${slug}/secret`).send({ secret: true }).expect(401);
		await admin('put', `/posts/${slug}/secret`).send({ secret: 'yes' }).expect(400);
		await admin('put', `/posts/${slug}/secret`).send({}).expect(400);
		await setSecret('2026-01-01-000000', true).expect(404);

		const marked = await setSecret(slug, true).expect(200);
		expect(marked.body).toMatchObject({ slug, secret: true, published: { title: POST.title } });
		const listed = await admin('get', '/posts/admin').expect(200);
		expect(listed.body.find((post: { slug: string }) => post.slug === slug)).toMatchObject({ secret: true });

		// 잠긴 메모는 바꿀 수 없다
		await admin('put', '/memo/organization')
			.send({ folders: [], posts: {}, moves: [], pins: {}, locks: { [slug]: true }, order: [] })
			.expect(200);
		await setSecret(slug, false).expect(409);

		// '최근 삭제된 항목'의 글도 404
		await admin('put', '/memo/organization')
			.send({ folders: [], posts: {}, moves: [], pins: {}, locks: {}, order: [] })
			.expect(200);
		await admin('delete', `/posts/${slug}`).expect(204);
		await setSecret(slug, false).expect(404);
	});

	it('방문자 목록과 공유 카드에서 빠지고, 관리자 세션이어도 공개 목록에는 없다. 풀면 다시 보인다', async () => {
		const shown = await publish(PUBLIC);
		const slug = await publish();
		await setSecret(slug, true).expect(200);

		const list = await visitor('get', '/posts').expect(200);
		expect(list.body.map((post: { slug: string }) => post.slug)).toEqual([shown]);
		expect(JSON.stringify(list.body)).not.toContain(slug);
		expect(JSON.stringify(list.body)).not.toContain('비밀 내용');
		// Worker·최근 글 위젯이 쓰는 공개 목록이라 관리자 쿠키가 있어도 같다
		const asAdmin = await admin('get', '/posts').expect(200);
		expect(asAdmin.body).toEqual(list.body);

		// 공유 카드: 없는 글과 같은 404
		const missing = await visitor('get', '/posts/2026-01-01-000000/og.png').expect(404);
		const hidden = await visitor('get', `/posts/${slug}/og.png`).expect(404);
		// 주소와 시각만 다르다
		const shape = ({ statusCode, error, message }: Record<string, unknown>) => ({ statusCode, error, message });
		expect(shape(hidden.body)).toEqual(shape(missing.body));

		await setSecret(slug, false).expect(200);
		const again = await visitor('get', '/posts').expect(200);
		expect(again.body.map((post: { slug: string }) => post.slug).sort()).toEqual([shown, slug].sort());
		await visitor('get', `/posts/${slug}/og.png`).expect(200);
	});

	it('방문자는 비밀 글을 지운 표시로도 받지 않는다 (주소가 있다는 것도 알리지 않는다)', async () => {
		const slug = await publish();
		await setSecret(slug, true).expect(200);
		await admin('delete', `/posts/${slug}`).expect(204);
		const list = await visitor('get', '/posts').expect(200);
		expect(JSON.stringify(list.body)).not.toContain(slug);
	});

	it('댓글·좋아요: 방문자에게는 없는 글과 같고(빈 목록, 0), 쓰거나 누르면 404. 관리자는 읽고 쓴다', async () => {
		const slug = await publish();
		const comment = await visitor('post', `/posts/${slug}/comments`).send({ body: '공개였을 때 쓴 댓글' }).expect(201);
		await visitor('put', `/posts/${slug}/like`).expect(200);
		await setSecret(slug, true).expect(200);

		// 읽기: 없는 글과 같은 모양
		const none = await visitor('get', '/posts/2026-01-01-000000/comments').expect(200);
		expect((await visitor('get', `/posts/${slug}/comments`).expect(200)).body).toEqual(none.body);
		const noLikes = await visitor('get', '/posts/2026-01-01-000000/likes').expect(200);
		expect((await visitor('get', `/posts/${slug}/likes`).expect(200)).body).toEqual(noLikes.body);

		// 쓰기: 404
		await visitor('post', `/posts/${slug}/comments`).send({ body: '몰래' }).expect(404);
		await visitor('put', `/posts/${slug}/like`).expect(404);
		await visitor('delete', `/posts/${slug}/like`).expect(404);
		// 비밀 글의 댓글은 방문자에게 없는 댓글이다 (쓴 브라우저여도)
		await visitor('put', `/comments/${comment.body.id}/like`).expect(404);
		await visitor('delete', `/comments/${comment.body.id}`).expect(404);
		expect(await prisma.postComment.count()).toBe(1);

		// 관리자는 그대로
		const comments = await admin('get', `/posts/${slug}/comments`).expect(200);
		expect(comments.body).toHaveLength(1);
		await admin('post', `/posts/${slug}/comments`).send({ body: '관리자 메모' }).expect(201);
		await admin('put', `/posts/${slug}/like`).expect(200);
		expect((await admin('get', `/posts/${slug}/likes`).expect(200)).body).toMatchObject({ count: 2 });
		await admin('put', `/comments/${comment.body.id}/like`).expect(200);
	});

	it('인기글·조회수·트래픽 요약: 방문자에게는 비밀 글을 빼고, 관리자에게는 보인다', async () => {
		const shown = await publish(PUBLIC);
		const slug = await publish();
		await visitor('post', `/posts/${slug}/comments`).send({ body: '댓글' }).expect(201);
		await visitor('post', `/posts/${shown}/comments`).send({ body: '댓글' }).expect(201);
		const today = kstDay(new Date());
		const yesterday = shiftDay(today, -1);
		await prisma.dailyStat.createMany({
			data: [
				{ day: yesterday, metric: 'visits', key: '', value: 2 },
				{ day: yesterday, metric: 'item', key: `memo/${slug}`, value: 4 },
				{ day: yesterday, metric: 'item', key: `memo/${shown}`, value: 3 },
			],
		});
		await setSecret(slug, true).expect(200);

		const stats = await visitor('get', '/posts/stats').expect(200);
		expect(Object.keys(stats.body)).toEqual([shown]);
		expect(Object.keys((await admin('get', '/posts/stats').expect(200)).body).sort()).toEqual([shown, slug].sort());

		const views = await visitor('get', '/analytics/views').query({ app: 'memo' }).expect(200);
		expect(views.body).toEqual({ app: 'memo', views: { [shown]: 3 } });
		const adminViews = await admin('get', '/analytics/views').query({ app: 'memo' }).expect(200);
		expect(adminViews.body.views).toEqual({ [shown]: 3, [slug]: 4 });

		const range = { from: yesterday, to: today };
		const summary = await visitor('get', '/analytics/summary').query(range).expect(200);
		expect(summary.body.breakdown.item).toEqual([{ key: `memo/${shown}`, value: 3 }]);
		expect(JSON.stringify(summary.body)).not.toContain(slug);
		const adminSummary = await admin('get', '/analytics/summary').query(range).expect(200);
		expect(adminSummary.body.breakdown.item.map((row: { key: string }) => row.key)).toContain(`memo/${slug}`);

		// 풀면 방문자 요약에도 바로 보인다 (1분 캐시에 남지 않는다)
		await setSecret(slug, false).expect(200);
		const after = await visitor('get', '/analytics/summary').query(range).expect(200);
		expect(after.body.breakdown.item.map((row: { key: string }) => row.key)).toContain(`memo/${slug}`);
	});

	it('메모 정리 내용: 방문자에게는 옮긴 글·고정·잠금에서 비밀 글의 주소를 뺀다', async () => {
		const shown = await publish(PUBLIC);
		const slug = await publish();
		await setSecret(slug, true).expect(200);
		const organization = {
			folders: ['일기'],
			posts: { [slug]: '일기', [shown]: '일기' },
			moves: [],
			pins: { [slug]: true, [shown]: true },
			locks: {},
			order: [],
		};
		await admin('put', '/memo/organization').send(organization).expect(200);

		const forVisitor = await visitor('get', '/memo/organization').expect(200);
		expect(forVisitor.body).toMatchObject({ posts: { [shown]: '일기' }, pins: { [shown]: true } });
		expect(JSON.stringify(forVisitor.body)).not.toContain(slug);
		// 관리자는 통째로 받아 고친 뒤 저장하므로 그대로
		const forAdmin = await admin('get', '/memo/organization').expect(200);
		expect(forAdmin.body).toMatchObject({ posts: organization.posts, pins: organization.pins });
	});
});
