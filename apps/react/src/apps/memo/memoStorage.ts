// 메모 앱이 이 브라우저에 남기는 것: 보기 설정, 최근 검색어. 값 검사는 desktop-core가 하고 여기서는 읽고 쓰기만 한다
import { addRecentFind, parseArrangement, parseRecentFinds, type Arrangement } from '@macfolio/desktop-core/memo';

const ARRANGEMENT_KEY = 'macfolio:memo:arrangement';
const RECENT_KEY = 'macfolio:memo:recent-finds';
/** 예전에 방문자 브라우저에 저장하던 정리 내용 (지금은 지우기만 한다) */
const ORGANIZATION_KEY = 'macfolio:memo:organization';
/** 더 예전(폴더 이름 목록만 저장하던) 키 */
const LEGACY_FOLDERS_KEY = 'macfolio:memo:folders';

const read = (key: string): unknown => {
	try {
		return JSON.parse(localStorage.getItem(key) ?? 'null');
	} catch {
		return null;
	}
};

const write = (key: string, value: unknown) => {
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch {
		// 저장하지 못해도 이번에는 그대로 보인다
	}
};

/** 저장된 보기 설정. 없거나 잘못되었으면 기본값 */
export const loadArrangement = (): Arrangement => parseArrangement(read(ARRANGEMENT_KEY));
export const saveArrangement = (arrangement: Arrangement) => write(ARRANGEMENT_KEY, arrangement);

export const loadRecentFinds = (): string[] => parseRecentFinds(read(RECENT_KEY));
export const saveRecentFinds = (list: string[]) => write(RECENT_KEY, list);

/** 최근 검색어에 더하고 저장한다 */
export function rememberFind(recent: string[], query: string): string[] {
	const next = addRecentFind(recent, query);
	if (next !== recent) saveRecentFinds(next);
	return next;
}

/**
 * 예전에 방문자 브라우저에 저장한 정리 내용을 지운다.
 * 이제 정리 내용은 관리자만 바꾸고 서버에 저장하므로, 브라우저에 남은 것은 쓰지 않는다.
 */
export function discardVisitorOrganization() {
	try {
		localStorage.removeItem(ORGANIZATION_KEY);
		localStorage.removeItem(LEGACY_FOLDERS_KEY);
	} catch {
		// 지우지 못해도 읽지 않으므로 상관없다
	}
}
