import { describe, expect, it } from 'vitest';
import { flyTransform } from './windowMotion';

describe('flyTransform', () => {
	it('가운데끼리 맞추고 폭 비율로 줄인다', () => {
		const window = { x: 100, y: 100, width: 800, height: 600 };
		const icon = { x: 460, y: 900, width: 80, height: 80 };
		// 창 가운데 (500, 400) → 아이콘 가운데 (500, 940)
		expect(flyTransform(window, icon)).toBe('translate(0px, 540px) scale(0.100)');
	});

	it('아주 작은 대상이라도 0으로 줄이지 않는다', () => {
		expect(flyTransform({ x: 0, y: 0, width: 1000, height: 1000 }, { x: 0, y: 0, width: 1, height: 1 })).toContain(
			'scale(0.050)'
		);
	});
});
