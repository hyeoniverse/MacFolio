import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';

process.env.DATABASE_URL ??= 'postgresql://macfolio:macfolio@localhost:5432/macfolio';
process.env.GITHUB_CLIENT_ID = 'test-client-id';
process.env.GITHUB_CLIENT_SECRET = 'test-client-secret';
process.env.AUTH_RATE_LIMIT = '3';

describe('로그인 요청 제한 (e2e)', () => {
	let app: INestApplication;

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
		app = configureApp(moduleRef.createNestApplication());
		await app.init();
	});

	afterAll(async () => {
		await app?.close();
	});

	it('IP마다 1분에 정한 횟수를 넘으면 429 (로그인 시작, 콜백 각각), 다른 API는 막지 않는다', async () => {
		for (let i = 0; i < 3; i++) await request(app.getHttpServer()).get('/auth/github').expect(302);
		const blocked = await request(app.getHttpServer()).get('/auth/github').expect(429);
		expect(blocked.body).toMatchObject({ statusCode: 429, error: 'Too Many Requests' });
		// 콜백도 따로 같은 제한을 받는다 (경로마다 센다). state가 없어 400이다가 제한을 넘으면 429
		for (let i = 0; i < 3; i++) await request(app.getHttpServer()).get('/auth/github/callback').expect(400);
		await request(app.getHttpServer()).get('/auth/github/callback').expect(429);

		await request(app.getHttpServer()).get('/health').expect(200);
		await request(app.getHttpServer()).get('/auth/me').expect(401);
	});

	it('프록시를 믿지 않으면 X-Forwarded-For를 바꿔도 제한을 피할 수 없다', async () => {
		await request(app.getHttpServer()).get('/auth/github').set('X-Forwarded-For', '203.0.113.9').expect(429);
	});
});
