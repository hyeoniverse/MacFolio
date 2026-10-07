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

const SRC = '/imgs/projects/qru/screenshot.jpg';

describe('사진 캡션 (e2e)', () => {
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
		await prisma.photoCaption.deleteMany();
	});

	afterAll(async () => {
		await prisma?.photoCaption.deleteMany();
		await app?.close();
	});

	it('처음에는 고친 캡션이 없다 (누구나 읽는다)', async () => {
		const response = await request(server()).get('/photos/captions').expect(200);
		expect(response.body).toEqual({});
	});

	it('방문자는 고칠 수 없다', async () => {
		await request(server()).put('/photos/captions').send({ src: SRC, caption: '바꿈' }).expect(401);
		expect(await prisma.photoCaption.count()).toBe(0);
	});

	it('관리자가 고치면 누구나 그 캡션을 받고, 다시 고치면 바뀐다. 누가 바꿨는지 남는다', async () => {
		const saved = await request(server())
			.put('/photos/captions')
			.set('Cookie', adminCookie)
			.send({ src: SRC, caption: '  QR 명함 첫 화면 ' })
			.expect(200);
		expect(saved.body).toEqual({ [SRC]: 'QR 명함 첫 화면' });
		expect((await request(server()).get('/photos/captions').expect(200)).body).toEqual({ [SRC]: 'QR 명함 첫 화면' });

		await request(server())
			.put('/photos/captions')
			.set('Cookie', adminCookie)
			.send({ src: SRC, caption: '다시' })
			.expect(200);
		const row = await prisma.photoCaption.findUnique({ where: { src: SRC } });
		expect(row).toMatchObject({ caption: '다시', updatedBy: 'hyeoniverse' });
	});

	it('캡션을 비우면 고친 것을 지워 원래 캡션으로 돌아간다', async () => {
		await request(server())
			.put('/photos/captions')
			.set('Cookie', adminCookie)
			.send({ src: SRC, caption: '바꿈' })
			.expect(200);
		const cleared = await request(server())
			.put('/photos/captions')
			.set('Cookie', adminCookie)
			.send({ src: SRC, caption: '  ' })
			.expect(200);
		expect(cleared.body).toEqual({});
		expect(await prisma.photoCaption.count()).toBe(0);
	});

	it('잘못된 주소, 너무 긴 캡션은 400', async () => {
		for (const body of [
			{ src: 'a.jpg', caption: '설명' },
			{ src: '//evil.com/a.jpg', caption: '설명' },
			{ src: SRC, caption: '가'.repeat(201) },
			{ src: SRC },
		])
			await request(server()).put('/photos/captions').set('Cookie', adminCookie).send(body).expect(400);
		expect(await prisma.photoCaption.count()).toBe(0);
	});
});
