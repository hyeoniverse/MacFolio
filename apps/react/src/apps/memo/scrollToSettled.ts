// 본문의 한 요소(목차 제목)로 넘기고, 본문 높이가 자리 잡을 때까지 그 요소를 맨 위에 붙잡아 둔다.
//
// 본문 그림은 loading="lazy"라 화면 근처에 와야 내려받고, 받기 전에는 높이가 0이다.
// 목차로 넘기면 지나가거나 도착한 자리 근처의 그림이 그제야 받아져 위쪽 본문이 늘어나고,
// 제목이 화면 아래로 밀려난다 (그림이 많은 글에서 수백~수천 px).
//
// - 부드러운 스크롤은 브라우저의 scroll-behavior: smooth 대신 직접 그린다. 매 프레임 제목의 지금 자리를 다시 재서
//   목적지로 삼으므로, 스크롤하는 동안 그림이 받아져도 애니메이션을 끊지 않고 바뀐 자리로 이어서 도착한다
// - 처음부터 멀리 스크롤하면 지나가는 그림을 모두 내려받으므로, 화면 높이의 SMOOTH_SCREENS배보다 멀면
//   목적지 한 화면 앞까지 바로 옮긴 뒤 마지막 한 화면만 부드럽게 넘긴다
// - 도착한 뒤에도 본문 높이가 바뀌면 같은 제목으로 다시 맞추고, 높이가 QUIET_MS 동안 그대로면 멈춘다
// - 사용자가 직접 스크롤하면(휠·터치·키) 바로 멈춘다

/** 본문 높이가 이 시간 동안 바뀌지 않으면 자리 잡은 것으로 본다 */
const QUIET_MS = 1200;
/** 그림이 늦게 오더라도 이 시간이 지나면 붙잡기를 그만둔다 */
const MAX_MS = 5000;
/** 이 화면 수보다 먼 제목은 한 화면 앞까지 바로 옮긴 뒤 부드럽게 넘긴다 */
const SMOOTH_SCREENS = 3;
/** 부드러운 스크롤 시간: 기본 + 화면 하나마다 더하는 시간, 최대 */
const DURATION_BASE = 280;
const DURATION_PER_SCREEN = 140;
const DURATION_MAX = 700;
/** 사용자가 직접 스크롤하는 입력 */
const USER_SCROLL = ['wheel', 'touchstart', 'keydown'] as const;

/** 처음에 빠르고 끝에서 천천히 멈춘다 */
export const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

/** 부드러운 스크롤 시간 (ms). 화면 몇 개만큼 움직이는지에 비례하고 DURATION_MAX를 넘지 않는다 */
export const smoothDuration = (distance: number, screen: number) =>
	Math.min(DURATION_MAX, DURATION_BASE + (Math.abs(distance) / Math.max(1, screen)) * DURATION_PER_SCREEN);

/**
 * target으로 넘기고, body의 높이가 바뀌는 동안 target을 다시 맞춘다. 돌려준 함수로 그만둔다 (다음 이동·화면을 닫을 때).
 * scroller는 스크롤 칸이다 (없으면 scrollIntoView로 바로 넘기기만 한다).
 */
export function scrollToSettled(
	target: HTMLElement,
	body: HTMLElement | null,
	scroller: HTMLElement | null,
	smooth: boolean
): () => void {
	if (!scroller) {
		target.scrollIntoView({ block: 'start' });
		return () => undefined;
	}
	// 제목을 맨 위에 둘 scrollTop. 붙은 목차 막대 높이만큼 비운 scroll-padding-top을 뺀다 (MemoToc가 정한다)
	const destination = () =>
		scroller.scrollTop +
		target.getBoundingClientRect().top -
		scroller.getBoundingClientRect().top -
		(Number.parseFloat(getComputedStyle(scroller).scrollPaddingTop) || 0);
	const jump = () => scroller.scrollTo({ top: destination(), behavior: 'instant' });

	let frame = 0;
	let animating = false;
	if (smooth) {
		const screen = scroller.clientHeight;
		const distance = destination() - scroller.scrollTop;
		if (Math.abs(distance) > screen * SMOOTH_SCREENS)
			scroller.scrollTo({ top: destination() - Math.sign(distance) * screen, behavior: 'instant' });
		const from = scroller.scrollTop;
		const duration = smoothDuration(destination() - from, screen);
		const start = performance.now();
		animating = true;
		const step = (now: number) => {
			const progress = Math.min(1, (now - start) / duration);
			scroller.scrollTo({ top: from + (destination() - from) * easeOutCubic(progress), behavior: 'instant' });
			if (progress < 1) frame = requestAnimationFrame(step);
			else animating = false;
		};
		frame = requestAnimationFrame(step);
	} else jump();

	let height = body?.getBoundingClientRect().height ?? 0;
	let quiet: ReturnType<typeof setTimeout> | undefined;
	let resize: ResizeObserver | null = null;
	const stopAll = () => {
		cancelAnimationFrame(frame);
		animating = false;
		clearTimeout(quiet);
		clearTimeout(max);
		resize?.disconnect();
		for (const type of USER_SCROLL) scroller.removeEventListener(type, stopAll);
	};
	const restartQuiet = () => {
		clearTimeout(quiet);
		quiet = setTimeout(stopAll, QUIET_MS);
	};
	if (body && typeof ResizeObserver !== 'undefined') {
		resize = new ResizeObserver(() => {
			const next = body.getBoundingClientRect().height;
			if (Math.abs(next - height) < 1) return;
			height = next;
			// 애니메이션 중이면 다음 프레임이 바뀐 자리를 목적지로 삼는다. 도착한 뒤면 바로 맞춘다
			if (!animating) jump();
			restartQuiet();
		});
		resize.observe(body);
	}
	const max = setTimeout(stopAll, MAX_MS);
	restartQuiet();
	for (const type of USER_SCROLL) scroller.addEventListener(type, stopAll, { passive: true });
	return stopAll;
}
