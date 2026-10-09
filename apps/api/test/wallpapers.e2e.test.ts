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
process.env.UPLOAD_RATE_LIMIT = '1000';
process.env.WRITE_RATE_LIMIT = '1000';

const fakeGithub: Partial<GithubClient> = {
	exchangeCode: async () => 'token',
	getUser: async () => ({ id: 68999618, login: 'hyeoniverse', avatarUrl: '' }),
};

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 4, 5, 6]);

describe('배경화면 (e2e)', () => {
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
		await prisma.wallpaper.deleteMany();
		await prisma.upload.deleteMany();
	});

	afterAll(async () => {
		await prisma?.wallpaper.deleteMany();
		await prisma?.upload.deleteMany();
		await app?.close();
	});

	const upload = (fields: { name?: string } = {}, cookie = adminCookie) => {
		const req = request(server()).post('/wallpapers').set('Cookie', cookie);
		if (fields.name !== undefined) req.field('name', fields.name);
		return req
			.attach('image', JPEG, { filename: '제주 바다.jpg', contentType: 'image/jpeg' })
			.attach('thumbnail', PNG, { filename: 'thumb.png', contentType: 'image/png' });
	};

	it('처음에는 비어 있고, 누구나 목록을 본다', async () => {
		const list = await request(server()).get('/wallpapers').expect(200);
		expect(list.body).toEqual([]);
	});

	it('관리자가 아니면 올리거나 지울 수 없다 (401)', async () => {
		await upload({}, '').expect(401);
		await request(server()).delete('/wallpapers/aaaaaaaaaaaaaaaa').expect(401);
		expect(await prisma.wallpaper.count()).toBe(0);
	});

	it('관리자가 올리면 목록에 생기고, 원본·썸네일을 /files로 받는다. 이름이 없으면 파일 이름', async () => {
		const created = await upload().expect(201);
		expect(created.body).toMatchObject({ name: '제주 바다' });
		expect(created.body).not.toHaveProperty('kind');
		expect(created.body.image).toMatch(/^\/files\/[\w-]{16}$/);
		expect(created.body.thumbnail).toMatch(/^\/files\/[\w-]{16}$/);

		const image = await request(server()).get(created.body.image).expect(200);
		expect(image.headers['content-type']).toBe('image/jpeg');
		const thumb = await request(server()).get(created.body.thumbnail).expect(200);
		expect(thumb.headers['content-type']).toBe('image/png');

		await upload({ name: '  노을  ' }).expect(201);
		const list = await request(server()).get('/wallpapers').expect(200);
		expect(list.body.map((w: { name: string }) => w.name)).toEqual(['제주 바다', '노을']);
	});

	it('이미지가 빠졌거나 이미지가 아니면 400', async () => {
		await request(server()).post('/wallpapers').set('Cookie', adminCookie).attach('image', JPEG, 'a.jpg').expect(400);
		await request(server())
			.post('/wallpapers')
			.set('Cookie', adminCookie)
			.attach('image', Buffer.from('<svg/>'), 'a.svg')
			.attach('thumbnail', PNG, 'b.png')
			.expect(400);
		expect(await prisma.wallpaper.count()).toBe(0);
		expect(await prisma.upload.count()).toBe(0);
	});

	it('관리자는 이름을 바꾼다. 빈 이름은 400, 관리자가 아니면 401', async () => {
		const created = await upload().expect(201);
		const path = `/wallpapers/${created.body.id}`;
		await request(server()).patch(path).send({ name: '바다' }).expect(401);
		await request(server()).patch(path).set('Cookie', adminCookie).send({ name: '   ' }).expect(400);
		const renamed = await request(server())
			.patch(path)
			.set('Cookie', adminCookie)
			.send({ name: '  제주 바다  ' })
			.expect(200);
		expect(renamed.body).toMatchObject({ id: created.body.id, name: '제주 바다', image: created.body.image });
		await request(server())
			.patch('/wallpapers/aaaaaaaaaaaaaaaa')
			.set('Cookie', adminCookie)
			.send({ name: 'x' })
			.expect(404);
	});

	it('지우면 목록에서 빠지고 이미지 두 장도 함께 지운다', async () => {
		const created = await upload().expect(201);
		expect(await prisma.upload.count()).toBe(2);
		await request(server()).delete(`/wallpapers/${created.body.id}`).set('Cookie', adminCookie).expect(204);
		expect((await request(server()).get('/wallpapers').expect(200)).body).toEqual([]);
		expect(await prisma.upload.count()).toBe(0);
		await request(server()).get(created.body.image).expect(404);
		await request(server()).delete(`/wallpapers/${created.body.id}`).set('Cookie', adminCookie).expect(404);
	});
});
