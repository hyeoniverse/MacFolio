import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_ARRANGEMENT, type Arrangement } from '@macfolio/desktop-core/memo';
import {
	loadArrangement,
	loadRecentFinds,
	loadSidebarWidth,
	rememberFind,
	saveArrangement,
	saveSidebarWidth,
	SIDEBAR_WIDTH,
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

	it('사이드바 너비: 저장한 값을 읽고, 없거나 잘못되면 기본값, 범위 밖이면 범위 안으로', () => {
		expect(loadSidebarWidth()).toBe(SIDEBAR_WIDTH.initial);
		saveSidebarWidth(260);
		expect(loadSidebarWidth()).toBe(260);
		localStorage.setItem('macfolio:memo:sidebar-width', 'wide');
		expect(loadSidebarWidth()).toBe(SIDEBAR_WIDTH.initial);
		localStorage.setItem('macfolio:memo:sidebar-width', '9999');
		expect(loadSidebarWidth()).toBe(SIDEBAR_WIDTH.max);
		localStorage.setItem('macfolio:memo:sidebar-width', '10');
		expect(loadSidebarWidth()).toBe(SIDEBAR_WIDTH.min);
	});

	it('사이드바 너비를 기본값으로 되돌리면 저장한 값을 지운다', () => {
		saveSidebarWidth(300);
		saveSidebarWidth(SIDEBAR_WIDTH.initial);
		expect(localStorage.getItem('macfolio:memo:sidebar-width')).toBeNull();
	});
});
