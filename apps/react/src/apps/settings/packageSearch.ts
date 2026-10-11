// 기술 칸의 바깥 후보: npm 레지스트리 검색. 코드에 적어 둔 목록(projectInputs.ts)에 없는 라이브러리도 찾는다
/** 검색 주소 (CSP connect-src에 연다: worker/securityHeaders.ts) */
export const NPM_SEARCH = 'https://registry.npmjs.org/-/v1/search';

/** 한 번에 받아 올 수 */
const SIZE = 20;

/** 친 글자로 npm 패키지 이름을 찾는다. 실패하면 빈 목록 (바깥 검색은 덤이라 칸을 막지 않는다) */
export async function searchPackages(query: string, signal?: AbortSignal): Promise<string[]> {
	const text = query.trim();
	if (text.length < 2) return [];
	try {
		const response = await fetch(`${NPM_SEARCH}?text=${encodeURIComponent(text)}&size=${SIZE}`, { signal });
		if (!response.ok) return [];
		const body = (await response.json()) as { objects?: { package?: { name?: unknown } }[] };
		return (body.objects ?? [])
			.map((item) => item.package?.name)
			.filter((name): name is string => typeof name === 'string' && name.length > 0);
	} catch {
		return [];
	}
}

/** 코드의 후보 뒤에 바깥 후보를 붙인다: 이미 있거나 고른 이름(대소문자 무시)은 빼고, 모두 limit개까지 */
export function mergeSuggestions(
	local: readonly string[],
	remote: readonly string[],
	chosen: readonly string[],
	limit: number
) {
	const seen = new Set([...local, ...chosen].map((name) => name.toLowerCase()));
	const extra: string[] = [];
	for (const name of remote) {
		const key = name.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		extra.push(name);
	}
	return { local: local.slice(0, limit), remote: extra.slice(0, Math.max(0, limit - local.length)) };
}
