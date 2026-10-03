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

/** 기여 달력 HTML (github.com/users/<계정>/contributions 모양) */
export const contributionsHtml = (days: { date: string; level: number; count: number }[], total?: number) =>
	[
		`<h2 id="js-contribution-activity-description">\n  ${(total ?? days.reduce((sum, day) => sum + day.count, 0)).toLocaleString('en-US')}\n  contributions\n  in the last year\n</h2>`,
		'<table><tbody><tr>',
		...days.map(
			(day, i) =>
				`<td tabindex="0" data-ix="${i}" style="width: 10px" data-date="${day.date}" id="contribution-day-component-${i}" data-level="${day.level}" role="gridcell" class="ContributionCalendar-day"></td>`
		),
		'</tr></tbody></table>',
		...days.map(
			(day, i) =>
				`<tool-tip id="tooltip-${i}" for="contribution-day-component-${i}" popover="manual">${day.count ? `${day.count} contribution${day.count > 1 ? 's' : ''}` : 'No contributions'} on ${day.date}.</tool-tip>`
		),
	].join('\n');

/** 공개 이벤트 (GET /users/<계정>/events/public 모양) */
export const pushEvent = (id: string, repo: string, createdAt: string, size = 2) => ({
	id,
	type: 'PushEvent',
	public: true,
	created_at: createdAt,
	repo: { name: repo },
	payload: {
		ref: 'refs/heads/main',
		size,
		commits: Array.from({ length: size }, (_, i) => ({ message: `커밋 ${i + 1}\n\n본문` })),
	},
});

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
		contributions: contributionsHtml([
			{ date: '2026-09-27', level: 0, count: 0 },
			{ date: '2026-09-28', level: 2, count: 3 },
			{ date: '2026-09-29', level: 4, count: 12 },
		]) as string | null,
		/** true면 기여 달력만 받지 못한다 */
		contributionsDown: false,
		events: [
			pushEvent('3', 'hyeoniverse/MacFolio', '2026-10-03T10:00:00Z', 3),
			{
				id: '2',
				type: 'PullRequestEvent',
				public: true,
				created_at: '2026-10-02T09:00:00Z',
				repo: { name: 'hyeoniverse/MacFolio' },
				payload: {
					action: 'closed',
					number: 86,
					pull_request: {
						number: 86,
						title: 'feat(finder): Finder 앱',
						merged: true,
						html_url: 'https://github.com/hyeoniverse/MacFolio/pull/86',
					},
				},
			},
			{ id: '1', type: 'MemberEvent', public: true, created_at: '2026-10-01T09:00:00Z', repo: { name: 'a/b' } },
		] as Record<string, unknown>[],
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
		userEvents: () => call(state.events),
		contributionsHtml: () =>
			state.contributionsDown
				? Promise.reject(new BadGatewayException('GitHub가 요청을 거절했습니다 (429).'))
				: call(state.contributions),
	};
	return { state, client: client as GithubApiClient };
}
