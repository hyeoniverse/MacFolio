import { describe, expect, it } from 'vitest';
import { clampRect, defaultRect, maximizedRect, MIN_SIZE, moveRect, resizeRect, STATUSBAR_HEIGHT } from './geometry';

const viewport = { width: 1600, height: 1000 };

describe('defaultRect', () => {
	it('넓은 화면에서는 폭의 40%, 높이의 40%', () => {
		expect(defaultRect(viewport)).toEqual({ x: 100, y: 100, width: 640, height: 400 });
	});

	it('폭은 800을 넘지 않는다', () => {
		expect(defaultRect({ width: 2560, height: 1440 }).width).toBe(800);
	});

	it('좁은 화면에서도 최소 400×300', () => {
		const rect = defaultRect({ width: 900, height: 700 });
		expect(rect.width).toBe(400);
		expect(rect.height).toBe(300);
	});
});

describe('clampRect', () => {
	it('화면 밖으로 나간 창을 화면 안으로 되돌린다', () => {
		expect(clampRect({ x: 5000, y: -300, width: 640, height: 400 }, viewport)).toEqual({
			x: 1600 - 640,
			y: STATUSBAR_HEIGHT,
			width: 640,
			height: 400,
		});
	});

	it('화면보다 큰 창은 화면 크기로 줄인다', () => {
		const rect = clampRect({ x: 0, y: 0, width: 3000, height: 3000 }, viewport);
		expect(rect).toEqual({ x: 0, y: STATUSBAR_HEIGHT, width: 1600, height: 1000 - STATUSBAR_HEIGHT });
	});

	it('최소 크기보다 작게 만들지 않는다', () => {
		const rect = clampRect({ x: 10, y: 50, width: 10, height: 10 }, viewport);
		expect(rect.width).toBe(MIN_SIZE.width);
		expect(rect.height).toBe(MIN_SIZE.height);
	});
});

describe('moveRect', () => {
	const start = { x: 100, y: 100, width: 640, height: 400 };

	it('포인터가 움직인 만큼 옮긴다', () => {
		expect(moveRect(start, 120, 60, viewport)).toEqual({ ...start, x: 220, y: 160 });
	});

	it('상태 표시줄 위로는 올라가지 않는다', () => {
		expect(moveRect(start, 0, -500, viewport).y).toBe(STATUSBAR_HEIGHT);
	});
});

describe('resizeRect', () => {
	const start = { x: 100, y: 100, width: 640, height: 400 };

	it('오른쪽 아래 모서리: 크기만 바뀐다', () => {
		expect(resizeRect(start, 'bottom-right', 50, 30, viewport)).toEqual({ ...start, width: 690, height: 430 });
	});

	it('왼쪽 변: 오른쪽 변은 고정되고 위치와 폭이 바뀐다', () => {
		const rect = resizeRect(start, 'left', -40, 0, viewport);
		expect(rect.x).toBe(60);
		expect(rect.x + rect.width).toBe(start.x + start.width);
	});

	it('최소 크기 아래로는 줄지 않고, 반대쪽 변은 움직이지 않는다', () => {
		const rect = resizeRect(start, 'top-left', 1000, 1000, viewport);
		expect(rect.width).toBe(MIN_SIZE.width);
		expect(rect.height).toBe(MIN_SIZE.height);
		expect(rect.x + rect.width).toBe(start.x + start.width);
		expect(rect.y + rect.height).toBe(start.y + start.height);
	});

	it('화면 밖으로 늘어나지 않는다', () => {
		const rect = resizeRect(start, 'right', 5000, 0, viewport);
		expect(rect.x + rect.width).toBe(viewport.width);
	});
});

describe('maximizedRect', () => {
	it('상태 표시줄 아래 전체를 채운다', () => {
		expect(maximizedRect(viewport)).toEqual({
			x: 0,
			y: STATUSBAR_HEIGHT,
			width: 1600,
			height: 1000 - STATUSBAR_HEIGHT,
		});
	});
});
