import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_ARRANGEMENT, type Arrangement } from '@macfolio/desktop-core/memo';
import {
	loadArrangement,
	loadRecentFinds,
	loadRecentSearches,
	loadPaneWidth,
	PANE_WIDTHS,
	rememberFind,
	rememberSearch,
	saveArrangement,
	savePaneWidth,
} from './memoStorage';

describe('memoStorage', () => {
	// 테스트는 Node에서 돌므로 localStorage를 흉내 낸다
	beforeEach(() => {
		const store = new Map<string, string>();
		vi.stubGlobal('localStorage', {
			getItem: (key: string) => store.get(key) ?? null,
			setItem: (key: string, value: string) => store.set(key, value),
			removeItem: (key: string) => store.delete(key),
		});
	});
	afterEach(() => vi.unstubAllGlobals());

	it('저장한 보기 설정을 읽는다', () => {
		const arrangement: Arrangement = { sort: 'title', order: 'desc', groupByDate: false };
		saveArrangement(arrangement);
		expect(loadArrangement()).toEqual(arrangement);
	});

	it('없거나 JSON이 아니면 기본값으로', () => {
		expect(loadArrangement()).toEqual(DEFAULT_ARRANGEMENT);
		localStorage.setItem('macfolio:memo:arrangement', 'not json');
		expect(loadArrangement()).toEqual(DEFAULT_ARRANGEMENT);
	});

	it('최근 검색어를 저장하고 다시 읽는다', () => {
		rememberFind(rememberFind([], 'a'), 'b');
		expect(loadRecentFinds()).toEqual(['b', 'a']);
	});

	it('목록 검색어는 본문 찾기와 따로 저장한다', () => {
		rememberSearch('react');
		rememberSearch('  flux ');
		rememberSearch('react');
		rememberSearch('');
		expect(loadRecentSearches()).toEqual(['react', 'flux']);
		expect(loadRecentFinds()).toEqual([]);
	});

	it('칸 너비: 저장한 값을 읽고, 없거나 잘못되면 기본값, 범위 밖이면 범위 안으로', () => {
		expect(loadPaneWidth('sidebar')).toBe(PANE_WIDTHS.sidebar.initial);
		expect(loadPaneWidth('list')).toBe(PANE_WIDTHS.list.initial);
		savePaneWidth('sidebar', 260);
		savePaneWidth('list', 320);
		expect(loadPaneWidth('sidebar')).toBe(260);
		expect(loadPaneWidth('list')).toBe(320);
		localStorage.setItem('macfolio:memo:sidebar-width', 'wide');
		expect(loadPaneWidth('sidebar')).toBe(PANE_WIDTHS.sidebar.initial);
		localStorage.setItem('macfolio:memo:list-width', '9999');
		expect(loadPaneWidth('list')).toBe(PANE_WIDTHS.list.max);
		localStorage.setItem('macfolio:memo:sidebar-width', '10');
		expect(loadPaneWidth('sidebar')).toBe(PANE_WIDTHS.sidebar.min);
	});

	it('칸 너비를 기본값으로 되돌리면 저장한 값을 지운다', () => {
		savePaneWidth('list', 300);
		savePaneWidth('list', PANE_WIDTHS.list.initial);
		expect(localStorage.getItem('macfolio:memo:list-width')).toBeNull();
	});
});
