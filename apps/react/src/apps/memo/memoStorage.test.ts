import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_ARRANGEMENT, type Arrangement } from '@macfolio/desktop-core/memo';
import { loadArrangement, loadRecentFinds, rememberFind, saveArrangement } from './memoStorage';

describe('memoStorage', () => {
	// 테스트는 Node에서 돌므로 localStorage를 흉내 낸다
	beforeEach(() => {
		const store = new Map<string, string>();
		vi.stubGlobal('localStorage', {
			getItem: (key: string) => store.get(key) ?? null,
			setItem: (key: string, value: string) => store.set(key, value),
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
});
