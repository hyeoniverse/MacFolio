// 저장소의 언어 비율 (GitHub 저장소 화면 옆 칸의 Languages). Nest와 DB에 의존하지 않는다.

/** 언어 하나: 이름, 바이트 수, 비율(%, 소수 첫째 자리까지. 모두 더하면 100) */
export interface RepoLanguage {
	name: string;
	bytes: number;
	percent: number;
}

/** 이름을 붙여 보여 줄 언어 수. 나머지는 Other로 묶는다 */
export const MAX_LANGUAGES = 6;
/** 이보다 작은 비율(%)의 언어는 Other로 묶는다 */
export const MIN_PERCENT = 0.5;
export const OTHER = 'Other';

/** 비율을 소수 첫째 자리로 반올림하되 합이 꼭 100이 되게 한다 (나머지가 큰 것부터 0.1씩 더한다) */
function roundedPercents(bytes: number[]): number[] {
	const total = bytes.reduce((sum, value) => sum + value, 0);
	const exact = bytes.map((value) => (value / total) * 1000);
	const floors = exact.map(Math.floor);
	let left = 1000 - floors.reduce((sum, value) => sum + value, 0);
	const order = exact.map((value, index) => ({ index, rest: value - floors[index] })).sort((a, b) => b.rest - a.rest);
	for (const { index } of order) {
		if (left <= 0) break;
		floors[index] += 1;
		left -= 1;
	}
	return floors.map((tenths) => tenths / 10);
}

/**
 * GitHub의 GET /repos/{owner}/{repo}/languages 응답({ 언어: 바이트 })을 많은 순서의 목록으로.
 * 작은 언어(0.5% 미만)와 여섯째 뒤의 언어는 GitHub 옆 칸처럼 Other 하나로 묶는다 (묶일 언어가 하나뿐이면 그 이름 그대로).
 * 언어가 없으면(빈 저장소) 빈 목록
 */
export function languageShares(raw: unknown): RepoLanguage[] {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
	const entries = Object.entries(raw as Record<string, unknown>)
		.filter((entry): entry is [string, number] => typeof entry[1] === 'number' && entry[1] > 0)
		.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
	const total = entries.reduce((sum, [, bytes]) => sum + bytes, 0);
	if (!total) return [];

	const named = entries.filter(([, bytes], index) => index < MAX_LANGUAGES && (bytes / total) * 100 >= MIN_PERCENT);
	const rest = entries.slice(named.length);
	const kept: [string, number][] =
		rest.length > 1 ? [...named, [OTHER, rest.reduce((sum, [, bytes]) => sum + bytes, 0)]] : entries;
	const percents = roundedPercents(kept.map(([, bytes]) => bytes));
	return kept.map(([name, bytes], index) => ({ name, bytes, percent: percents[index] }));
}
