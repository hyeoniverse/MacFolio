// 메모 목록의 정렬과 날짜별 그룹화 (macOS 메모의 '정렬 기준', '날짜별로 그룹화').
// 보기 설정이라 방문자도 바꿀 수 있고, 이 브라우저에 저장한다. React에 의존하지 않는 순수 함수만 둔다.
import type { Post } from './posts';

export type SortKey = 'date' | 'title';
export type SortOrder = 'desc' | 'asc';

export interface Arrangement {
	sort: SortKey;
	/** 날짜: desc 최신 순 / asc 오래된 순. 제목: asc 가나다 순 / desc 역순 */
	order: SortOrder;
	/** 날짜별로 묶어 보여줄지 (날짜로 정렬할 때만) */
	groupByDate: boolean;
}

export const DEFAULT_ARRANGEMENT: Arrangement = { sort: 'date', order: 'desc', groupByDate: true };

/** 정렬 기준마다 기본 순서 (날짜는 최신 순, 제목은 가나다 순) */
export const DEFAULT_ORDER: Record<SortKey, SortOrder> = { date: 'desc', title: 'asc' };

/** 순서 이름 */
export const ORDER_LABELS: Record<SortKey, Record<SortOrder, string>> = {
	date: { desc: '최신 순', asc: '오래된 순' },
	title: { asc: '가나다 순', desc: '역순' },
};

/** 정렬한다. 같은 날짜면 제목 순, 같은 제목이면 최신 순 */
export function sortBy(posts: Post[], { sort, order }: Pick<Arrangement, 'sort' | 'order'>): Post[] {
	const sign = order === 'asc' ? 1 : -1;
	return [...posts].sort((a, b) =>
		sort === 'date'
			? sign * a.date.localeCompare(b.date) || a.title.localeCompare(b.title)
			: sign * a.title.localeCompare(b.title, 'ko') || b.date.localeCompare(a.date)
	);
}

/** YYYY-MM-DD를 그 날 자정(지역 시간)으로 */
const toDay = (date: string) => {
	const [year, month, day] = date.split('-').map(Number);
	return new Date(year, month - 1, day);
};

const DAY = 24 * 60 * 60 * 1000;

/**
 * 날짜가 들어갈 묶음 이름 (macOS 메모와 같은 구간).
 * 오늘, 어제, 지난 7일, 지난 30일, 올해는 'N월', 그 전은 'YYYY년'. 미래 날짜는 '오늘'로 본다.
 */
export function dateGroup(date: string, today: Date): string {
	const day = toDay(date);
	const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
	const days = Math.round((base.getTime() - day.getTime()) / DAY);
	if (days <= 0) return '오늘';
	if (days === 1) return '어제';
	if (days <= 7) return '지난 7일';
	if (days <= 30) return '지난 30일';
	if (day.getFullYear() === base.getFullYear()) return `${day.getMonth() + 1}월`;
	return `${day.getFullYear()}년`;
}

export interface PostGroup {
	/** 묶음 이름. 묶지 않으면 null */
	title: string | null;
	posts: Post[];
}

/** 정렬한 글을 묶는다. 날짜로 정렬하고 묶기를 켰을 때만 묶고, 아니면 한 묶음 */
export function groupPosts(posts: Post[], arrangement: Arrangement, today: Date): PostGroup[] {
	if (!(arrangement.groupByDate && arrangement.sort === 'date')) return [{ title: null, posts }];
	const groups: PostGroup[] = [];
	for (const post of posts) {
		const title = dateGroup(post.date, today);
		const last = groups.at(-1);
		// 정렬되어 있으므로 같은 묶음은 이어져 있다
		if (last?.title === title) last.posts.push(post);
		else groups.push({ title, posts: [post] });
	}
	return groups;
}

const ARRANGEMENT_KEY = 'macfolio:memo:arrangement';

/** 저장된 보기 설정. 없거나 잘못되었으면 기본값 */
export function loadArrangement(): Arrangement {
	try {
		const saved = JSON.parse(localStorage.getItem(ARRANGEMENT_KEY) ?? 'null') as Partial<Arrangement> | null;
		if (!saved) return DEFAULT_ARRANGEMENT;
		return {
			sort: saved.sort === 'title' ? 'title' : 'date',
			order: saved.order === 'asc' ? 'asc' : 'desc',
			groupByDate: typeof saved.groupByDate === 'boolean' ? saved.groupByDate : DEFAULT_ARRANGEMENT.groupByDate,
		};
	} catch {
		return DEFAULT_ARRANGEMENT;
	}
}

export function saveArrangement(arrangement: Arrangement) {
	try {
		localStorage.setItem(ARRANGEMENT_KEY, JSON.stringify(arrangement));
	} catch {
		// 저장하지 못해도 이번에는 그대로 보인다
	}
}
