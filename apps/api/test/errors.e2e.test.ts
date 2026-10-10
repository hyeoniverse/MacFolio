import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PostsService } from '../src/posts/posts.service.js';

// 오류 응답의 모양과 서버 로그. 어떤 입력에도 500 대신 맞는 4xx로 답하고, 500일 때는 내용(스택·DB 주소)이 밖으로 나가지 않으며
// 로그에는 비밀 값이 가려져 남는다 (common/http-error.filter.ts, common/safe-logger.ts)
process.env.DATABASE_URL ??= 'postgresql://macfolio:macfolio@localhost:5432/macfolio';
process.env.GITHUB_CLIENT_ID = 'test-client-id';
process.env.GITHUB_CLIENT_SECRET = 'test-client-secret';
process.env.ADMIN_GITHUB_ID = '68999618';
process.env.COMMENT_RATE_LIMIT = '1000';
process.env.EVENTS_RATE_LIMIT = '1000';

const DB_FAILURE =
	"Can't reach database server at postgresql://macfolio:s3cret@db:5432/macfolio (user minsu@example.com)";

describe('오류 응답과 로그 (e2e)', () => {
	let app: INestApplication;
	let listPosts: ReturnType<typeof vi.fn>;
	const server = () => app.getHttpServer();
	const logged: string[] = [];

	beforeAll(async () => {
		listPosts = vi.fn();
		const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
			.overrideProvider(PostsService)
			.useValue({ listPublic: listPosts })
			.compile();
		app = configureApp(moduleRef.createNestApplication());
		await app.init();
		vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
			logged.push(String(chunk));
			return true;
		});
		vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
			logged.push(String(chunk));
			return true;
		});
	});

	beforeEach(() => {
		logged.length = 0;
	});

	afterAll(async () => {
		vi.restoreAllMocks();
		await app?.close();
	});

	it('모든 오류 응답은 같은 모양이다 (404, 405에 해당하는 요청)', async () => {
		const missing = await request(server()).get('/nope').expect(404);
		expect(missing.body).toEqual({
			statusCode: 404,
			error: 'Not Found',
			message: 'Cannot GET /nope',
			path: '/nope',
			timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
		});
		await request(server()).delete('/health').expect(404);
		expect(logged).toEqual([]); // 4xx는 로그에 남기지 않는다
	});

	it('몸통이 너무 크면 500이 아니라 413 (JSON 100KB, 분석 이벤트 text 32KB)', async () => {
		const json = await request(server())
			.post('/posts/x/comments')
			.set('Content-Type', 'application/json')
			.send(JSON.stringify({ body: 'a'.repeat(200_000) }))
			.expect(413);
		expect(json.body).toMatchObject({ statusCode: 413, error: 'Payload Too Large', message: '요청이 너무 큽니다.' });
		const text = await request(server())
			.post('/analytics/events')
			.set('Content-Type', 'text/plain')
			.send('a'.repeat(40_000))
			.expect(413);
		expect(text.body).toMatchObject({ statusCode: 413, path: '/analytics/events' });
		expect(logged).toEqual([]);
	});

	it('깨진 JSON은 400', async () => {
		const response = await request(server())
			.post('/posts/x/comments')
			.set('Content-Type', 'application/json')
			.send('{"name": ')
			.expect(400);
		// NestJS가 body-parser의 파싱 오류를 400 HttpException으로 바꿔 준다. 스택은 나가지 않는다
		expect(response.body).toMatchObject({ statusCode: 400, error: 'Bad Request', path: '/posts/x/comments' });
		expect(JSON.stringify(response.body)).not.toMatch(/\bat \w+|node_modules/);
	});

	it('서버 안의 오류(DB 등)는 내용을 감춘 500으로 답하고, 로그에는 비밀 값을 가려서 남긴다', async () => {
		listPosts.mockRejectedValueOnce(new Error(DB_FAILURE));
		const response = await request(server()).get('/posts').expect(500);
		expect(response.body).toEqual({
			statusCode: 500,
			error: 'Internal Server Error',
			message: '서버에서 문제가 생겼습니다.',
			path: '/posts',
			timestamp: expect.any(String),
		});
		expect(response.headers['x-powered-by']).toBeUndefined();

		const log = logged.join('\n');
		expect(log).toContain('GET /posts → 500');
		expect(log).toContain("Can't reach database server");
		expect(log).toContain('postgresql://macfolio:***@db:5432/macfolio');
		expect(log).toContain('m***@example.com');
		expect(log).not.toContain('s3cret');
		expect(log).not.toContain('minsu@');
	});
});
