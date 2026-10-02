import { describe, expect, it } from 'vitest';
import {
	isFullName,
	MAX_SHOWCASE,
	mergeCandidates,
	parseShowcase,
	toProfile,
	toRepoCard,
	type RepoCard,
} from './showcase.js';

const card = (fullName: string): RepoCard => {
	const [owner, name] = fullName.split('/');
	return {
		fullName,
		owner,
		name,
		description: null,
		url: `https://github.com/${fullName}`,
		homepage: null,
		language: null,
		stars: 0,
		forks: 0,
		fork: false,
	};
};

describe('isFullName', () => {
	it('owner/이름만 받는다', () => {
		expect(isFullName('hyeoniverse/MacFolio')).toBe(true);
		expect(isFullName('Devcourse-NewPick/front')).toBe(true);
		expect(isFullName('a/b.c_d-e')).toBe(true);
		expect(isFullName('MacFolio')).toBe(false);
		expect(isFullName('a/b/c')).toBe(false);
		expect(isFullName('-a/b')).toBe(false);
		expect(isFullName('a/..')).toBe(false);
		expect(isFullName('a/b?x=1')).toBe(false);
		expect(isFullName(3)).toBe(false);
	});
});

describe('parseShowcase', () => {
	it('순서를 지켜 받는다', () => {
		expect(parseShowcase({ repos: ['b/two', 'a/one'] })).toEqual({ value: ['b/two', 'a/one'] });
		expect(parseShowcase({ repos: [] })).toEqual({ value: [] });
	});

	it('잘못된 이름, 대소문자만 다른 같은 저장소, 너무 많은 저장소를 막는다', () => {
		expect(parseShowcase({ repos: 'a/b' })).toHaveProperty('errors');
		expect(parseShowcase(null)).toHaveProperty('errors');
		expect(parseShowcase({ repos: ['a/b', 'nope'] })).toEqual({ errors: ['저장소 이름이 올바르지 않습니다: nope'] });
		expect(parseShowcase({ repos: ['a/Repo', 'A/repo'] })).toEqual({
			errors: ['같은 저장소가 두 번 있습니다: A/repo'],
		});
		const many = Array.from({ length: MAX_SHOWCASE + 1 }, (_, index) => `a/r${index}`);
		expect(parseShowcase({ repos: many })).toEqual({ errors: [`저장소는 ${MAX_SHOWCASE}개까지 고를 수 있습니다.`] });
	});
});

describe('toProfile', () => {
	it('GitHub 응답에서 필요한 값만, 웹사이트는 https 주소로', () => {
		const profile = toProfile({
			login: 'hyeoniverse',
			name: 'KIMJEONGHYEON',
			avatar_url: 'https://avatars.githubusercontent.com/u/1',
			bio: '',
			location: 'Seoul',
			blog: 'www.example.com',
			html_url: 'https://github.com/hyeoniverse',
			followers: 3,
			following: 4,
			public_repos: 15,
			email: 'secret@example.com',
		});
		expect(profile).toEqual({
			login: 'hyeoniverse',
			name: 'KIMJEONGHYEON',
			avatarUrl: 'https://avatars.githubusercontent.com/u/1',
			bio: null,
			location: 'Seoul',
			website: 'https://www.example.com/',
			url: 'https://github.com/hyeoniverse',
			followers: 3,
			following: 4,
			publicRepos: 15,
		});
	});
});

describe('toRepoCard', () => {
	it('저장소 카드, 비공개면 null', () => {
		const raw = {
			full_name: 'hyeoniverse/QRU',
			owner: { login: 'hyeoniverse' },
			name: 'QRU',
			description: '디지털 명함',
			html_url: 'https://github.com/hyeoniverse/QRU',
			homepage: '',
			language: 'TypeScript',
			stargazers_count: 2,
			forks_count: 1,
			fork: false,
			private: false,
		};
		expect(toRepoCard(raw)).toEqual({
			fullName: 'hyeoniverse/QRU',
			owner: 'hyeoniverse',
			name: 'QRU',
			description: '디지털 명함',
			url: 'https://github.com/hyeoniverse/QRU',
			homepage: null,
			language: 'TypeScript',
			stars: 2,
			forks: 1,
			fork: false,
		});
		expect(toRepoCard({ ...raw, private: true })).toBeNull();
	});
});

describe('mergeCandidates', () => {
	it('내 저장소 → 조직 저장소, 같은 저장소는 한 번, 목록에 없는 고른 저장소는 맨 앞', () => {
		const merged = mergeCandidates(
			[card('me/a'), card('other/x')],
			[
				[card('me/a'), card('me/b')],
				[card('org/c'), card('Me/A')],
			]
		);
		expect(merged.map((repo) => repo.fullName)).toEqual(['other/x', 'me/a', 'me/b', 'org/c']);
	});
});
