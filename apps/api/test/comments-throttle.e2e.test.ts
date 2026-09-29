import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

process.env.DATABASE_URL ??= 'postgresql://macfolio:macfolio@localhost:5432/macfolio';
process.env.COMMENT_RATE_LIMIT = '2';
process.env.AUTH_RATE_LIMIT = '1000';

describe('댓글 요청 제한 (e2e)', () => {
	let app: INestApplication;

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
		app = configureApp(moduleRef.createNestApplication());
		await app.init();
	});

	afterAll(async () => {
		await app.get(PrismaService).postComment.deleteMany();
		await app?.close();
	});

	it('IP마다 1분에 정한 횟수를 넘으면 429, 읽기는 막지 않는다', async () => {
		const comment = { name: '민수', password: '1234', body: '도배' };
		await request(app.getHttpServer()).post('/posts/cra-to-vite/comments').send(comment).expect(201);
		await request(app.getHttpServer()).post('/posts/cra-to-vite/comments').send(comment).expect(201);
		const blocked = await request(app.getHttpServer()).post('/posts/cra-to-vite/comments').send(comment).expect(429);
		expect(blocked.body.error).toBe('Too Many Requests');
		await request(app.getHttpServer()).get('/posts/cra-to-vite/comments').expect(200);
		// 로그인 제한과는 따로 센다
		await request(app.getHttpServer()).get('/auth/me').expect(401);
	});
});
