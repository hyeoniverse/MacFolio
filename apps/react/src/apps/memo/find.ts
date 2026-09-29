// 글 안에서 찾기 (macOS 메모의 찾기 막대). 읽기 화면과 편집기가 같은 규칙으로 찾는다. 순수 함수만 둔다.

export type FindMode = 'contains' | 'startsWith' | 'wholeWord';

export interface FindOptions {
	/** 영문 대/소문자 무시 */
	ignoreCase: boolean;
	/** 순환 검색: 끝에서 다음을 누르면 처음으로 */
	wrap: boolean;
	/** 다음을 포함 / 다음으로 시작 / 전체 단어 */
	mode: FindMode;
}

export const DEFAULT_FIND_OPTIONS: FindOptions = { ignoreCase: true, wrap: true, mode: 'contains' };

/** 단어를 이루는 글자 (한글·영문·숫자·밑줄) */
const WORD = /[\p{L}\p{N}_]/u;
const isWordChar = (char: string | undefined) => char !== undefined && WORD.test(char);

/**
 * text에서 query가 나오는 자리 [시작, 끝). 겹치지 않게 앞에서부터 찾는다.
 * 다음으로 시작: 단어 첫머리에서만, 전체 단어: 앞뒤가 단어 경계일 때만
 */
export function findMatches(text: string, query: string, options: FindOptions): [number, number][] {
	if (!query) return [];
	const haystack = options.ignoreCase ? text.toLowerCase() : text;
	const needle = options.ignoreCase ? query.toLowerCase() : query;
	const matches: [number, number][] = [];
	let from = 0;
	while (from <= haystack.length - needle.length) {
		const at = haystack.indexOf(needle, from);
		if (at === -1) break;
		const end = at + needle.length;
		const startsWord = !isWordChar(text[at - 1]);
		const endsWord = !isWordChar(text[end]);
		const ok = options.mode === 'contains' || (startsWord && (options.mode === 'startsWith' || endsWord));
		if (ok) {
			matches.push([at, end]);
			from = end;
		} else from = at + 1;
	}
	return matches;
}

/** 다음·이전 찾기: 끝에 닿으면 순환 검색이면 반대쪽 끝으로, 아니면 그 자리에 머문다 */
export function stepMatch(index: number, count: number, direction: 1 | -1, wrap: boolean): number {
	if (count === 0) return -1;
	if (index < 0) return direction === 1 ? 0 : count - 1;
	const next = index + direction;
	if (next >= count) return wrap ? 0 : count - 1;
	if (next < 0) return wrap ? count - 1 : 0;
	return next;
}

/**
 * 여러 덩어리(문단, 칸, 제목 …)의 글에서 찾는다. 덩어리를 넘는 자리는 찾지 않는다.
 * 돌려주는 자리는 [덩어리 번호, 시작, 끝]
 */
export function findInBlocks(blocks: string[], query: string, options: FindOptions): [number, number, number][] {
	return blocks.flatMap((text, block) =>
		findMatches(text, query, options).map(([start, end]) => [block, start, end] as [number, number, number])
	);
}

const RECENT_KEY = 'macfolio:memo:recent-finds';
const MAX_RECENT = 5;

export function loadRecentFinds(): string[] {
	try {
		const list = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as unknown;
		return Array.isArray(list)
			? list.filter((item): item is string => typeof item === 'string').slice(0, MAX_RECENT)
			: [];
	} catch {
		return [];
	}
}

/** 최근 검색에 더한다 (같은 말은 맨 앞으로) */
export function rememberFind(recent: string[], query: string): string[] {
	const trimmed = query.trim();
	if (!trimmed) return recent;
	const next = [trimmed, ...recent.filter((item) => item !== trimmed)].slice(0, MAX_RECENT);
	saveRecentFinds(next);
	return next;
}

export function saveRecentFinds(list: string[]) {
	try {
		localStorage.setItem(RECENT_KEY, JSON.stringify(list));
	} catch {
		// 저장하지 못해도 찾기는 된다
	}
}
