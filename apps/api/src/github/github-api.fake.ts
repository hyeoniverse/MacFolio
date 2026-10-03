// 시험용 가짜 GitHub API (단위·e2e 시험이 함께 쓴다). 부른 횟수를 센다
import { BadGatewayException } from '@nestjs/common';
import type { GithubApiClient } from './github-api.client.js';

const repo = (fullName: string, extra: Record<string, unknown> = {}) => {
	const [owner, name] = fullName.split('/');
	return {
		full_name: fullName,
		owner: { login: owner },
		name,
		description: `${name} 설명`,
		html_url: `https://github.com/${fullName}`,
		homepage: null,
		language: 'TypeScript',
		stargazers_count: 1,
		forks_count: 0,
		fork: false,
		private: false,
		...extra,
	};
};

export function fakeGithubApi() {
	const state = {
		calls: 0,
		/** true면 GitHub에 닿지 못한다 */
		down: false,
		readme: '# 안녕하세요\n\n![통계](./profile/stats-light.svg)' as string | null,
		own: [repo('hyeoniverse/QRU'), repo('hyeoniverse/SproutFarm'), repo('hyeoniverse/secret', { private: true })],
		orgs: { 'Devcourse-NewPick': [repo('Devcourse-NewPick/front')] } as Record<string, ReturnType<typeof repo>[]>,
		/** 목록에는 없지만 따로 찾으면 있는 저장소 (직접 입력) */
		others: [repo('someone/Library'), repo('Devcourse-WhatToDo/todo-front'), repo('hyeoniverse/DevCourse-FullStack')],
	};
	const call = <T>(value: T): Promise<T> => {
		state.calls += 1;
		return state.down
			? Promise.reject(new BadGatewayException('GitHub에 연결할 수 없습니다.'))
			: Promise.resolve(value);
	};
	const all = () => [...state.own, ...Object.values(state.orgs).flat(), ...state.others];
	const client: Partial<GithubApiClient> = {
		userById: () =>
			call({
				login: 'hyeoniverse',
				name: 'KIMJEONGHYEON',
				avatar_url: 'https://avatars.githubusercontent.com/u/68999618',
				bio: '프론트엔드 개발자',
				location: 'Seoul',
				blog: 'https://www.hyeoniverse.com/',
				html_url: 'https://github.com/hyeoniverse',
				followers: 7,
				following: 9,
				public_repos: 21,
			}),
		userRepos: () => call(state.own),
		userOrgs: () => call(Object.keys(state.orgs)),
		orgRepos: (org: string) => call(state.orgs[org] ?? []),
		repo: (fullName: string) =>
			call(all().find((item) => item.full_name.toLowerCase() === fullName.toLowerCase()) ?? null),
		profileReadme: () => call(state.readme),
	};
	return { state, client: client as GithubApiClient };
}
