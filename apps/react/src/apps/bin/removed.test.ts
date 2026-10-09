import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { isCalendarDate } from '@macfolio/desktop-core/memo';
import { REMOVED } from './removed';

describe('지운 기능', () => {
	it('이어 주는 개발 일지 글이 모두 있다', () => {
		for (const item of REMOVED.filter((entry) => entry.post)) {
			const file = fileURLToPath(new URL(`../memo/content/${item.post}.md`, import.meta.url));
			expect(existsSync(file), item.post).toBe(true);
		}
	});

	it('id는 겹치지 않고, 날짜는 있는 날이다', () => {
		expect(new Set(REMOVED.map((item) => item.id)).size).toBe(REMOVED.length);
		for (const item of REMOVED) expect(isCalendarDate(item.date), item.id).toBe(true);
	});
});
