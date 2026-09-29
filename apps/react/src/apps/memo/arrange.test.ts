import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	dateGroup,
	DEFAULT_ARRANGEMENT,
	groupPosts,
	loadArrangement,
	saveArrangement,
	sortBy,
	type Arrangement,
} from './arrange';
import type { Post } from './posts';

const post = (title: string, date: string): Post => ({
	slug: title,
	title,
	date,
	category: '기타',
	summary: '',
	body: '',
});

const today = new Date(2026, 8, 29); // 2026-09-29

describe('sortBy', () => {
	const posts = [post('나', '2026-09-01'), post('가', '2026-09-28'), post('다', '2026-09-28')];

	it('날짜 최신 순, 같은 날은 제목 순', () => {
		expect(sortBy(posts, { sort: 'date', order: 'desc' }).map((p) => p.title)).toEqual(['가', '다', '나']);
	});

	it('날짜 오래된 순', () => {
		expect(sortBy(posts, { sort: 'date', order: 'asc' }).map((p) => p.title)).toEqual(['나', '가', '다']);
	});

	it('제목 가나다 순과 역순', () => {
		expect(sortBy(posts, { sort: 'title', order: 'asc' }).map((p) => p.title)).toEqual(['가', '나', '다']);
		expect(sortBy(posts, { sort: 'title', order: 'desc' }).map((p) => p.title)).toEqual(['다', '나', '가']);
	});

	it('원래 배열은 바꾸지 않는다', () => {
		const copy = [...posts];
		sortBy(posts, { sort: 'title', order: 'asc' });
		expect(posts).toEqual(copy);
	});
});

describe('dateGroup', () => {
	it.each([
		['2026-09-29', '오늘'],
		['2026-10-02', '예정'],
		['2026-09-28', '어제'],
		['2026-09-22', '지난 7일'],
		['2026-09-21', '지난 30일'],
		['2026-08-30', '지난 30일'],
		['2026-08-29', '8월'],
		['2026-01-01', '1월'],
		['2025-12-31', '2025년'],
	])('%s → %s', (date, group) => {
		expect(dateGroup(date, today)).toBe(group);
	});
});

describe('groupPosts', () => {
	const posts = [post('a', '2026-09-29'), post('b', '2026-09-29'), post('c', '2026-09-28'), post('d', '2025-03-01')];

	it('날짜로 정렬하고 묶기를 켜면 이어진 같은 묶음끼리 모은다', () => {
		const groups = groupPosts(posts, DEFAULT_ARRANGEMENT, today);
		expect(groups.map((g) => [g.title, g.posts.map((p) => p.title)])).toEqual([
			['오늘', ['a', 'b']],
			['어제', ['c']],
			['2025년', ['d']],
		]);
	});

	it('묶기를 끄거나 제목으로 정렬하면 한 묶음', () => {
		const off: Arrangement = { ...DEFAULT_ARRANGEMENT, groupByDate: false };
		const byTitle: Arrangement = { ...DEFAULT_ARRANGEMENT, sort: 'title', order: 'asc' };
		expect(groupPosts(posts, off, today)).toEqual([{ title: null, posts }]);
		expect(groupPosts(posts, byTitle, today)).toEqual([{ title: null, posts }]);
	});
});

describe('loadArrangement / saveArrangement', () => {
	// 테스트는 Node에서 돌므로 localStorage를 흉내 낸다
	beforeEach(() => {
		const store = new Map<string, string>();
		vi.stubGlobal('localStorage', {
			getItem: (key: string) => store.get(key) ?? null,
			setItem: (key: string, value: string) => store.set(key, value),
		});
	});
	afterEach(() => vi.unstubAllGlobals());

	it('저장한 설정을 읽는다', () => {
		const arrangement: Arrangement = { sort: 'title', order: 'desc', groupByDate: false };
		saveArrangement(arrangement);
		expect(loadArrangement()).toEqual(arrangement);
	});

	it('없거나 잘못된 값이면 기본값으로', () => {
		expect(loadArrangement()).toEqual(DEFAULT_ARRANGEMENT);
		localStorage.setItem('macfolio:memo:arrangement', '{"sort":"size","order":1}');
		expect(loadArrangement()).toEqual(DEFAULT_ARRANGEMENT);
		localStorage.setItem('macfolio:memo:arrangement', 'not json');
		expect(loadArrangement()).toEqual(DEFAULT_ARRANGEMENT);
	});
});
