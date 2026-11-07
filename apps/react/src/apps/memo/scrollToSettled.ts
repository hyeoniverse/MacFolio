// 본문의 한 요소(목차 제목)로 넘기고, 본문 높이가 자리 잡을 때까지 그 요소를 맨 위에 붙잡아 둔다.
//
// 본문 그림은 loading="lazy"라 화면 근처에 와야 내려받고, 받기 전에는 높이가 0이다.
// 목차로 멀리 넘기면 지나가거나 도착한 자리 근처의 그림이 그제야 받아져 위쪽 본문이 늘어나고,
// 제목이 화면 아래로 밀려난다 (그림이 많은 글에서 수백~수천 px).
// 그래서 넘긴 뒤 본문 높이가 바뀔 때마다 같은 제목으로 다시 넘기고, 높이가 QUIET_MS 동안 그대로면 멈춘다.
// 사용자가 직접 스크롤하면(휠·터치·키) 바로 멈춘다.

/** 본문 높이가 이 시간 동안 바뀌지 않으면 자리 잡은 것으로 본다 */
const QUIET_MS = 1200;
/** 그림이 늦게 오더라도 이 시간이 지나면 붙잡기를 그만둔다 */
const MAX_MS = 5000;
/** 이 화면 수 안쪽으로 넘길 때만 부드럽게 스크롤한다 */
const SMOOTH_SCREENS = 3;
/** 사용자가 직접 스크롤하는 입력 */
const USER_SCROLL = ['wheel', 'touchstart', 'keydown'] as const;

/**
 * target으로 넘기고, body의 높이가 바뀌는 동안 target을 다시 맞춘다. 돌려준 함수로 그만둔다 (다음 이동·화면을 닫을 때).
 * scroller는 사용자 스크롤을 알아차릴 스크롤 칸이다.
 */
export function scrollToSettled(
	target: HTMLElement,
	body: HTMLElement | null,
	scroller: HTMLElement | null,
	smooth: boolean
): () => void {
	// 멀리 넘길 때 부드럽게 스크롤하면 지나가는 그림을 모두 내려받으며 본문이 계속 늘어나 몇 초 동안 도착하지 못한다.
	// 그래서 화면 높이의 SMOOTH_SCREENS배 안쪽만 부드럽게 넘기고, 더 멀면 바로 넘긴다
	const distance = scroller ? Math.abs(target.getBoundingClientRect().top - scroller.getBoundingClientRect().top) : 0;
	const behavior: ScrollBehavior =
		smooth && (!scroller || distance <= scroller.clientHeight * SMOOTH_SCREENS) ? 'smooth' : 'auto';
	target.scrollIntoView({ block: 'start', behavior });
	if (!body || typeof ResizeObserver === 'undefined') return () => undefined;

	let height = body.getBoundingClientRect().height;
	let quiet: ReturnType<typeof setTimeout> | undefined;
	let resize: ResizeObserver | null = null;
	const stopAll = () => {
		clearTimeout(quiet);
		clearTimeout(max);
		resize?.disconnect();
		for (const type of USER_SCROLL) scroller?.removeEventListener(type, stopAll);
	};
	const restartQuiet = () => {
		clearTimeout(quiet);
		quiet = setTimeout(stopAll, QUIET_MS);
	};
	resize = new ResizeObserver(() => {
		const next = body.getBoundingClientRect().height;
		if (Math.abs(next - height) < 1) return;
		height = next;
		// 다시 맞출 때는 바로 넘긴다 (부드러운 스크롤을 다시 시작하면 그동안 또 그림이 받아진다)
		target.scrollIntoView({ block: 'start', behavior: 'auto' });
		restartQuiet();
	});
	resize.observe(body);
	const max = setTimeout(stopAll, MAX_MS);
	restartQuiet();
	for (const type of USER_SCROLL) scroller?.addEventListener(type, stopAll, { passive: true });
	return stopAll;
}
