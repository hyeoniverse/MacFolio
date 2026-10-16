import { describe, expect, it } from 'vitest';
import type { SiteProjects } from '@macfolio/desktop-core/site';
import type { SiteService } from '../site/site.service.js';
import { fakeGithubApi } from './github-api.fake.js';
import { LANGUAGES_MISSING_TTL_MS, LANGUAGES_TTL_MS, LanguagesService } from './languages.service.js';

/** 관리자가 저장한 프로젝트 (SiteService.view 흉내). fail이면 DB를 읽지 못한다 */
function fakeSite(projects: SiteProjects | null = null, fail = false) {
	return {
		view: async () => {
			if (fail) throw new Error('DB');
			return { profile: null, projects, updatedAt: null };
		},
	} as unknown as SiteService;
}

const HOUR = 60 * 60 * 1000;

describe('LanguagesService', () => {
	it('코드의 프로젝트 저장소는 언어 비율을 많은 순서로 준다 (대소문자는 가리지 않는다)', async () => {
		const { client } = fakeGithubApi();
		const service = new LanguagesService(fakeSite(), client);
		expect(await service.languages('Hyeoniverse', 'qru', 0)).toEqual([
			{ name: 'TypeScript', bytes: 72_000, percent: 72 },
			{ name: 'CSS', bytes: 20_000, percent: 20 },
			{ name: 'JavaScript', bytes: 7_000, percent: 7 },
			{ name: 'HTML', bytes: 1_000, percent: 1 },
		]);
	});

	it('이 사이트의 프로젝트가 가리키지 않는 저장소는 GitHub에 묻지 않고 404', async () => {
		const { state, client } = fakeGithubApi();
		state.languages['someone/Library'] = { Go: 10 };
		const service = new LanguagesService(fakeSite(), client);
		await expect(service.languages('someone', 'Library', 0)).rejects.toMatchObject({ status: 404 });
		await expect(service.languages('..', 'x', 0)).rejects.toMatchObject({ status: 404 });
		expect(state.calls).toBe(0);
	});

	it('관리자가 저장한 프로젝트의 주소도 받고, DB를 읽지 못해도 코드의 프로젝트는 받는다', async () => {
		const { state, client } = fakeGithubApi();
		state.languages['someone/Library'] = { Go: 10 };
		const saved = new LanguagesService(
			fakeSite({ items: [{ id: 'library', override: { url: 'https://github.com/someone/Library.git' } }] }),
			client
		);
		expect(await saved.languages('someone', 'library', 0)).toEqual([{ name: 'Go', bytes: 10, percent: 100 }]);

		const down = new LanguagesService(fakeSite(null, true), client);
		await expect(down.languages('someone', 'Library', 0)).rejects.toMatchObject({ status: 404 });
		expect(await down.languages('hyeoniverse', 'QRU', 0)).toHaveLength(4);
	});

	it('받은 값을 6시간 들고 있고, 동시에 여럿이 물어도 한 번만 묻는다', async () => {
		const { state, client } = fakeGithubApi();
		const service = new LanguagesService(fakeSite(), client);
		await Promise.all([service.languages('hyeoniverse', 'QRU', 0), service.languages('hyeoniverse', 'QRU', 0)]);
		expect(state.calls).toBe(1);
		await service.languages('hyeoniverse', 'QRU', LANGUAGES_TTL_MS - 1);
		expect(state.calls).toBe(1);
		await service.languages('hyeoniverse', 'QRU', LANGUAGES_TTL_MS + 1);
		expect(state.calls).toBe(2);
		expect(LANGUAGES_TTL_MS).toBe(6 * HOUR);
	});

	it('GitHub에 없는 저장소는 404이고, 그 답은 30분 들고 있다', async () => {
		const { state, client } = fakeGithubApi();
		const service = new LanguagesService(fakeSite(), client);
		await expect(service.languages('hyeoniverse', 'SproutFarm', 0)).rejects.toMatchObject({ status: 404 });
		await expect(service.languages('hyeoniverse', 'SproutFarm', LANGUAGES_MISSING_TTL_MS - 1)).rejects.toThrow();
		expect(state.calls).toBe(1);
		state.languages['hyeoniverse/SproutFarm'] = { 'C#': 100 };
		expect(await service.languages('hyeoniverse', 'SproutFarm', LANGUAGES_MISSING_TTL_MS + 1)).toHaveLength(1);
		expect(state.calls).toBe(2);
	});

	it('GitHub에 닿지 못하면 마지막으로 받은 값을 주고, 받은 값이 없으면 502', async () => {
		const { state, client } = fakeGithubApi();
		const service = new LanguagesService(fakeSite(), client);
		state.down = true;
		await expect(service.languages('hyeoniverse', 'QRU', 0)).rejects.toMatchObject({ status: 502 });

		state.down = false;
		const first = await service.languages('hyeoniverse', 'QRU', 0);
		state.down = true;
		await expect(service.languages('hyeoniverse', 'QRU', 7 * HOUR)).resolves.toEqual(first);
	});
});
