// 저장소의 실제 언어 비율 (GitHub 저장소 화면 옆 칸의 Languages). 사이트의 API(/github/languages/{owner}/{이름})가
// GitHub에서 받아 들고 있다가 준다. API가 없거나, GitHub 저장소가 아니거나, 받지 못하면 null: 옆 칸은 프로젝트의 주 언어로 그린다
import { useEffect, useState } from 'react';
import { githubRepoOf } from '@macfolio/desktop-core/site';
import { env } from '@/shared/config/env';

/** 언어 하나: 이름, 바이트 수, 비율(%, 소수 첫째 자리까지) */
export interface RepoLanguage {
	name: string;
	bytes: number;
	percent: number;
}

/** 서버 응답 → 언어 목록. 모양이 틀렸거나 비었으면 null */
export function toRepoLanguages(raw: unknown): RepoLanguage[] | null {
	if (!Array.isArray(raw)) return null;
	const list = raw.filter(
		(item): item is RepoLanguage =>
			typeof item?.name === 'string' &&
			item.name.length > 0 &&
			typeof item.bytes === 'number' &&
			typeof item.percent === 'number' &&
			Number.isFinite(item.percent) &&
			item.percent >= 0
	);
	return list.length ? list.map(({ name, bytes, percent }) => ({ name, bytes, percent })) : null;
}

/** 비율 글자 (GitHub처럼 소수 첫째 자리까지: 72.4%, 100.0%) */
export const percentText = (percent: number) => `${percent.toFixed(1)}%`;

/** 저장소마다 한 번만 묻는다 (탭을 오가거나 다시 그려도 다시 묻지 않는다). 서버나 GitHub에 닿지 못했으면 다음에 다시 묻는다 */
const requests = new Map<string, Promise<RepoLanguage[] | null>>();

export function fetchRepoLanguages(
	href: string | undefined,
	apiUrl = env.apiUrl,
	fetchImpl: typeof fetch = fetch
): Promise<RepoLanguage[] | null> {
	const repo = githubRepoOf(href);
	if (!repo || !apiUrl) return Promise.resolve(null);
	const url = `${apiUrl}/github/languages/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}`;
	let request = requests.get(url);
	if (!request) {
		const retryLater = () => {
			requests.delete(url);
			return null;
		};
		request = fetchImpl(url)
			.then((response) => {
				if (response.ok) return response.json().then(toRepoLanguages);
				// 404는 이 사이트의 프로젝트 저장소가 아니거나 GitHub에 없다는 답이라 다시 묻지 않는다
				return response.status === 404 ? null : retryLater();
			})
			.catch(retryLater);
		requests.set(url, request);
	}
	return request;
}

/** 시험: 물어 둔 것을 잊는다 */
export const forgetRepoLanguages = () => requests.clear();

/** 저장소 주소의 언어 비율. 받는 동안이나 받지 못하면 null */
export function useRepoLanguages(href: string | undefined): RepoLanguage[] | null {
	const [state, setState] = useState<{ href?: string; languages: RepoLanguage[] | null }>({ languages: null });
	useEffect(() => {
		let alive = true;
		void fetchRepoLanguages(href).then((languages) => {
			if (alive) setState({ href, languages });
		});
		return () => {
			alive = false;
		};
	}, [href]);
	return state.href === href ? state.languages : null;
}
