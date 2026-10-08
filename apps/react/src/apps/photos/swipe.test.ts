import { describe, expect, it } from 'vitest';
import { initialSwipe, swipeStep, SWIPE_IDLE_MS } from './swipe';

/** 16ms 간격의 휠 이벤트를 차례로 넣고, 넘긴 방향들을 돌려준다 */
function run(deltas: number[], start = 0) {
	let state = initialSwipe();
	const moves: number[] = [];
	deltas.forEach((delta, at) => {
		const result = swipeStep(state, delta, start + at * 16);
		state = result.state;
		if (result.move) moves.push(result.move);
	});
	return moves;
}

/** 손가락으로 민 뒤 관성 (세졌다가 점점 약해진다) */
const swipe = (sign: 1 | -1) => [8, 16, 24, 30, 26, 20, 14, 9, 6, 4, 3, 2, 1].map((delta) => delta * sign);

describe('트랙패드 스와이프', () => {
	it('한 번 밀면 관성이 끝날 때까지 한 장만 넘긴다', () => {
		expect(run(swipe(1))).toEqual([1]);
		expect(run(swipe(-1))).toEqual([-1]);
	});

	it('관성이 끝나기 전에 다시 밀어도 또 넘긴다 (쉬지 않고 연달아)', () => {
		expect(run([...swipe(1), ...swipe(1), ...swipe(1)])).toEqual([1, 1, 1]);
	});

	it('관성이 한창 셀 때 조금 흔들린 것은 새로 민 것이 아니다', () => {
		expect(run([8, 16, 24, 30, 28, 31, 27, 24, 20])).toEqual([1]);
	});

	it('쉬었다가 밀면 처음부터 센다', () => {
		let state = initialSwipe();
		state = swipeStep(state, 30, 0).state;
		const result = swipeStep(state, 40, SWIPE_IDLE_MS + 1);
		expect(result.move).toBe(0);
	});
});
