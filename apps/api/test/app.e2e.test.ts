import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';

// 로컬에서는 docker compose의 db (pnpm db:up), CI에서는 서비스 컨테이너
process.env.DATABASE_URL ??= 'postgresql://macfolio:macfolio@localhost:5432/macfolio';
process.env.CORS_ORIGINS = 'https://macfolio.hyeoniverse.com';

describe('API (e2e)', () => {
	let app: INestApplication;

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
		app = configureApp(moduleRef.createNestApplication());
		await app.init();
	});

	afterAll(async () => {
		await app?.close();
	});

	it('GET /health: 서버와 DB가 살아 있다', async () => {
		const response = await request(app.getHttpServer()).get('/health').expect(200);
		expect(response.body).toEqual({ status: 'ok', database: 'up', version: 'dev' });
	});

	it('없는 경로는 정해진 모양의 404', async () => {
		const response = await request(app.getHttpServer()).get('/nope').expect(404);
		expect(response.body).toMatchObject({ statusCode: 404, error: 'Not Found', path: '/nope' });
		expect(response.body.timestamp).toEqual(expect.any(String));
	});

	it('보안 헤더(helmet)가 붙는다', async () => {
		const response = await request(app.getHttpServer()).get('/health');
		expect(response.headers['x-content-type-options']).toBe('nosniff');
		expect(response.headers['x-powered-by']).toBeUndefined();
	});

	it('CORS: 허용한 프론트엔드만', async () => {
		const allowed = await request(app.getHttpServer()).get('/health').set('Origin', 'https://macfolio.hyeoniverse.com');
		expect(allowed.headers['access-control-allow-origin']).toBe('https://macfolio.hyeoniverse.com');
		expect(allowed.headers['access-control-allow-credentials']).toBe('true');

		const other = await request(app.getHttpServer()).get('/health').set('Origin', 'https://evil.example');
		expect(other.headers['access-control-allow-origin']).toBeUndefined();
	});

	it('API 문서(OpenAPI)가 나온다', async () => {
		const response = await request(app.getHttpServer()).get('/docs-json').expect(200);
		expect(response.body.info.title).toBe('MacFolio API');
		expect(Object.keys(response.body.paths)).toContain('/health');
	});
});
