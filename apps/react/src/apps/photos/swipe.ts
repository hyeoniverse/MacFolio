/**
 * 트랙패드 두 손가락 가로 스와이프를 사진 넘기기로 바꾼다.
 * 가로로 민 양이 쌓이면 한 장 넘기고, 그 뒤로 오는 관성(점점 약해지는 휠 이벤트)으로는 더 넘기지 않는다.
 * 관성이 끝나기 전에 다시 밀어도 넘어가야 하므로, 쉬는 시간만 기다리지 않고 "약해지던 세기가 다시 세지면" 새 스와이프로 본다
 */

/** 이만큼 가로로 밀면 한 장 */
export const SWIPE_DELTA = 60;
/** 이 시간 동안 이벤트가 없으면 스와이프가 끝난 것 */
export const SWIPE_IDLE_MS = 200;
/** 관성 중 세기가 가장 셀 때의 이 비율 밑으로 내려갔다가 */
const DECAYED = 0.6;
/** 직전보다 이 배 넘게, 이 값 넘게 세지면 새로 민 것 */
const RISE = 1.5;
const RISE_MIN = 4;

export interface SwipeState {
	sum: number;
	/** 한 장 넘긴 뒤 관성을 무시하는 중 */
	locked: boolean;
	/** 넘긴 뒤 가장 센 세기와 직전 세기 */
	peak: number;
	last: number;
	/** 마지막 이벤트 시각 (ms) */
	at: number;
}

export const initialSwipe = (): SwipeState => ({ sum: 0, locked: false, peak: 0, last: 0, at: -Infinity });

/** 가로 휠 이벤트 하나. 넘길 방향(1 다음, -1 이전, 0 그대로)과 다음 상태 */
export function swipeStep(state: SwipeState, deltaX: number, now: number): { move: -1 | 0 | 1; state: SwipeState } {
	let next: SwipeState = now - state.at > SWIPE_IDLE_MS ? initialSwipe() : { ...state };
	next.at = now;
	const strength = Math.abs(deltaX);
	if (next.locked) {
		const decayed = next.last < next.peak * DECAYED;
		const rising = strength > next.last * RISE && strength >= RISE_MIN;
		// 관성이 약해지던 중에 다시 세지면 손가락으로 새로 민 것
		if (decayed && rising) next = { ...initialSwipe(), at: now };
		else {
			next.peak = Math.max(next.peak, strength);
			next.last = strength;
			return { move: 0, state: next };
		}
	}
	next.sum += deltaX;
	if (Math.abs(next.sum) < SWIPE_DELTA) return { move: 0, state: next };
	// 손가락을 왼쪽으로 밀면(내용이 왼쪽으로, deltaX > 0) 다음 사진
	return {
		move: next.sum > 0 ? 1 : -1,
		state: { sum: 0, locked: true, peak: strength, last: strength, at: now },
	};
}
