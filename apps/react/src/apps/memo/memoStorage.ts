// 메모 앱이 이 브라우저에 남기는 것: 보기 설정, 최근 검색어. 값 검사는 desktop-core가 하고 여기서는 읽고 쓰기만 한다
import { addRecentFind, parseArrangement, parseRecentFinds, type Arrangement } from '@macfolio/desktop-core/memo';
import { readJson, STORAGE_KEYS, writeJson } from '@/shared/lib/storage';

/** 저장된 보기 설정. 없거나 잘못되었으면 기본값 */
export const loadArrangement = (): Arrangement => parseArrangement(readJson(STORAGE_KEYS.memoArrangement));
export const saveArrangement = (arrangement: Arrangement) => writeJson(STORAGE_KEYS.memoArrangement, arrangement);

export const loadRecentFinds = (): string[] => parseRecentFinds(readJson(STORAGE_KEYS.memoRecentFinds));
export const saveRecentFinds = (list: string[]) => writeJson(STORAGE_KEYS.memoRecentFinds, list);

/** 최근 검색어에 더하고 저장한다 */
export function rememberFind(recent: string[], query: string): string[] {
	const next = addRecentFind(recent, query);
	if (next !== recent) saveRecentFinds(next);
	return next;
}
