// 시스템 설정 → GitHub: 보일 저장소 목록을 다루는 규칙. React와 DOM에 의존하지 않는다.
import type { RepoCard } from '@/apps/github/githubProfile';

/** 같은 저장소인지 (GitHub 이름은 대소문자를 가리지 않는다) */
export const sameRepo = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** index번째를 delta칸 옮긴 새 목록 (끝을 넘으면 그대로). ≡ 끌기는 놓은 자리 - 원래 자리만큼 */
export function move<T>(list: readonly T[], index: number, delta: number): T[] {
	const target = index + delta;
	if (index < 0 || index >= list.length || target < 0 || target >= list.length) return [...list];
	const next = [...list];
	const [item] = next.splice(index, 1);
	next.splice(target, 0, item);
	return next;
}

/** 고를 수 있는 저장소를 계정·조직별로. 내 계정을 맨 앞에, 나머지는 처음 나온 순서 */
export function groupByOwner(repos: readonly RepoCard[], login: string): { owner: string; repos: RepoCard[] }[] {
	const groups: { owner: string; repos: RepoCard[] }[] = [];
	for (const repo of repos) {
		const group = groups.find((item) => sameRepo(item.owner, repo.owner));
		if (group) group.repos.push(repo);
		else groups.push({ owner: repo.owner, repos: [repo] });
	}
	const mine = groups.findIndex((group) => sameRepo(group.owner, login));
	if (mine > 0) groups.unshift(...groups.splice(mine, 1));
	return groups;
}
