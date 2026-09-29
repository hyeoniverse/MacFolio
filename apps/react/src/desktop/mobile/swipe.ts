// 제어 센터를 여닫는 세로 쓸기의 규칙. React에 의존하지 않는다.

export type SwipeDirection = 'down' | 'up';

/** 이만큼 쓸면 제어 센터가 열리거나 닫힌다 */
export const PULL_OPEN_PX = 60;

/** 이만큼 움직이기 전에는 쓸기인지 아직 모른다 (누르기와 구분) */
export const DECIDE_PX = 8;

/**
 * 움직인 거리로 쓸기인지 판단한다.
 * - undecided: 아직 조금밖에 안 움직였다
 * - swipe: 정한 방향으로 세로로 쓸었다
 * - other: 가로로 움직였거나 반대 방향이다 (이번 손가락은 놓아준다)
 */
export function classifyMove(dx: number, dy: number, direction: SwipeDirection): 'undecided' | 'swipe' | 'other' {
	if (Math.hypot(dx, dy) < DECIDE_PX) return 'undecided';
	if (Math.abs(dy) <= Math.abs(dx)) return 'other';
	return (direction === 'down' ? dy > 0 : dy < 0) ? 'swipe' : 'other';
}

/** 스스로 끄는 동작이 있는 요소 (입력, 음량·재생 위치 막대, 끌어 옮기기, 홈 인디케이터) */
const OWN_GESTURE =
	'input, textarea, select, [contenteditable="true"], [role="slider"], [draggable="true"], .home-indicator, [data-swipe-ignore]';

interface ScrollBox {
	scrollTop: number;
	scrollHeight: number;
	clientHeight: number;
	overflowY: string;
}

/** 세로로 스크롤되는 상자인지 */
const scrolls = (box: ScrollBox) =>
	(box.overflowY === 'auto' || box.overflowY === 'scroll') && box.scrollHeight > box.clientHeight + 1;

/**
 * 스크롤 상자들(안쪽부터)이 그 방향 쓸기를 스크롤로 써야 하는지.
 * 아래로 쓸 때: 위로 더 올라갈 내용이 있으면(scrollTop > 0) 스크롤이 먼저다.
 * 위로 쓸 때: 아래로 더 내려갈 내용이 있으면 스크롤이 먼저다.
 */
export function scrollWins(boxes: ScrollBox[], direction: SwipeDirection): boolean {
	return boxes.some((box) =>
		!scrolls(box)
			? false
			: direction === 'down'
				? box.scrollTop > 0
				: box.scrollTop + box.clientHeight < box.scrollHeight - 1
	);
}

/** 이 요소에서 시작한 손가락으로 제어 센터를 여닫아도 되는지 */
export function canStartSwipe(target: EventTarget | null, direction: SwipeDirection): boolean {
	if (!(target instanceof Element) || target.closest(OWN_GESTURE)) return false;
	const boxes: ScrollBox[] = [];
	for (let element: Element | null = target; element; element = element.parentElement) {
		const { overflowY } = getComputedStyle(element);
		boxes.push({
			scrollTop: element.scrollTop,
			scrollHeight: element.scrollHeight,
			clientHeight: element.clientHeight,
			overflowY,
		});
	}
	return !scrollWins(boxes, direction);
}
