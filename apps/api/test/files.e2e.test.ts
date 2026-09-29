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

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

describe('이미지·첨부 파일 (e2e)', () => {
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
		await prisma.upload.deleteMany();
	});

	afterAll(async () => {
		await app?.close();
	});

	it('관리자가 아니면 올릴 수 없다 (401)', async () => {
		await request(server()).post('/files').attach('file', PNG, 'a.png').expect(401);
		expect(await prisma.upload.count()).toBe(0);
	});

	it('이미지는 파일 앞부분으로 확인해 바로 보이게 내려주고, 다른 주소의 <img>에서도 불러온다', async () => {
		const uploaded = await request(server())
			.post('/files')
			.set('Cookie', adminCookie)
			// 형식 이름을 속여도 내용으로 판단한다
			.attach('file', PNG, { filename: '스크린샷.png', contentType: 'application/octet-stream' })
			.expect(201);
		expect(uploaded.body).toMatchObject({ name: '스크린샷.png', type: 'image/png', size: PNG.length, image: true });
		expect(uploaded.body.path).toMatch(/^\/files\/[\w-]{16}$/);

		const file = await request(server()).get(uploaded.body.path).expect(200);
		expect(file.headers['content-type']).toBe('image/png');
		expect(file.headers['content-disposition']).toMatch(/^inline;/);
		expect(file.headers['cross-origin-resource-policy']).toBe('cross-origin');
		expect(file.headers['x-content-type-options']).toBe('nosniff');
		expect(Buffer.compare(file.body as Buffer, PNG)).toBe(0);
	});

	it('이미지가 아닌 파일(HTML 등)은 이 주소에서 열리지 않고 원래 이름으로 내려받는다', async () => {
		const html = Buffer.from('<script>alert(1)</script>');
		const uploaded = await request(server())
			.post('/files')
			.set('Cookie', adminCookie)
			.attach('file', html, { filename: '보고서.html', contentType: 'text/html' })
			.expect(201);
		expect(uploaded.body).toMatchObject({ name: '보고서.html', type: 'text/html', image: false });

		const file = await request(server()).get(uploaded.body.path).expect(200);
		expect(file.headers['content-disposition']).toBe(
			`attachment; filename="___.html"; filename*=UTF-8''${encodeURIComponent('보고서.html')}`
		);
		expect(file.headers['content-security-policy']).toContain('sandbox');
	});

	it('빈 요청은 400, 10MB가 넘으면 413, 없는 파일은 404', async () => {
		await request(server()).post('/files').set('Cookie', adminCookie).expect(400);
		await request(server())
			.post('/files')
			.set('Cookie', adminCookie)
			.attach('file', Buffer.alloc(10 * 1024 * 1024 + 1), 'big.bin')
			.expect(413);
		expect(await prisma.upload.count()).toBe(0);
		await request(server()).get('/files/aaaaaaaaaaaaaaaa').expect(404);
		await request(server()).get('/files/../etc').expect(404);
	});
});
