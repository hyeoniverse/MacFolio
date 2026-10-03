import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { GithubClient } from '../src/auth/github.client.js';
import { GithubApiClient } from '../src/github/github-api.client.js';
import { fakeGithubApi } from '../src/github/github-api.fake.js';
import { GithubService } from '../src/github/github.service.js';
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

describe('GitHub 앱 (e2e)', () => {
	let app: INestApplication;
	let prisma: PrismaService;
	let adminCookie: string;
	const api = fakeGithubApi();
	const server = () => app.getHttpServer();

	beforeAll(async () => {
		const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
			.overrideProvider(GithubClient)
			.useValue(fakeGithub)
			.overrideProvider(GithubApiClient)
			.useValue(api.client)
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
		await prisma.githubShowcase.deleteMany();
		// 시험마다 GitHub에서 새로 받게 한다
		app.get(GithubService).clearCache();
	});

	afterAll(async () => {
		await app?.close();
	});

	it('누구나 프로필·README·고른 저장소를 받는다 (고른 적 없으면 기본 목록)', async () => {
		const response = await request(server()).get('/github/profile').expect(200);
		expect(response.body.profile).toMatchObject({ login: 'hyeoniverse', followers: 7, following: 9 });
		expect(response.body.readme).toContain('# 안녕하세요');
		expect(response.body.repos.map((repo: { fullName: string }) => repo.fullName)).toEqual([
			'Devcourse-NewPick/front',
			'Devcourse-WhatToDo/todo-front',
			'hyeoniverse/QRU',
			'hyeoniverse/SproutFarm',
			'hyeoniverse/DevCourse-FullStack',
		]);
	});

	it('고르기는 관리자만', async () => {
		await request(server()).get('/github/candidates').expect(401);
		await request(server()).get('/github/repos/someone/Library').expect(401);
		await request(server()).put('/github/showcase').send({ repos: [] }).expect(401);
	});

	it('고를 수 있는 저장소: 고른 것 가운데 목록에 없는 것 → 내 저장소 → 조직 저장소 (비공개는 뺀다)', async () => {
		const response = await request(server()).get('/github/candidates').set('Cookie', adminCookie).expect(200);
		expect(response.body.selected).toHaveLength(5);
		expect(response.body.repos.map((repo: { fullName: string }) => repo.fullName)).toEqual([
			'Devcourse-WhatToDo/todo-front',
			'hyeoniverse/DevCourse-FullStack',
			'hyeoniverse/QRU',
			'hyeoniverse/SproutFarm',
			'Devcourse-NewPick/front',
		]);
	});

	it('직접 입력한 저장소를 찾는다. 없으면 404', async () => {
		const found = await request(server()).get('/github/repos/someone/library').set('Cookie', adminCookie).expect(200);
		expect(found.body).toMatchObject({ fullName: 'someone/Library', description: 'Library 설명' });
		await request(server()).get('/github/repos/someone/nothing').set('Cookie', adminCookie).expect(404);
		await request(server()).get('/github/repos/hyeoniverse/secret').set('Cookie', adminCookie).expect(404);
	});

	it('고른 저장소를 저장하면 GitHub 앱에 그 순서로 보인다', async () => {
		const saved = await request(server())
			.put('/github/showcase')
			.set('Cookie', adminCookie)
			.send({ repos: ['hyeoniverse/sproutfarm', 'someone/Library'] })
			.expect(200);
		expect(saved.body).toEqual({ repos: ['hyeoniverse/SproutFarm', 'someone/Library'] });
		const row = await prisma.githubShowcase.findUnique({ where: { id: 1 } });
		expect(row?.updatedBy).toBe('hyeoniverse');

		const profile = await request(server()).get('/github/profile').expect(200);
		expect(profile.body.repos.map((repo: { fullName: string }) => repo.fullName)).toEqual([
			'hyeoniverse/SproutFarm',
			'someone/Library',
		]);
	});

	it('잘못된 이름·없는 저장소·7개 이상은 저장하지 않는다', async () => {
		await request(server())
			.put('/github/showcase')
			.set('Cookie', adminCookie)
			.send({ repos: ['nope'] })
			.expect(400);
		await request(server())
			.put('/github/showcase')
			.set('Cookie', adminCookie)
			.send({ repos: ['someone/nothing'] })
			.expect(404);
		const many = Array.from({ length: 7 }, (_, index) => `hyeoniverse/r${index}`);
		await request(server()).put('/github/showcase').set('Cookie', adminCookie).send({ repos: many }).expect(400);
		expect(await prisma.githubShowcase.count()).toBe(0);
	});

	it('GitHub에 닿지 못하고 받은 값도 없으면 502', async () => {
		api.state.down = true;
		try {
			await request(server()).get('/github/profile').expect(502);
			await request(server()).get('/github/activity').expect(502);
		} finally {
			api.state.down = false;
		}
	});

	it('누구나 기여 달력과 최근 공개 활동을 받는다', async () => {
		const response = await request(server()).get('/github/activity').expect(200);
		expect(response.body.contributions.total).toBe(15);
		expect(response.body.contributions.days).toHaveLength(3);
		expect(response.body.events.map((item: { kind: string }) => item.kind)).toEqual(['push', 'pull']);
		expect(response.body.events[1]).toMatchObject({
			action: 'merged',
			number: 86,
			url: 'https://github.com/hyeoniverse/MacFolio/pull/86',
		});
	});
});
