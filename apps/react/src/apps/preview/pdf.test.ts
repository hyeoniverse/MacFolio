import { describe, expect, it } from 'vitest';
import { occurrences } from './pdf';

describe('PDF 찾기', () => {
	it('대소문자를 가리지 않고 겹치지 않게 찾는다', () => {
		expect(occurrences('Page one, page two', 'page')).toEqual([0, 10]);
		expect(occurrences('aaaa', 'aa')).toEqual([0, 2]);
		expect(occurrences('이력서 이력', '이력')).toEqual([0, 4]);
	});

	it('빈 말은 찾지 않는다', () => {
		expect(occurrences('abc', '')).toEqual([]);
	});
});
