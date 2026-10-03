// GitHub 앱에 보여 줄 프로필·저장소의 규칙. Nest와 DB에 의존하지 않는다.

/** GitHub의 Pinned처럼 6개까지 */
export const MAX_SHOWCASE = 6;

/** 아직 고른 적이 없을 때 (이 기능 전에 GitHub 앱에 적어 두었던 Pinned) */
export const DEFAULT_SHOWCASE = [
	'Devcourse-NewPick/front',
	'Devcourse-WhatToDo/todo-front',
	'hyeoniverse/QRU',
	'hyeoniverse/SproutFarm',
	'hyeoniverse/DevCourse-FullStack',
];

/** "owner/이름". owner는 GitHub 계정·조직 이름 규칙, 이름은 영문·숫자·. _ - */
const FULL_NAME = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9._-]{1,100}$/;

export const isFullName = (value: unknown): value is string =>
	typeof value === 'string' && FULL_NAME.test(value) && !value.endsWith('/.') && !value.endsWith('/..');

/** 같은 저장소인지 (GitHub 이름은 대소문자를 가리지 않는다) */
export const sameRepo = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** PUT /github/showcase 본문: { repos: ["owner/이름", ...] } */
export function parseShowcase(input: unknown): { value: string[] } | { errors: string[] } {
	const repos = (input as { repos?: unknown } | null)?.repos;
	if (!Array.isArray(repos)) return { errors: ['repos는 "owner/이름" 목록이어야 합니다.'] };
	const errors: string[] = [];
	if (repos.length > MAX_SHOWCASE) errors.push(`저장소는 ${MAX_SHOWCASE}개까지 고를 수 있습니다.`);
	const value: string[] = [];
	for (const repo of repos) {
		if (!isFullName(repo)) errors.push(`저장소 이름이 올바르지 않습니다: ${String(repo)}`);
		else if (value.some((other) => sameRepo(other, repo))) errors.push(`같은 저장소가 두 번 있습니다: ${repo}`);
		else value.push(repo);
	}
	return errors.length ? { errors } : { value };
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
