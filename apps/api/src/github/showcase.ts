// GitHub 앱에 보여 줄 프로필·저장소의 규칙. Nest와 DB에 의존하지 않는다.

import { isFullName, MAX_SHOWCASE, parse, sameRepo, ShowcaseInput } from '@macfolio/contracts';

/** GitHub의 Pinned처럼 6개까지. 이름 규칙과 몸통 스키마는 @macfolio/contracts */
export { isFullName, MAX_SHOWCASE, sameRepo };

/** 아직 고른 적이 없을 때 (이 기능 전에 GitHub 앱에 적어 두었던 Pinned) */
export const DEFAULT_SHOWCASE = [
	'hyeoniverse/newpick',
	'Devcourse-WhatToDo/todo-front',
	'hyeoniverse/QRU',
	'hyeoniverse/SproutFarm',
	'hyeoniverse/DevCourse-FullStack',
];

/** PUT /github/showcase 본문: { repos: ["owner/이름", ...] } */
export function parseShowcase(input: unknown): { value: string[] } | { errors: string[] } {
	const parsed = parse(ShowcaseInput, input);
	return 'errors' in parsed ? parsed : { value: parsed.value.repos };
}

export interface GithubProfile {
	login: string;
	name: string | null;
	avatarUrl: string;
	bio: string | null;
	location: string | null;
	/** 프로필의 웹사이트 (https://까지) */
	website: string | null;
	url: string;
	followers: number;
	following: number;
	/** 공개 저장소 수 (Repositories 탭의 숫자) */
	publicRepos: number;
}

export interface RepoCard {
	/** owner/이름 */
	fullName: string;
	owner: string;
	name: string;
	description: string | null;
	url: string;
	homepage: string | null;
	language: string | null;
	stars: number;
	forks: number;
	/** 다른 저장소를 포크한 것 */
	fork: boolean;
}

/** 프로필 웹사이트는 http(s) 주소로 맞춘다 (GitHub에는 example.com처럼 적을 수 있다) */
function website(blog: unknown): string | null {
	if (typeof blog !== 'string' || !blog.trim()) return null;
	const value = blog.trim();
	const url = /^https?:\/\//i.test(value) ? value : `https://${value}`;
	try {
		return new URL(url).toString();
	} catch {
		return null;
	}
}

const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value : null);
const count = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

/** GET /user/:id 응답 → 프로필 */
export function toProfile(raw: Record<string, unknown>): GithubProfile {
	return {
		login: String(raw.login),
		name: text(raw.name),
		avatarUrl: String(raw.avatar_url),
		bio: text(raw.bio),
		location: text(raw.location),
		website: website(raw.blog),
		url: String(raw.html_url),
		followers: count(raw.followers),
		following: count(raw.following),
		publicRepos: count(raw.public_repos),
	};
}

/** GitHub 저장소 응답 → 카드. 비공개 저장소는 보여 주지 않는다 (null) */
export function toRepoCard(raw: Record<string, unknown>): RepoCard | null {
	if (raw.private === true) return null;
	const owner = (raw.owner as { login?: unknown } | undefined)?.login;
	return {
		fullName: String(raw.full_name),
		owner: String(owner),
		name: String(raw.name),
		description: text(raw.description),
		url: String(raw.html_url),
		homepage: website(raw.homepage),
		language: text(raw.language),
		stars: count(raw.stargazers_count),
		forks: count(raw.forks_count),
		fork: raw.fork === true,
	};
}

/**
 * 고를 수 있는 저장소: 내 저장소 → 조직 저장소 순서, 같은 저장소는 한 번.
 * 고른 저장소 가운데 목록에 없는 것(직접 입력한 다른 계정의 저장소)은 맨 앞에 둔다.
 */
export function mergeCandidates(selected: RepoCard[], groups: RepoCard[][]): RepoCard[] {
	const result: RepoCard[] = [];
	const seen = new Set<string>();
	const add = (repo: RepoCard) => {
		const key = repo.fullName.toLowerCase();
		if (seen.has(key)) return;
		seen.add(key);
		result.push(repo);
	};
	const listed = new Set(groups.flat().map((repo) => repo.fullName.toLowerCase()));
	selected.filter((repo) => !listed.has(repo.fullName.toLowerCase())).forEach(add);
	groups.flat().forEach(add);
	return result;
}
