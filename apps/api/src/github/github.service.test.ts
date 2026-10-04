import { describe, expect, it } from 'vitest';
import { loadConfig } from '../config.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { fakeGithubApi } from './github-api.fake.js';
import { GithubService } from './github.service.js';
import { DEFAULT_SHOWCASE } from './showcase.js';

/** 고른 저장소 행 흉내 */
function fakePrisma(row: { repos: string[] } | null = null) {
	let current = row;
	return {
		githubShowcase: {
			findUnique: async () => current,
			upsert: async ({ create }: { create: { repos: string[] } }) => (current = { repos: create.repos }),
		},
	} as unknown as PrismaService;
}

const config = loadConfig({ DATABASE_URL: 'postgresql://x' });
const MINUTE = 60 * 1000;

describe('GithubService', () => {
	it('고른 적이 없으면 기본 목록을 고른 순서대로, 내 저장소 목록에 있는 것은 따로 묻지 않는다', async () => {
		const { state, client } = fakeGithubApi();
		const service = new GithubService(fakePrisma(), client, config);
		const result = await service.profile(0);

		expect(result.repos.map((repo) => repo.fullName)).toEqual(DEFAULT_SHOWCASE);
		expect(result.profile).toMatchObject({ login: 'hyeoniverse', followers: 7, following: 9, publicRepos: 21 });
		expect(result.readme).toContain('# 안녕하세요');
		expect(result.readmeBaseUrl).toBe('https://raw.githubusercontent.com/hyeoniverse/hyeoniverse/HEAD/');
		// 계정·README·내 저장소 3번 + 목록에 없는 저장소(조직 2개, DevCourse-FullStack) 3번
		expect(state.calls).toBe(6);
	});

	it('받은 값을 토큰이 없으면 30분 동안 들고 있고, 그 뒤에 새로 받는다', async () => {
		const { state, client } = fakeGithubApi();
		const service = new GithubService(fakePrisma({ repos: ['hyeoniverse/QRU'] }), client, config);
		await service.profile(0);
		const calls = state.calls;

		await service.profile(29 * MINUTE);
		expect(state.calls).toBe(calls);
		await service.profile(31 * MINUTE);
		expect(state.calls).toBe(calls * 2);
	});

	it('토큰이 있으면 10분마다 새로 받는다', () => {
		const withToken = loadConfig({ DATABASE_URL: 'postgresql://x', GITHUB_TOKEN: 'token' });
		expect(new GithubService(fakePrisma(), fakeGithubApi().client, withToken).ttlMs).toBe(10 * MINUTE);
	});

	it('동시에 여럿이 물어도 GitHub에는 한 번만 묻는다', async () => {
		const { state, client } = fakeGithubApi();
		const service = new GithubService(fakePrisma({ repos: [] }), client, config);
		await Promise.all([service.profile(0), service.profile(0), service.profile(0)]);
		expect(state.calls).toBe(3);
	});

	it('GitHub에 닿지 못하면 마지막으로 받은 값을 주고, 받은 값이 없으면 실패한다', async () => {
		const { state, client } = fakeGithubApi();
		const service = new GithubService(fakePrisma({ repos: ['hyeoniverse/QRU'] }), client, config);
		state.down = true;
		await expect(service.profile(0)).rejects.toThrow();

		state.down = false;
		const first = await service.profile(0);
		state.down = true;
		await expect(service.profile(60 * MINUTE)).resolves.toBe(first);
	});

	it('지워졌거나 비공개가 된 저장소는 빠진다', async () => {
		const { client } = fakeGithubApi();
		const service = new GithubService(
			fakePrisma({ repos: ['hyeoniverse/secret', 'gone/away', 'hyeoniverse/QRU'] }),
			client,
			config
		);
		expect((await service.profile(0)).repos.map((repo) => repo.fullName)).toEqual(['hyeoniverse/QRU']);
	});

	it('저장하면 GitHub에 적힌 이름으로 두고, 다음에 물을 때 새로 받는다', async () => {
		const { state, client } = fakeGithubApi();
		const service = new GithubService(fakePrisma({ repos: ['hyeoniverse/QRU'] }), client, config);
		await service.profile(0);
		await expect(
			service.saveShowcase({ repos: ['someone/library', 'hyeoniverse/QRU'] }, 'hyeoniverse')
		).resolves.toEqual({ repos: ['someone/Library', 'hyeoniverse/QRU'] });
		const after = await service.profile(1);
		expect(after.repos.map((repo) => repo.fullName)).toEqual(['someone/Library', 'hyeoniverse/QRU']);

		// 새로 받지 못하면 저장하기 전 값이라도 준다
		state.down = true;
		await service.saveShowcase({ repos: ['hyeoniverse/QRU'] }, 'hyeoniverse');
		await expect(service.profile(2)).resolves.toBe(after);
	});
});

describe('GithubService.activity', () => {
	it('기여 달력과 보여 줄 활동만 최근 것부터 준다', async () => {
		const { client } = fakeGithubApi();
		const result = await new GithubService(fakePrisma(), client, config).activity(0);
		expect(result.contributions).toEqual({
			total: 15,
			days: [
				{ date: '2026-09-27', level: 0, count: 0 },
				{ date: '2026-09-28', level: 2, count: 3 },
				{ date: '2026-09-29', level: 4, count: 12 },
			],
		});
		expect(result.events.map((item) => [item.kind, item.action])).toEqual([
			['push', null],
			['pull', 'merged'],
		]);
	});

	it('프로필을 이미 받았으면 계정을 다시 묻지 않고, 받은 값은 프로필과 같은 시간 동안 들고 있다', async () => {
		const { state, client } = fakeGithubApi();
		const service = new GithubService(fakePrisma({ repos: [] }), client, config);
		await service.profile(0);
		const calls = state.calls;
		await service.activity(0);
		// 기여 달력, 이벤트
		expect(state.calls).toBe(calls + 2);
		await service.activity(29 * MINUTE);
		expect(state.calls).toBe(calls + 2);
		await service.activity(31 * MINUTE);
		expect(state.calls).toBe(calls + 4);
	});

	it('기여 달력만 받지 못하면 그 부분은 이전 값을, 둘 다 받지 못하면 마지막 값을 준다', async () => {
		const { state, client } = fakeGithubApi();
		const service = new GithubService(fakePrisma(), client, config);
		const first = await service.activity(0);

		state.contributionsDown = true;
		state.events = [];
		const partial = await service.activity(31 * MINUTE);
		expect(partial.contributions).toEqual(first.contributions);
		expect(partial.events).toEqual([]);

		state.down = true;
		expect(await service.activity(62 * MINUTE)).toEqual(partial);
	});

	it('받은 값이 없는데 GitHub에 닿지 못하면 실패한다', async () => {
		const { state, client } = fakeGithubApi();
		state.down = true;
		await expect(new GithubService(fakePrisma(), client, config).activity(0)).rejects.toThrow();
	});
});
