import { describe, expect, it } from 'vitest';
import { formatIso, monthGrid, parseIso, shiftMonth, toIso } from './calendar';
import { fromEditorMarkdown, toEditorMarkdown } from './markdownImages';

describe('이미지 경로', () => {
	const images = { 'images/a.jpg': '/assets/a-123.jpg' };

	it('편집기에서는 빌드된 주소로, 저장할 때는 원래 상대 경로로', () => {
		const source = "앞\n\n![설명](./images/a.jpg '캡션')\n\n![밖](https://x.com/b.png)";
		const shown = toEditorMarkdown(source, images);
		expect(shown).toContain("![설명](/assets/a-123.jpg '캡션')");
		expect(shown).toContain('![밖](https://x.com/b.png)');
		expect(fromEditorMarkdown(shown, images)).toBe(source);
	});

	it('모르는 경로는 그대로', () => {
		expect(toEditorMarkdown('![x](./images/none.jpg)', images)).toBe('![x](./images/none.jpg)');
	});
});

describe('달력', () => {
	it('일요일부터 주 단위로, 앞뒤는 빈 칸', () => {
		const grid = monthGrid(2026, 8); // 2026년 9월: 1일이 화요일
		expect(grid[0]).toEqual([null, null, 1, 2, 3, 4, 5]);
		expect(grid.at(-1)).toEqual([27, 28, 29, 30, null, null, null]);
		expect(grid.flat().filter(Boolean)).toHaveLength(30);
	});

	it('달을 넘기면 연도도 넘어간다', () => {
		expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
		expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
	});

	it('날짜 문자열', () => {
		expect(toIso(2026, 8, 5)).toBe('2026-09-05');
		expect(parseIso('2026-09-05')).toEqual({ year: 2026, month: 8, day: 5 });
		expect(parseIso('어제')).toBeNull();
		expect(formatIso('2026-09-05')).toBe('2026. 9. 5.');
	});
});
