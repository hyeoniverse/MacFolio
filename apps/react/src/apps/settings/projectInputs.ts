// 시스템 설정 › 프로젝트의 입력칸 규칙 (React와 DOM 없이): 언어·기술 자동완성 후보
import type { Project } from '@macfolio/desktop-core/site';
import { COMMON_LANGUAGES, COMMON_STACKS } from './commonStacks';
import { LINGUIST_LANGUAGES } from './linguistLanguages';

const unique = (values: string[]) => [...new Set(values.map((value) => value.trim()).filter(Boolean))];

/** 언어 후보: 프로젝트들이 쓴 언어 먼저, 그다음 자주 쓰는 언어, 그다음 GitHub linguist의 언어 전부 */
export const languageOptions = (projects: readonly Project[]) => {
	// 프로젝트들이 쓴 언어 → 자주 쓰는 언어 → linguist의 나머지 (같은 이름은 대소문자 무시하고 하나로)
	const seen = new Set<string>();
	return unique([...projects.map((project) => project.language), ...COMMON_LANGUAGES, ...LINGUIST_LANGUAGES]).filter(
		(name) => {
			const key = name.toLowerCase();
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		}
	);
};

/** 기술 후보: 프로젝트들의 기술과 다룰 수 있는 기술(많이 쓴 것부터), 그다음 자주 쓰는 기술 */
export function stackOptions(projects: readonly Project[], extra: readonly string[] = []): string[] {
	const counts = new Map<string, number>();
	for (const name of [...projects.flatMap((project) => project.stack), ...extra]) {
		const key = name.trim();
		if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
	}
	const used = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name]) => name);
	const seen = new Set(used.map((name) => name.toLowerCase()));
	// 목록 안에서도 같은 이름은 하나만 (분류마다 적다 보면 겹친다)
	const rest = COMMON_STACKS.filter((name) => {
		const key = name.toLowerCase();
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
	return [...used, ...rest];
}

/**
 * 친 글자로 후보를 고른다: 이미 고른 것은 빼고, 앞부분이 맞는 것 먼저, 그다음 중간에 들어 있는 것. 대소문자는 가리지 않는다
 */
export function suggest(options: readonly string[], query: string, chosen: readonly string[] = [], limit = 8) {
	const q = query.trim().toLowerCase();
	const taken = new Set(chosen.map((item) => item.toLowerCase()));
	const pool = options.filter((option) => !taken.has(option.toLowerCase()));
	if (!q) return pool.slice(0, limit);
	const starts = pool.filter((option) => option.toLowerCase().startsWith(q));
	const contains = pool.filter((option) => !option.toLowerCase().startsWith(q) && option.toLowerCase().includes(q));
	return [...starts, ...contains].slice(0, limit);
}
