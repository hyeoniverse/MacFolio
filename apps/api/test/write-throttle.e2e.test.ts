import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { GithubClient } from '../src/auth/github.client.js';

// 로그인·댓글 말고 나머지 쓰기 경로의 요청 제한 (common/rate-limit.ts). 이름마다 따로 세고, 읽기는 막지 않는다
process.env.DATABASE_URL ??= 'postgresql://macfolio:macfolio@localhost:5432/macfolio';
process.env.GITHUB_CLIENT_ID = 'test-client-id';
process.env.GITHUB_CLIENT_SECRET = 'test-client-secret';
process.env.ADMIN_GITHUB_ID = '68999618';
process.env.AUTH_RATE_LIMIT = '1000';
process.env.WRITE_RATE_LIMIT = '2';
process.env.UPLOAD_RATE_LIMIT = '1';
process.env.DEMO_RATE_LIMIT = '1';
process.env.EVENTS_RATE_LIMIT = '2';

const fakeGithub: Partial<GithubClient> = {
	exchangeCode: async () => 'token',
	getUser: async () => ({ id: 68999618, login: 'hyeoniverse', avatarUrl: '' }),
};

describe('쓰기 요청 제한 (e2e)', () => {
	let app: INestApplication;
	let adminCookie: string;
	const server = () => app.getHttpServer();

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
			.overrideProvider(GithubClient)
			.useValue(fakeGithub)
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

	it('관리자 쓰기(write): 경로마다 IP당 정한 횟수를 넘으면 429. 로그인하지 않은 요청도 횟수에 든다', async () => {
		// 틀린 몸통이라 400이지만 제한은 핸들러 전에 센다
		await request(server()).put('/github/showcase').set('Cookie', adminCookie).send({}).expect(400);
		await request(server()).put('/github/showcase').send({}).expect(401);
		const blocked = await request(server()).put('/github/showcase').set('Cookie', adminCookie).send({}).expect(429);
		expect(blocked.body).toMatchObject({ statusCode: 429, error: 'Too Many Requests' });
		// 경로마다 따로 세므로 다른 쓰기 경로와 읽기는 그대로
		await request(server()).put('/photos/captions').set('Cookie', adminCookie).send({}).expect(400);
		await request(server()).get('/posts').expect(200);
		await request(server()).get('/posts/admin').set('Cookie', adminCookie).expect(200);
	});

	it('올리기(upload), 데모(demo), 분석 이벤트(events)는 각각의 횟수로 센다', async () => {
		await request(server()).post('/files').set('Cookie', adminCookie).expect(400);
		await request(server()).post('/files').set('Cookie', adminCookie).expect(429);

		await request(server()).post('/summary').send({}).expect(400);
		await request(server()).post('/summary').send({}).expect(429);

		await request(server()).post('/analytics/events').send({}).expect(400);
		await request(server()).post('/analytics/events').send({}).expect(400);
		await request(server()).post('/analytics/events').send({}).expect(429);
		await request(server()).get('/analytics/today').expect(200);
	});
});
