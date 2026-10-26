import { describe, expect, it } from 'vitest';
import { activeHeading, showsToc } from './toc';

describe('목차', () => {
	it('제목이 셋 이상일 때만 보인다', () => {
		const entry = { level: 2 as const, text: '제목' };
		expect(showsToc([entry, entry])).toBe(false);
		expect(showsToc([entry, entry, entry])).toBe(true);
	});

	it('지금 읽는 절은 기준선을 지난 마지막 제목, 첫 제목 위면 -1', () => {
		expect(activeHeading([200, 600, 1200], 96)).toBe(-1);
		expect(activeHeading([80, 600, 1200], 96)).toBe(0);
		expect(activeHeading([-900, -300, 40], 96)).toBe(2);
		expect(activeHeading([-900, 96, 400], 96)).toBe(1);
	});
});
