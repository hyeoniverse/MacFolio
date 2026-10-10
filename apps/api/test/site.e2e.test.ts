import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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
process.env.WRITE_RATE_LIMIT = '1000';

const profile = {
	name: '홍길동',
	nameEn: 'Hong Gil-dong',
	role: 'Web Developer',
	school: '',
	location: 'Busan',
	github: 'https://github.com/gildong',
	email: 'gildong@example.com',
	skills: { frontend: ['Vue'], backend: [], interaction: [] },
	siteStack: ['Vite'],
};

describe('사이트 콘텐츠: 프로필 (e2e)', () => {
	let app: Awaited<ReturnType<typeof start>>['app'];
	let server: ReturnType<Awaited<ReturnType<typeof start>>['app']['getHttpServer']>;
	let adminCookie: string;
	let prisma: PrismaService;

	async function start() {
		const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
			.overrideProvider(GithubClient)
			.useValue({
				exchangeCode: async () => 'token',
				getUser: async () => ({ id: 68999618, login: 'hyeoniverse', avatarUrl: '' }),
			})
			.compile();
		const created = configureApp(moduleRef.createNestApplication());
		await created.init();
		return { app: created };
	}

	beforeAll(async () => {
		({ app } = await start());
		server = app.getHttpServer();
		prisma = app.get(PrismaService);
		await prisma.siteContent.deleteMany();
		const begin = await request(server).get('/auth/github');
		const state = new URL(begin.headers.location).searchParams.get('state');
		const stateCookie = ([] as string[]).concat(begin.headers['set-cookie'])[0].split(';')[0];
		const callback = await request(server)
			.get('/auth/github/callback')
			.query({ code: 'x', state })
			.set('Cookie', stateCookie);
		adminCookie = ([] as string[])
			.concat(callback.headers['set-cookie'])
			.find((cookie) => cookie.startsWith('macfolio_session='))!
			.split(';')[0];
	});

	afterAll(async () => {
		await prisma?.siteContent.deleteMany();
		await prisma?.postComment.deleteMany();
		await prisma?.guestMessage.deleteMany();
		await prisma?.messageThread.deleteMany();
		await app?.close();
	});

	it('처음에는 저장한 프로필이 없다 (화면은 코드의 기본값). 관리자가 쓴 글은 기본 이름', async () => {
		await request(server).get('/site').expect(200, { profile: null, updatedAt: null });
		const comment = await request(server)
			.post('/posts/cra-to-vite/comments')
			.set('Cookie', adminCookie)
			.send({ body: '작성자' })
			.expect(201);
		expect(comment.body.name).toBe('김정현');
	});

	it('관리자만 저장하고, 규칙을 어기면 이유를 모두 돌려준다', async () => {
		await request(server).put('/site/profile').send(profile).expect(401);
		const bad = await request(server)
			.put('/site/profile')
			.set('Cookie', adminCookie)
			.send({ ...profile, name: '', email: 'nope' })
			.expect(400);
		expect(bad.body.message).toEqual(['이름을(를) 입력해 주세요.', '이메일 주소가 올바르지 않습니다.']);
	});

	it('저장하면 누구나 읽고, 관리자가 쓴 댓글·메시지와 주인 안내의 이름이 바뀐다. 지우면 기본값으로', async () => {
		const saved = await request(server).put('/site/profile').set('Cookie', adminCookie).send(profile).expect(200);
		expect(saved.body.profile).toEqual(profile);
		expect(saved.body.updatedAt).not.toBeNull();
		expect((await request(server).get('/site').expect(200)).body.profile.name).toBe('홍길동');

		const comment = await request(server)
			.post('/posts/cra-to-vite/comments')
			.set('Cookie', adminCookie)
			.send({ body: '바뀐 이름' })
			.expect(201);
		expect(comment.body.name).toBe('홍길동');
		const threads = await request(server).get('/messages/threads').expect(200);
		expect(threads.body[0]).toMatchObject({ pinned: true, title: '홍길동' });
		const reply = await request(server)
			.post('/messages/threads/owner')
			.set('Cookie', adminCookie)
			.send({ body: '안녕하세요' })
			.expect(201);
		expect(reply.body.nickname).toBe('홍길동');

		await request(server).delete('/site/profile').expect(401);
		const reset = await request(server).delete('/site/profile').set('Cookie', adminCookie).expect(200);
		expect(reset.body.profile).toBeNull();
		const after = await request(server).get('/messages/threads').expect(200);
		expect(after.body[0].title).toBe('김정현');
	});
});
