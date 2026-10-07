// 휴대폰 홈 화면의 페이지 나누기 (iOS처럼): 한 화면에 다 들어가지 않는 앱은 스크롤하지 않고 다음 페이지로 보낸다.
// 순수 함수만 둔다. 몇 칸이 들어가는지는 화면에서 재서 넘긴다 (MobileHome).

/** 높이 안에 들어가는 아이콘 줄 수 (줄 높이 + 줄 사이). 적어도 한 줄 */
export function rowsThatFit(height: number, rowHeight: number, rowGap: number): number {
	if (rowHeight <= 0) return 1;
	return Math.max(1, Math.floor((height + rowGap) / (rowHeight + rowGap)));
}

/** 앱을 페이지로 나눈다: 첫 페이지(위젯 아래)는 firstSlots칸, 그다음부터는 slotsPerPage칸씩 */
export function pageApps<T>(apps: readonly T[], firstSlots: number, slotsPerPage: number): T[][] {
	const first = Math.max(1, firstSlots);
	const rest = Math.max(1, slotsPerPage);
	const pages: T[][] = [apps.slice(0, first)];
	for (let start = first; start < apps.length; start += rest) pages.push(apps.slice(start, start + rest));
	return pages;
}

/** 폭의 이만큼 넘게 끌고 놓으면 다음 페이지로 */
export const SWIPE_FRACTION = 0.2;
/** 이만큼 빠르게 튕기면(px/ms) 짧게 끌어도 넘긴다 */
export const FLICK_SPEED = 0.4;
/** 튕기기로 치는 가장 짧은 거리 (누르다 살짝 미끄러진 것과 구분) */
export const FLICK_MIN_PX = 16;

/**
 * 옆으로 끌다 놓았을 때 갈 페이지. 왼쪽으로 끌면(dx < 0) 다음, 오른쪽이면 이전 페이지.
 * 폭의 SWIPE_FRACTION을 넘겼거나 빠르게 튕겼으면 한 페이지 넘기고, 아니면 제자리로 돌아온다
 */
export function pageAfterSwipe(current: number, count: number, dx: number, width: number, ms: number): number {
	const far = Math.abs(dx) > width * SWIPE_FRACTION;
	const flick = Math.abs(dx) >= FLICK_MIN_PX && Math.abs(dx) / Math.max(1, ms) > FLICK_SPEED;
	if (!far && !flick) return current;
	return Math.min(count - 1, Math.max(0, current + (dx < 0 ? 1 : -1)));
}

/** 끄는 동안 페이지가 움직일 거리. 첫·마지막 페이지 바깥으로는 고무줄처럼 1/3만 따라온다 */
export function dragOffset(current: number, count: number, dx: number): number {
	const pastEdge = (current === 0 && dx > 0) || (current === count - 1 && dx < 0);
	return pastEdge ? dx / 3 : dx;
}
