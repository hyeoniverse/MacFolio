// 메모 앱 안의 뒤로·앞으로 기록 (Finder·Safari의 ‹ › 버튼). 순수 함수만 둔다.
// 브라우저 기록(history.pushState)에는 쌓지 않는다: 주소 막대는 맨 앞 창의 글을 replace로 따라가고(shared/lib/appLink),
// 여러 앱 창이 한 탭에 떠 있어 브라우저 뒤로 가기가 어느 창의 기록인지 정할 수 없다. 기록은 새로 고치면 처음부터 다시 쌓인다

/** 기록 한 칸: 연 폴더(또는 보기)와 그때 본 글 */
export interface NavEntry {
	/** 폴더 경로 또는 '모든 글'·인기글·태그 같은 보기 */
	category: string;
	/** 태그로 볼 때 고른 태그 (JSON). 태그 보기가 아니면 빈 문자열 */
	tags: string;
	/** 본 글 주소. 글이 없는 폴더면 null */
	slug: string | null;
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
