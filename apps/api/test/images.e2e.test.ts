import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { GithubClient } from '../src/auth/github.client.js';
import { StockPhotoClient } from '../src/images/stock.client.js';

process.env.DATABASE_URL ??= 'postgresql://macfolio:macfolio@localhost:5432/macfolio';
process.env.GITHUB_CLIENT_ID = 'test-client-id';
process.env.GITHUB_CLIENT_SECRET = 'test-client-secret';
process.env.ADMIN_GITHUB_ID = '68999618';
process.env.AUTH_RATE_LIMIT = '1000';

const fakeGithub: Partial<GithubClient> = {
	exchangeCode: async () => 'token',
	getUser: async () => ({ id: 68999618, login: 'hyeoniverse', avatarUrl: '' }),
};

process.env.UNSPLASH_ACCESS_KEY = 'test-unsplash-key';
delete process.env.PEXELS_API_KEY;

const calls: string[] = [];
const fakeStock: Partial<StockPhotoClient> = {
	searchUnsplash: async (key, q, page) => {
		calls.push(`search ${key} ${q} ${page}`);
		return {
			total_pages: 2,
			results: [
				{
					id: 'abc',
					width: 4000,
					height: 3000,
					alt_description: 'a cat',
					urls: { regular: 'https://images.unsplash.com/r', small: 'https://images.unsplash.com/s' },
					links: { html: 'https://unsplash.com/photos/abc' },
					user: { name: 'Jane', links: { html: 'https://unsplash.com/@jane' } },
				},
			],
		};
	},
	trackUnsplashDownload: async (key, id) => {
		calls.push(`download ${key} ${id}`);
	},
};

describe('사진 찾기 (e2e)', () => {
	let app: INestApplication;
	let adminCookie: string;
	const server = () => app.getHttpServer();

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
			.overrideProvider(GithubClient)
			.useValue(fakeGithub)
			.overrideProvider(StockPhotoClient)
			.useValue(fakeStock)
			.compile();
		app = configureApp(moduleRef.createNestApplication());
		await app.init();

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

	afterAll(async () => {
		await app?.close();
	});

	it('관리자만 쓴다 (401)', async () => {
		await request(server()).get('/images/providers').expect(401);
		await request(server()).get('/images/search').query({ provider: 'unsplash', q: 'cat' }).expect(401);
		await request(server()).post('/images/unsplash/abc/download').expect(401);
		expect(calls).toEqual([]);
	});

	it('키가 있는 서비스만 켜져 있다', async () => {
		const response = await request(server()).get('/images/providers').set('Cookie', adminCookie).expect(200);
		expect(response.body).toEqual({ unsplash: true, pexels: false });
	});

	it('서버의 키로 찾고 한 모양으로 돌려준다. 키는 응답에 없다', async () => {
		const response = await request(server())
			.get('/images/search')
			.query({ provider: 'unsplash', q: '고양이', page: 2 })
			.set('Cookie', adminCookie)
			.expect(200);
		expect(calls).toContain('search test-unsplash-key 고양이 2');
		expect(response.body.hasMore).toBe(false);
		expect(response.body.results[0]).toMatchObject({ provider: 'unsplash', id: 'abc', author: 'Jane', alt: 'a cat' });
		expect(JSON.stringify(response.body)).not.toContain('test-unsplash-key');
	});

	it('키가 없으면 503, 잘못된 요청은 400', async () => {
		const missing = await request(server())
			.get('/images/search')
			.query({ provider: 'pexels', q: 'cat' })
			.set('Cookie', adminCookie)
			.expect(503);
		expect(JSON.stringify(missing.body)).toContain('PEXELS_API_KEY');
		await request(server())
			.get('/images/search')
			.query({ provider: 'x', q: '' })
			.set('Cookie', adminCookie)
			.expect(400);
	});

	it('글에 넣은 Unsplash 사진은 내려받음을 알린다', async () => {
		await request(server()).post('/images/unsplash/abc/download').set('Cookie', adminCookie).expect(204);
		expect(calls).toContain('download test-unsplash-key abc');
		await request(server()).post('/images/unsplash/a%20b/download').set('Cookie', adminCookie).expect(400);
	});
});
