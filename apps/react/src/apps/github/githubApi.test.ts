import { describe, expect, it, vi } from 'vitest';
import { githubStore, loadGithub, toGithubData } from './githubApi';
import { GITHUB_SNAPSHOT } from './githubProfile';

const snapshotRepo = (name: string) => GITHUB_SNAPSHOT.repos.find((repo) => repo.name === name)!;

const SERVER = {
	profile: {
		login: 'hyeoniverse',
		name: 'KIMJEONGHYEON',
		avatarUrl: 'https://avatars.githubusercontent.com/u/1',
		bio: null,
		location: 'Seoul',
		website: 'javascript:alert(1)',
		url: 'https://github.com/hyeoniverse',
		followers: 7,
		following: 9,
		publicRepos: 21,
	},
	readme: '# 안녕하세요',
	readmeBaseUrl: 'https://raw.githubusercontent.com/hyeoniverse/hyeoniverse/HEAD/',
	repos: [
		{ ...snapshotRepo('QRU'), stars: 3 },
		{ ...snapshotRepo('SproutFarm'), url: 'javascript:alert(1)' },
		{ ...snapshotRepo('DevCourse-FullStack'), homepage: 'data:text/html,x' },
	],
};

describe('toGithubData', () => {
	it('서버 값을 받되, http(s)가 아닌 주소는 버린다 (링크로 그리므로)', () => {
		const data = toGithubData(SERVER)!;
		expect(data.profile).toMatchObject({ followers: 7, following: 9, publicRepos: 21, website: null });
		expect(data.repos.map((repo) => repo.fullName)).toEqual(['hyeoniverse/QRU', 'hyeoniverse/DevCourse-FullStack']);
		expect(data.repos[1].homepage).toBeNull();
		expect(data.readme).toBe('# 안녕하세요');
	});

	it('모양이 틀리면 null', () => {
		expect(toGithubData(null)).toBeNull();
		expect(toGithubData({ profile: { login: 'x' }, repos: [] })).toBeNull();
		expect(toGithubData({ ...SERVER, repos: 'nope' })).toBeNull();
	});
});

describe('loadGithub', () => {
	it('API 주소가 없으면 묻지 않고 스냅샷을 둔다', async () => {
		const fetchImpl = vi.fn();
		await loadGithub('', fetchImpl as unknown as typeof fetch);
		expect(fetchImpl).not.toHaveBeenCalled();
		expect(githubStore.getState().source).toBe('snapshot');
	});

	it('서버에 닿지 않으면 스냅샷을 그대로, 받으면 서버 값으로', async () => {
		const down = vi.fn(async () => {
			throw new TypeError('Failed to fetch');
		}) as unknown as typeof fetch;
		await loadGithub('http://api', down);
		expect(githubStore.getState()).toEqual({ source: 'snapshot', data: GITHUB_SNAPSHOT });

		const ok = vi.fn(async () => new Response(JSON.stringify(SERVER))) as unknown as typeof fetch;
		await loadGithub('http://api', ok);
		expect(ok).toHaveBeenCalledWith('http://api/github/profile');
		expect(githubStore.getState().source).toBe('live');
		expect(githubStore.getState().data.profile.followers).toBe(7);
	});
});
