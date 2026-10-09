// 이 사이트가 방문자 브라우저에 남기는 것. 휴지통의 '내 브라우저 데이터'가 보여 주고 지운다.
// 새 키를 쓰면 여기에도 더한다 (siteStorage.test.ts가 코드에 있는 macfolio: 키를 모두 다루는지 확인한다)

export interface BrowserDataItem {
	id: string;
	/** 목록에 보일 이름 */
	name: string;
	/** 무엇이고 왜 남기는지 */
	description: string;
	storage: 'local' | 'session';
	keys: string[];
	/** 지운 뒤 어떻게 되는지 */
	afterClear: string;
	/** 저장된 값을 짧게 (예: '검색어 3개') */
	summarize?: (raw: string) => string | null;
}

const countOf = (raw: string, unit: string) => {
	try {
		const list = JSON.parse(raw) as unknown;
		return Array.isArray(list) ? `${unit} ${list.length}개` : null;
	} catch {
		return null;
	}
};

export const BROWSER_DATA: BrowserDataItem[] = [
	{
		id: 'settings',
		name: '설정',
		description: '시스템 설정에서 고른 화면 모드, 배경화면(데스크톱·휴대폰), 딸깍 소리',
		storage: 'local',
		keys: ['macfolio:settings'],
		afterClear: '바로 처음 설정으로 돌아갑니다',
	},
	{
		id: 'memo-arrangement',
		name: '메모 보기 설정',
		description: '메모 앱 목록의 정렬 기준과 날짜별 묶기',
		storage: 'local',
		keys: ['macfolio:memo:arrangement'],
		afterClear: '메모 앱을 다음에 열 때부터 처음 설정으로 보입니다',
	},
	{
		id: 'memo-finds',
		name: '메모 최근 검색어',
		description: '메모 본문 찾기(⌘F)에서 쓴 검색어 다섯 개까지',
		storage: 'local',
		keys: ['macfolio:memo:recent-finds'],
		afterClear: '찾기 칸의 최근 목록이 비워집니다',
		summarize: (raw) => countOf(raw, '검색어'),
	},
	{
		id: 'local-messages',
		name: '이 브라우저에 저장한 메시지',
		description: '서버 없이 띄운 사이트에서 메시지 앱에 쓴 글과, 그 글을 쓴 사람을 가리는 무작위 값',
		storage: 'local',
		keys: ['macfolio:messages:v2', 'macfolio:messages:visitor'],
		afterClear: '이 브라우저에 쓴 메시지가 사라집니다',
	},
	{
		id: 'apps-before-leaving',
		name: '로그인하러 떠날 때 켜 둔 앱',
		description: 'GitHub 로그인에서 돌아왔을 때 켜 두었던 창을 되살리려고 잠깐 남기는 목록 (이 탭을 닫으면 사라진다)',
		storage: 'session',
		keys: ['macfolio:apps-before-leaving'],
		afterClear: '돌아왔을 때 창이 처음 상태로 열립니다',
	},
];

export interface StoredItem {
	item: BrowserDataItem;
	summary: string | null;
}

const storageOf = (kind: BrowserDataItem['storage']): Storage | null => {
	try {
		return kind === 'local' ? window.localStorage : window.sessionStorage;
	} catch {
		return null;
	}
};

/** 지금 이 브라우저에 남아 있는 것만 */
export function readBrowserData(items: BrowserDataItem[] = BROWSER_DATA): StoredItem[] {
	return items.flatMap((item) => {
		const storage = storageOf(item.storage);
		const values = item.keys
			.map((key) => [key, storage?.getItem(key) ?? null] as const)
			.filter((entry): entry is readonly [string, string] => entry[1] !== null);
		if (values.length === 0) return [];
		return [{ item, summary: item.summarize?.(values[0][1]) ?? null }];
	});
}

/** 지운다. 저장소를 쓸 수 없으면 조용히 넘어간다 */
export function clearBrowserData(item: BrowserDataItem) {
	const storage = storageOf(item.storage);
	try {
		item.keys.forEach((key) => storage?.removeItem(key));
	} catch {
		// 지우지 못해도 다음에 다시 시도할 수 있다
	}
}
