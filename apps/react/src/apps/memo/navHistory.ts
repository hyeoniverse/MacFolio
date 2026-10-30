// 메모 앱 안의 뒤로·앞으로 기록 (Finder·Safari의 ‹ › 버튼). 순수 함수만 둔다.
// 브라우저 기록(history.pushState)에는 쌓지 않는다: 주소 막대는 맨 앞 창의 글을 replace로 따라가고(shared/lib/appLink),
// 여러 앱 창이 한 탭에 떠 있어 브라우저 뒤로 가기가 어느 창의 기록인지 정할 수 없다.
// 대신 브라우저 기록과 같은 범위로 sessionStorage에 둔다: 새로 고쳐도 남고, 탭마다 따로이고, 탭을 닫으면 사라진다

/** 기록 한 칸: 연 폴더(또는 보기)와 그때 본 글 */
export interface NavEntry {
	/** 폴더 경로 또는 '모든 글'·인기글·태그 같은 보기 */
	category: string;
	/** 태그로 볼 때 고른 태그 (JSON). 태그 보기가 아니면 빈 문자열 */
	tags: string;
	/** 본 글 주소. 글이 없는 폴더면 null */
	slug: string | null;
	/** 이 칸을 떠날 때의 본문 스크롤 위치(px). 뒤로·앞으로 돌아오면 이 위치에서 시작한다. 아직 떠나지 않은 칸은 없다 */
	scroll?: number;
}

export interface NavHistory {
	entries: NavEntry[];
	/** 지금 칸 (기록이 없으면 -1) */
	index: number;
}

/** 기록 길이 상한: 넘으면 오래된 칸부터 버린다 */
export const NAV_HISTORY_LIMIT = 50;

export const EMPTY_NAV_HISTORY: NavHistory = { entries: [], index: -1 };

export const sameEntry = (a: NavEntry, b: NavEntry) =>
	a.category === b.category && a.tags === b.tags && a.slug === b.slug;

/** 스크롤 위치의 상한(px). 저장한 값이 이상하면 버린다 */
const MAX_SCROLL = 10_000_000;

/** 지금 칸에 떠나는 순간의 본문 스크롤 위치를 적는다 (다른 칸으로 가기 직전에 부른다). 같으면 그대로 */
export function rememberScroll(history: NavHistory, scroll: number): NavHistory {
	const current = history.entries[history.index];
	const top = Math.round(Math.min(Math.max(scroll, 0), MAX_SCROLL));
	if (!current || !Number.isFinite(top) || current.scroll === top) return history;
	const entries = history.entries.slice();
	entries[history.index] = { ...current, scroll: top };
	return { ...history, entries };
}

/**
 * 새 칸을 지금 칸 뒤에 쌓는다. 앞으로 갈 기록은 버린다(Safari와 같다). 지금 칸과 같으면 그대로.
 * 같은 폴더에서 글이 아직 없던 칸(글을 불러오기 전, 폴더를 연 직후)은 글이 열리면 그 칸을 바꾼다 (빈 칸이 기록에 남지 않게)
 */
export function visit(history: NavHistory, entry: NavEntry): NavHistory {
	const current = history.entries[history.index];
	if (current && sameEntry(current, entry)) return history;
	const fills = current && current.slug === null && current.category === entry.category && current.tags === entry.tags;
	const kept = history.entries.slice(0, fills ? history.index : history.index + 1);
	const entries = [...kept, entry].slice(-NAV_HISTORY_LIMIT);
	return { entries, index: entries.length - 1 };
}

/**
 * 한 칸 뒤(-1)·앞(1)으로 갈 칸. 지운 글처럼 갈 수 없는 칸(usable이 false)은 건너뛴다. 갈 곳이 없으면 null
 */
export function stepTarget(
	history: NavHistory,
	direction: -1 | 1,
	usable: (entry: NavEntry) => boolean
): number | null {
	for (let index = history.index + direction; index >= 0 && index < history.entries.length; index += direction)
		if (usable(history.entries[index])) return index;
	return null;
}

/** 길게 눌렀을 때 보일 목록: 가까운 칸부터. 갈 수 없는 칸은 뺀다 */
export function stepList(
	history: NavHistory,
	direction: -1 | 1,
	usable: (entry: NavEntry) => boolean
): { index: number; entry: NavEntry }[] {
	const list: { index: number; entry: NavEntry }[] = [];
	for (let index = history.index + direction; index >= 0 && index < history.entries.length; index += direction)
		if (usable(history.entries[index])) list.push({ index, entry: history.entries[index] });
	return list;
}

/** 저장 형식 버전 (탭 안에서 새로 고쳐도 기록이 남게 sessionStorage에 둔다). 형식을 바꾸면 올린다 */
export const NAV_HISTORY_VERSION = 1;

/** 저장할 모양 */
export const serializeNavHistory = (history: NavHistory) => ({
	v: NAV_HISTORY_VERSION,
	index: history.index,
	entries: history.entries,
});

const isEntry = (value: unknown): value is NavEntry => {
	if (!value || typeof value !== 'object') return false;
	const { category, tags, slug, scroll } = value as Record<string, unknown>;
	return (
		(scroll === undefined ||
			(typeof scroll === 'number' && Number.isFinite(scroll) && scroll >= 0 && scroll <= MAX_SCROLL)) &&
		typeof category === 'string' &&
		category.length <= 300 &&
		typeof tags === 'string' &&
		tags.length <= 2000 &&
		(slug === null || (typeof slug === 'string' && slug.length <= 200))
	);
};

/** 저장한 기록을 읽는다. 버전이 다르거나 모양이 틀리면 버린다(빈 기록). 길이는 상한까지, 지금 칸은 범위 안으로 */
export function parseNavHistory(value: unknown): NavHistory {
	if (!value || typeof value !== 'object') return EMPTY_NAV_HISTORY;
	const { v, index, entries } = value as Record<string, unknown>;
	if (v !== NAV_HISTORY_VERSION || !Array.isArray(entries) || !entries.every(isEntry)) return EMPTY_NAV_HISTORY;
	if (typeof index !== 'number' || !Number.isInteger(index)) return EMPTY_NAV_HISTORY;
	const dropped = Math.max(0, entries.length - NAV_HISTORY_LIMIT);
	const kept = entries
		.slice(dropped)
		.map(({ category, tags, slug, scroll }) => ({ category, tags, slug, ...(scroll !== undefined && { scroll }) }));
	if (kept.length === 0) return EMPTY_NAV_HISTORY;
	return { entries: kept, index: Math.min(Math.max(index - dropped, 0), kept.length - 1) };
}

/**
 * 갈 수 없게 된 칸(지운 글, 비밀 글로 바뀌어 볼 수 없는 글, 없어진 폴더)을 빼고, 지금 칸을 남은 칸에 맞춘다.
 * 지금 칸이 빠지면 그 앞의 가장 가까운 칸이 지금 칸이 된다(없으면 뒤의 첫 칸). 빼서 이웃하게 된 같은 칸은 하나로 합친다
 */
export function pruneNavHistory(history: NavHistory, usable: (entry: NavEntry) => boolean): NavHistory {
	const entries: NavEntry[] = [];
	let index = -1;
	history.entries.forEach((entry, at) => {
		if (!usable(entry)) return;
		const previous = entries.at(-1);
		if (!previous || !sameEntry(previous, entry)) entries.push(entry);
		if (at <= history.index) index = entries.length - 1;
	});
	if (entries.length === 0) return EMPTY_NAV_HISTORY;
	return { entries, index: index < 0 ? 0 : index };
}
