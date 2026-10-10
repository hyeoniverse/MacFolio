// 이 사이트가 방문자 브라우저에 남기는 값을 읽고 쓰는 한 곳: 키 이름, JSON 파싱, 실패 처리.
// 사생활 보호 창이나 저장 공간 부족으로 localStorage가 던져도 화면은 그대로 동작해야 하므로 모두 삼킨다.
// 새 키를 더하면 bin/siteStorage.ts의 BROWSER_DATA에도 더한다 (휴지통의 '내 브라우저 데이터'가 보여 주고 지운다)

/** 저장 키. 'macfolio:' 접두어로 다른 사이트·라이브러리의 키와 구분한다 */
export const STORAGE_KEYS = {
	/** public/theme-boot.js(깜빡임 방지)도 이 키를 글자 그대로 읽는다 */
	settings: 'macfolio:settings',
	memoArrangement: 'macfolio:memo:arrangement',
	memoRecentFinds: 'macfolio:memo:recent-finds',
	weatherPlaces: 'macfolio:weather:places',
	weatherUnit: 'macfolio:weather:unit',
	/** 저장 형식 버전이 바뀌면 키를 바꾼다 */
	messages: 'macfolio:messages:v2',
	messagesVisitor: 'macfolio:messages:visitor',
	/** 탭을 닫으면 사라진다 (sessionStorage) */
	appsBeforeLeaving: 'macfolio:apps-before-leaving',
	window: (appName: string) => `macfolio:window:${appName}`,
} as const;

export type StorageKind = 'local' | 'session';

/** 브라우저 저장소. 접근 자체가 막혀 있으면(일부 사생활 보호 설정) null */
export function storageOf(kind: StorageKind = 'local'): Storage | null {
	try {
		return kind === 'local' ? globalThis.localStorage : globalThis.sessionStorage;
	} catch {
		return null;
	}
}

/** 문자열 값. 없거나 읽지 못하면 null */
export function readString(key: string, kind: StorageKind = 'local'): string | null {
	try {
		return storageOf(kind)?.getItem(key) ?? null;
	} catch {
		return null;
	}
}

/** 저장한다. 못 하면 false (이번 방문 동안은 메모리 값으로 동작한다) */
export function writeString(key: string, value: string, kind: StorageKind = 'local'): boolean {
	const storage = storageOf(kind);
	if (!storage) return false;
	try {
		storage.setItem(key, value);
		return true;
	} catch {
		return false;
	}
}

export function removeKey(key: string, kind: StorageKind = 'local') {
	try {
		storageOf(kind)?.removeItem(key);
	} catch {
		// 지우지 못해도 다음에 다시 시도할 수 있다
	}
}

/** JSON으로 저장한 값. 없거나 JSON이 아니면 null. 모양 검사는 부르는 쪽이 한다 */
export function readJson(key: string, kind: StorageKind = 'local'): unknown {
	const raw = readString(key, kind);
	if (raw === null) return null;
	try {
		return JSON.parse(raw) as unknown;
	} catch {
		return null;
	}
}

export function writeJson(key: string, value: unknown, kind: StorageKind = 'local'): boolean {
	return writeString(key, JSON.stringify(value), kind);
}

/** 읽고 바로 지운다 (한 번만 쓰는 값) */
export function takeJson(key: string, kind: StorageKind = 'local'): unknown {
	const value = readJson(key, kind);
	removeKey(key, kind);
	return value;
}
