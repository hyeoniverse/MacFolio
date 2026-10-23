// 지금 재생 중 시트를 쓸어내려 닫을지 정하는 규칙 (useSwipeToClose가 사용한다)

/** 이만큼(px) 넘게 끌어 내리면 닫는다 */
export const CLOSE_DISTANCE = 120;
/** 놓기 직전 속도가 이보다 빠르면(px/ms, 아래 방향) 짧게 끌어도 닫는다 (튕기기) */
export const FLICK_VELOCITY = 0.5;
/** 튕기기로 볼 최소 거리(px). 손가락이 살짝 떨린 것은 튕기기가 아니다 */
export const FLICK_MIN_DISTANCE = 16;
/** 속도는 놓기 직전 이 시간(ms) 안의 움직임으로 잰다. 멈췄다 놓으면 0이 된다 */
export const VELOCITY_WINDOW = 100;

export interface SwipeSample {
	/** clientY */
	y: number;
	/** 이벤트 시각 (ms) */
	time: number;
}

/** 마지막 표본 기준 VELOCITY_WINDOW 안의 평균 세로 속도 (px/ms, 아래가 +). 표본이 하나뿐이면 0 */
export function swipeVelocity(samples: SwipeSample[]): number {
	const last = samples.at(-1);
	if (!last) return 0;
	const first = samples.find((sample) => last.time - sample.time <= VELOCITY_WINDOW) ?? last;
	if (first === last) return 0;
	// 같은 시각에 들어온 이벤트(아주 빠른 움직임)는 1ms로 본다
	return (last.y - first.y) / Math.max(1, last.time - first.time);
}

/** 놓았을 때 닫을지: 기준 거리를 넘었거나, 조금 이상 끈 뒤 빠르게 아래로 튕겼으면 */
export const shouldCloseSwipe = (distance: number, velocity: number) =>
	distance > CLOSE_DISTANCE || (distance > FLICK_MIN_DISTANCE && velocity > FLICK_VELOCITY);
