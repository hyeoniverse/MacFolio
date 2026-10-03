// GitHub 앱의 값 (apps/api의 /github). 누구나 프로필을 받고, 관리자만 보일 저장소를 고른다.
import { useSyncExternalStore } from 'react';
import { env } from '@/shared/config/env';
import { createStore } from '@/shared/lib/createStore';
import { GITHUB_SNAPSHOT, type GithubData, type RepoCard } from '@/apps/github/githubProfile';

/** 보일 저장소는 GitHub의 Pinned처럼 6개까지 (서버와 같다) */
export const MAX_SHOWCASE = 6;

interface State {
	/** snapshot: 서버 값을 아직 받지 못해 스냅샷을 보여 준다, live: 서버 값 */
	source: 'snapshot' | 'live';
	data: GithubData;
}

export const githubStore = createStore<State>({ source: 'snapshot', data: GITHUB_SNAPSHOT });

export function useGithub(): State {
	return useSyncExternalStore(githubStore.subscribe, githubStore.getState);
}

const isHttpUrl = (value: unknown): value is string => {
	if (typeof value !== 'string') return false;
	try {
		return ['http:', 'https:'].includes(new URL(value).protocol);
	} catch {
		return false;
	}
};

const safeUrl = (value: unknown) => (isHttpUrl(value) ? value : null);

/** 서버가 준 저장소 카드. 주소가 http(s)가 아니면 버린다 (링크로 그리므로) */
export function toRepoCard(raw: RepoCard): RepoCard | null {
	if (!isHttpUrl(raw?.url) || typeof raw.fullName !== 'string') return null;
	return { ...raw, homepage: safeUrl(raw.homepage) };
}

/** 서버 응답 → 화면 값. 모양이 틀리면 null (스냅샷을 그대로 둔다) */
export function toGithubData(raw: unknown): GithubData | null {
	const value = raw as Partial<GithubData> | null;
	const profile = value?.profile;
	if (!profile || typeof profile.login !== 'string' || !isHttpUrl(profile.url) || !Array.isArray(value.repos))
		return null;
	return {
		profile: {
			...profile,
			avatarUrl: safeUrl(profile.avatarUrl) ?? GITHUB_SNAPSHOT.profile.avatarUrl,
			website: safeUrl(profile.website),
		},
		readme: typeof value.readme === 'string' ? value.readme : null,
		readmeBaseUrl: safeUrl(value.readmeBaseUrl) ?? GITHUB_SNAPSHOT.readmeBaseUrl,
		repos: value.repos.map(toRepoCard).filter((repo): repo is RepoCard => repo !== null),
	};
}

let pending: Promise<void> | null = null;

/** 서버 값을 받는다 (앱을 열 때마다. 실패하면 지금 보이는 값을 그대로 둔다) */
export function loadGithub(apiUrl = env.apiUrl, fetchImpl: typeof fetch = fetch): Promise<void> {
	if (!apiUrl) return Promise.resolve();
	pending ??= (async () => {
		try {
			const response = await fetchImpl(`${apiUrl}/github/profile`);
			if (!response.ok) return;
			const data = toGithubData(await response.json());
			if (data) githubStore.setState({ source: 'live', data });
		} catch {
			// 서버에 닿지 않으면 스냅샷(또는 이전에 받은 값)을 그대로 보여 준다
		} finally {
			pending = null;
		}
	})();
	return pending;
}

/** 관리자 요청. 실패하면 이유를 담은 Error */
async function adminRequest<T>(path: string, init: RequestInit = {}, apiUrl = env.apiUrl): Promise<T> {
	let response: Response;
	try {
		response = await fetch(`${apiUrl}${path}`, { credentials: 'include', ...init });
	} catch {
		throw new Error('서버에 연결할 수 없습니다. 잠시 뒤 다시 시도해 주세요.');
	}
	if (response.status === 401) throw new Error('관리자 로그인이 필요합니다.');
	if (!response.ok) {
		const body = (await response.json().catch(() => null)) as { message?: string | string[] } | null;
		const message = Array.isArray(body?.message) ? body.message.join(' ') : body?.message;
		throw new Error(message || '요청을 처리하지 못했습니다.');
	}
	return (await response.json()) as T;
}

/** 고를 수 있는 저장소 (고른 것 가운데 목록에 없는 것 → 내 저장소 → 조직 저장소) */
export async function loadCandidates(): Promise<{ selected: string[]; repos: RepoCard[] }> {
	const body = await adminRequest<{ selected: string[]; repos: RepoCard[] }>('/github/candidates');
	return {
		selected: body.selected,
		repos: body.repos.map(toRepoCard).filter((repo): repo is RepoCard => repo !== null),
	};
}

/** "owner/이름"으로 저장소를 찾는다 */
export async function lookupRepo(fullName: string): Promise<RepoCard> {
	const [owner, name] = fullName.split('/');
	const card = toRepoCard(
		await adminRequest<RepoCard>(`/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`)
	);
	if (!card) throw new Error('저장소를 찾을 수 없습니다.');
	return card;
}

/** 보일 저장소를 저장하고, GitHub 앱의 값을 새로 받는다 */
export async function saveShowcase(repos: string[]): Promise<string[]> {
	const body = await adminRequest<{ repos: string[] }>('/github/showcase', {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ repos }),
	});
	await loadGithub();
	return body.repos;
}

/** "owner/이름" 모양인지 (서버와 같은 규칙) */
export const isFullName = (value: string) =>
	/^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9._-]{1,100}$/.test(value) && !/\/\.{1,2}$/.test(value);
