import { describe, expect, it } from 'vitest';
import { EDGE, placeAtPoint, placeBelow, placeRight } from './placement';

const view = { width: 1000, height: 800 };
const size = { width: 200, height: 300 };
const anchor = { left: 100, top: 50, right: 140, bottom: 80, width: 40 };

describe('떠 있는 창의 자리', () => {
	it('한 점에 맞추고, 넘치면 화면 안쪽으로 당긴다', () => {
		expect(placeAtPoint({ left: 300, top: 200 }, size, view)).toEqual({ left: 300, top: 200 });
		expect(placeAtPoint({ left: 950, top: 700 }, size, view)).toEqual({
			left: 1000 - 200 - EDGE,
			top: 800 - 300 - EDGE,
		});
		expect(placeAtPoint({ left: -20, top: -5 }, size, view)).toEqual({ left: EDGE, top: EDGE });
	});

	it('기준 아래: 왼쪽 맞춤과 가운데 맞춤, 가로로만 당긴다', () => {
		expect(placeBelow(anchor, size, {}, view)).toEqual({ left: 100, top: 86 });
		expect(placeBelow(anchor, size, { align: 'center', gap: 8 }, view)).toEqual({ left: 20, top: 88 });
		expect(placeBelow({ ...anchor, left: 0, right: 40 }, size, { align: 'center' }, view).left).toBe(EDGE);
		expect(placeBelow({ ...anchor, left: 900, right: 940 }, size, {}, view).left).toBe(1000 - 200 - EDGE);
	});

	it('기준 오른쪽: 위를 맞추고, 오른쪽으로 넘치면 안쪽으로', () => {
		expect(placeRight(anchor, size, {}, view)).toEqual({ left: 146, top: 50 });
		expect(placeRight({ ...anchor, right: 900 }, size, {}, view).left).toBe(1000 - 200 - EDGE);
	});
});
