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

const ORGANIZATION = {
	folders: ['읽을거리'],
	posts: { 'cra-to-vite': '읽을거리' },
	moves: [{ from: '개발기/MacFolio', to: '읽을거리/MacFolio' }],
	pins: { 'read-only-memo': true },
};

describe('메모 정리 내용 (e2e)', () => {
	let app: INestApplication;
	let prisma: PrismaService;
	let adminCookie: string;

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
			.overrideProvider(GithubClient)
			.useValue(fakeGithub)
			.compile();
		app = configureApp(moduleRef.createNestApplication());
		await app.init();
		prisma = app.get(PrismaService);

		// 관리자로 로그인해 세션 쿠키를 받아 둔다
		const start = await request(app.getHttpServer()).get('/auth/github');
		const state = new URL(start.headers.location).searchParams.get('state');
		const stateCookie = ([] as string[]).concat(start.headers['set-cookie'])[0].split(';')[0];
		const callback = await request(app.getHttpServer())
			.get('/auth/github/callback')
			.query({ code: 'x', state })
			.set('Cookie', stateCookie);
		adminCookie = ([] as string[])
			.concat(callback.headers['set-cookie'])
			.find((cookie) => cookie.startsWith('macfolio_session='))!
			.split(';')[0];
	});

	beforeEach(async () => {
		await prisma.memoOrganization.deleteMany();
	});

	afterAll(async () => {
		await app?.close();
	});

	it('처음에는 빈 정리 내용, 누구나 읽는다', async () => {
		const response = await request(app.getHttpServer()).get('/memo/organization').expect(200);
		expect(response.body).toEqual({ folders: [], posts: {}, moves: [], pins: {}, updatedAt: null });
	});

	it('관리자가 아니면 바꿀 수 없다 (401)', async () => {
		await request(app.getHttpServer()).put('/memo/organization').send(ORGANIZATION).expect(401);
		await request(app.getHttpServer())
			.put('/memo/organization')
			.set('Cookie', 'macfolio_session=guess')
			.send(ORGANIZATION)
			.expect(401);
		expect(await prisma.memoOrganization.count()).toBe(0);
	});

	it('관리자는 저장하고, 누구나 저장된 내용을 읽는다', async () => {
		const saved = await request(app.getHttpServer())
			.put('/memo/organization')
			.set('Cookie', adminCookie)
			.send(ORGANIZATION)
			.expect(200);
		expect(saved.body).toMatchObject(ORGANIZATION);
		expect(saved.body.updatedAt).toEqual(expect.any(String));

		const read = await request(app.getHttpServer()).get('/memo/organization').expect(200);
		expect(read.body).toMatchObject(ORGANIZATION);
		const row = await prisma.memoOrganization.findUnique({ where: { id: 1 } });
		expect(row?.updatedBy).toBe('hyeoniverse');
	});

	it('규칙을 어기면 관리자라도 400 (서버에서도 3단 제한)', async () => {
		const response = await request(app.getHttpServer())
			.put('/memo/organization')
			.set('Cookie', adminCookie)
			.send({ ...ORGANIZATION, folders: ['a/b/c/d'] })
			.expect(400);
		expect(response.body.message).toEqual(['폴더는 3단까지입니다: a/b/c/d']);
		expect(await prisma.memoOrganization.count()).toBe(0);
	});
});
