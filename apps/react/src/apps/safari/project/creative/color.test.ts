import { describe, expect, it } from 'vitest';
import { contrast, grade, readableAccent, textOnAccent } from './color';

describe('대비 (WCAG)', () => {
	it('검정·흰색은 21, 같은 색은 1', () => {
		expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 1);
		expect(contrast('#ffffff', '#000000')).toBeCloseTo(21, 1);
		expect(contrast('#336699', '#336699')).toBeCloseTo(1, 5);
	});

	it('등급: 7 이상 AAA, 4.5 이상 AA, 3 이상 큰 글자 AA, 그 아래는 부족', () => {
		expect(grade(21)).toBe('AAA');
		expect(grade(5)).toBe('AA');
		expect(grade(3.2)).toBe('큰 글자 AA');
		expect(grade(2)).toBe('부족');
	});
});

describe('읽히는 강조색', () => {
	it('이미 대비가 충분하면 그대로 둔다', () => {
		expect(readableAccent('#000000', '#ffffff')).toBe('#000000');
	});

	it('모자라면 바탕 반대쪽으로 명도를 옮겨 4.5를 넘기고, 색상은 비슷하게 둔다', () => {
		const fixed = readableAccent('#ffd27f', '#ffffff'); // 연한 노랑 위 흰 바탕
		expect(fixed).not.toBe('#ffd27f');
		expect(contrast(fixed, '#ffffff')).toBeGreaterThanOrEqual(4.5);
		// 어두워졌지만 여전히 노란 계열 (빨강 성분이 파랑보다 크다)
		const [r, , b] = [1, 3, 5].map((i) => parseInt(fixed.slice(i, i + 2), 16));
		expect(r).toBeGreaterThan(b);
	});

	it('어두운 바탕에서는 밝은 쪽으로 옮긴다', () => {
		const fixed = readableAccent('#223355', '#000000');
		expect(contrast(fixed, '#000000')).toBeGreaterThanOrEqual(4.5);
	});
});

describe('강조색 면 위 글자', () => {
	const theme = {
		accent: '#1d4ed8',
		lightBg: '#ffffff',
		lightText: '#111111',
		darkBg: '#0b0b0b',
		darkText: '#f2f2f2',
	};

	it('그 모드의 바탕이 충분히 대비되면 바탕색을 쓴다', () => {
		expect(textOnAccent(theme as never, 'light')).toBe('#ffffff');
	});

	it('그 모드의 바탕·글자가 모자라면 반대 모드에서 찾는다', () => {
		const pale = { ...theme, accent: '#e0e7ff', lightText: '#9ca3af' };
		const color = textOnAccent(pale as never, 'light');
		expect(contrast(color, pale.accent)).toBeGreaterThanOrEqual(4.5);
		expect([pale.darkBg, pale.darkText]).toContain(color);
	});
});
