import { describe, expect, it } from 'vitest';
import { CLOSE_DISTANCE, shouldCloseSwipe, swipeVelocity } from './swipe';

describe('swipeVelocity', () => {
	it('놓기 직전 100ms 안의 움직임으로 잰다', () => {
		const samples = [
			{ y: 0, time: 0 },
			{ y: 10, time: 200 },
			{ y: 40, time: 250 },
			{ y: 70, time: 300 },
		];
		expect(swipeVelocity(samples)).toBeCloseTo(0.6);
	});

	it('멈췄다가 놓으면 0, 표본이 없거나 하나면 0', () => {
		expect(
			swipeVelocity([
				{ y: 0, time: 0 },
				{ y: 80, time: 50 },
				{ y: 80, time: 300 },
			])
		).toBe(0);
		expect(swipeVelocity([])).toBe(0);
		expect(swipeVelocity([{ y: 5, time: 1 }])).toBe(0);
	});

	it('같은 시각에 들어온 움직임은 1ms 동안으로 본다', () => {
		expect(
			swipeVelocity([
				{ y: 0, time: 10 },
				{ y: 50, time: 10 },
			])
		).toBe(50);
	});
});

describe('shouldCloseSwipe', () => {
	it('기준 거리를 넘으면 느려도 닫는다', () => {
		expect(shouldCloseSwipe(CLOSE_DISTANCE + 1, 0)).toBe(true);
		expect(shouldCloseSwipe(CLOSE_DISTANCE - 1, 0)).toBe(false);
	});

	it('짧아도 빠르게 튕기면 닫고, 떨림 정도의 거리는 닫지 않는다', () => {
		expect(shouldCloseSwipe(40, 1.2)).toBe(true);
		expect(shouldCloseSwipe(40, 0.2)).toBe(false);
		expect(shouldCloseSwipe(8, 3)).toBe(false);
	});

	it('위로 튕기면 닫지 않는다', () => {
		expect(shouldCloseSwipe(40, -2)).toBe(false);
	});
});
