import { describe, expect, it } from 'vitest';
import {
	EMPTY_TAG_SELECTION,
	cycleTag,
	matchesTags,
	nextTagState,
	onlyTag,
	tagSelectionNote,
	tagSelectionTitle,
	toggleAllTags,
	type TagSelection,
} from './tagFilter.js';

describe('tagFilter', () => {
	it('누를 때마다 미선택 → 포함 → 제외 → 미선택', () => {
		expect(nextTagState(undefined)).toBe('include');
		expect(nextTagState('include')).toBe('exclude');
		expect(nextTagState('exclude')).toBeUndefined();
		let selection = cycleTag(EMPTY_TAG_SELECTION, 'a');
		expect(selection.tags).toEqual({ a: 'include' });
		selection = cycleTag(selection, 'a');
		expect(selection.tags).toEqual({ a: 'exclude' });
		selection = cycleTag(selection, 'a');
		expect(selection.tags).toEqual({});
	});

	it('모든 태그는 다른 태그를 풀고, 태그를 누르면 모든 태그가 풀린다', () => {
		const on = toggleAllTags(cycleTag(EMPTY_TAG_SELECTION, 'a'));
		expect(on).toMatchObject({ all: true, tags: {} });
		expect(toggleAllTags(on).all).toBe(false);
		expect(cycleTag(on, 'b')).toMatchObject({ all: false, tags: { b: 'include' } });
	});

	it('포함은 모두/일부, 제외는 그 태그가 있으면 뺀다 (대소문자 무시)', () => {
		const both: TagSelection = { all: false, tags: { a: 'include', b: 'include' }, match: 'all' };
		expect(matchesTags(['A', 'b'], both)).toBe(true);
		expect(matchesTags(['a'], both)).toBe(false);
		expect(matchesTags(['a'], { ...both, match: 'any' })).toBe(true);
		const exclude: TagSelection = { all: false, tags: { a: 'include', c: 'exclude' }, match: 'all' };
		expect(matchesTags(['a', 'c'], exclude)).toBe(false);
		// 제외만 있으면 그 태그가 없는 메모 모두 (태그가 없는 메모도)
		const onlyExclude: TagSelection = { all: false, tags: { c: 'exclude' }, match: 'all' };
		expect(matchesTags([], onlyExclude)).toBe(true);
		expect(matchesTags(['c'], onlyExclude)).toBe(false);
		expect(matchesTags([], { ...EMPTY_TAG_SELECTION, all: true })).toBe(false);
		expect(matchesTags(['x'], { ...EMPTY_TAG_SELECTION, all: true })).toBe(true);
	});

	it('제목과 안내 문구', () => {
		const one = onlyTag(EMPTY_TAG_SELECTION, '디자인');
		expect(tagSelectionTitle(one)).toBe('#디자인');
		expect(tagSelectionNote(one)).toBe('선택된 태그(#디자인)와 일치하는 메모를 표시합니다.');
		const three: TagSelection = { all: false, tags: { a: 'exclude', b: 'include', c: 'exclude' }, match: 'all' };
		expect(tagSelectionTitle(three)).toBe('3개의 태그');
		expect(tagSelectionNote(three)).toBe('3개의 선택된 태그와 모두 일치하는 메모를 표시합니다.');
		expect(tagSelectionNote({ ...three, match: 'any' })).toBe('3개의 선택된 태그와 일부 일치하는 메모를 표시합니다.');
		const excluded: TagSelection = { all: false, tags: { a: 'exclude' }, match: 'all' };
		expect(tagSelectionTitle(excluded)).toBe('1개의 태그');
		expect(tagSelectionNote(excluded)).toBeNull();
		expect(tagSelectionTitle(toggleAllTags(EMPTY_TAG_SELECTION))).toBe('모든 태그');
	});
});
