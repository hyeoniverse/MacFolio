import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

process.env.DATABASE_URL ??= 'postgresql://macfolio:macfolio@localhost:5432/macfolio';
process.env.LIKE_RATE_LIMIT = '2';
process.env.COMMENT_RATE_LIMIT = '1000';
process.env.AUTH_RATE_LIMIT = '1000';

describe('좋아요 요청 제한 (e2e)', () => {
	let app: INestApplication;

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
		app = configureApp(moduleRef.createNestApplication());
		await app.init();
	});

	afterAll(async () => {
		const prisma = app.get(PrismaService);
		await prisma.postLike.deleteMany();
		await prisma.postComment.deleteMany();
		await app?.close();
	});

	it('IP마다 1분에 정한 횟수를 넘으면 429, 읽기와 댓글은 따로 센다', async () => {
		// 누르기는 경로마다 센다 (요청 제한은 경로·IP마다)
		await request(app.getHttpServer()).put('/posts/cra-to-vite/like').expect(200);
		await request(app.getHttpServer()).put('/posts/cra-to-vite/like').expect(200);
		const blocked = await request(app.getHttpServer()).put('/posts/cra-to-vite/like').expect(429);
		expect(blocked.body.error).toBe('Too Many Requests');
		await request(app.getHttpServer()).get('/posts/cra-to-vite/likes').expect(200);
		await request(app.getHttpServer()).post('/posts/cra-to-vite/comments').send({ body: '따로' }).expect(201);
	});
});
