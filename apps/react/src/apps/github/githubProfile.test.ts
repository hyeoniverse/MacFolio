import { describe, expect, it } from 'vitest';
import { PROJECTS } from '@/shared/profile';
import { GITHUB_SNAPSHOT, MAX_PINNED } from './githubProfile';

describe('GITHUB_SNAPSHOT', () => {
	it('고정 저장소는 프로젝트 목록의 앞 6개를 같은 순서로 쓴다 (GitHub처럼 6개까지)', () => {
		expect(PROJECTS.length).toBeGreaterThan(MAX_PINNED);
		expect(GITHUB_SNAPSHOT.repos.map((repo) => repo.url)).toEqual(
			PROJECTS.slice(0, MAX_PINNED).map((project) => project.url)
		);
		const macfolio = GITHUB_SNAPSHOT.repos.find((repo) => repo.name === 'MacFolio');
		expect(macfolio).toMatchObject({
			fullName: 'hyeoniverse/MacFolio',
			owner: 'hyeoniverse',
			homepage: null,
			language: 'TypeScript',
		});
	});

	it('모든 프로젝트가 GitHub 저장소 주소를 가진다 (owner/이름으로 나눌 수 있게)', () => {
		for (const project of PROJECTS) expect(project.url).toMatch(/^https:\/\/github\.com\/[^/]+\/[^/]+$/);
	});
});
