import { describe, expect, it } from 'vitest';
import { addRecentFind, DEFAULT_FIND_OPTIONS, findInBlocks, findMatches, parseRecentFinds, stepMatch } from './find.js';

const opts = (patch: Partial<typeof DEFAULT_FIND_OPTIONS> = {}) => ({ ...DEFAULT_FIND_OPTIONS, ...patch });

describe('글 안에서 찾기', () => {
	it('기본: 영문 대/소문자를 무시하고 포함된 곳을 모두', () => {
		expect(findMatches('Vite vite VITE', 'vite', opts())).toEqual([
			[0, 4],
			[5, 9],
			[10, 14],
		]);
		expect(findMatches('Vite vite', 'vite', opts({ ignoreCase: false }))).toEqual([[5, 9]]);
		expect(findMatches('aaaa', 'aa', opts())).toEqual([
			[0, 2],
			[2, 4],
		]);
		expect(findMatches('아무거나', '', opts())).toEqual([]);
	});

	it('다음으로 시작, 전체 단어', () => {
		const text = '테스트 테스트를 재테스트, test testing';
		expect(findMatches(text, '테스트', opts({ mode: 'startsWith' })).map(([start]) => start)).toEqual([0, 4]);
		expect(findMatches(text, '테스트', opts({ mode: 'wholeWord' }))).toEqual([[0, 3]]);
		expect(findMatches(text, 'test', opts({ mode: 'wholeWord' }))).toEqual([[15, 19]]);
		expect(findMatches(text, 'test', opts({ mode: 'startsWith' })).map(([start]) => start)).toEqual([15, 20]);
	});

	it('덩어리(문단·칸)를 넘어서는 찾지 않는다', () => {
		expect(findInBlocks(['가나', '다라', '나다'], '나다', opts())).toEqual([[2, 0, 2]]);
	});

	it('다음·이전: 순환 검색이면 끝에서 처음으로', () => {
		expect(stepMatch(-1, 3, 1, true)).toBe(0);
		expect(stepMatch(-1, 3, -1, true)).toBe(2);
		expect(stepMatch(2, 3, 1, true)).toBe(0);
		expect(stepMatch(2, 3, 1, false)).toBe(2);
		expect(stepMatch(0, 3, -1, true)).toBe(2);
		expect(stepMatch(0, 3, -1, false)).toBe(0);
		expect(stepMatch(0, 0, 1, true)).toBe(-1);
	});

	it('최근 검색: 같은 말은 맨 앞으로, 다섯 개까지', () => {
		let recent: string[] = [];
		for (const word of ['a', 'b', 'c', 'd', 'e', 'f', 'c']) recent = addRecentFind(recent, word);
		expect(recent).toEqual(['c', 'f', 'e', 'd', 'b']);
		expect(addRecentFind(recent, '  ')).toBe(recent);
	});

	it('저장해 둔 최근 검색: 글자만, 다섯 개까지', () => {
		expect(parseRecentFinds(['a', 1, 'b', null, 'c', 'd', 'e', 'f'])).toEqual(['a', 'b', 'c', 'd', 'e']);
		expect(parseRecentFinds({})).toEqual([]);
	});
});
