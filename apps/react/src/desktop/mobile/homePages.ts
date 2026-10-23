import { MAX_WIDGET_ROWS } from '@/desktop/widgets/catalog';
// 휴대폰 홈 화면의 페이지 나누기 (iOS처럼): 한 화면에 다 들어가지 않는 앱은 스크롤하지 않고 다음 페이지로 보낸다.
// 순수 함수만 둔다. 몇 칸이 들어가는지는 화면에서 재서 넘긴다 (MobileHome).

/** 높이 안에 들어가는 아이콘 줄 수 (줄 높이 + 줄 사이). 적어도 한 줄 */
export function rowsThatFit(height: number, rowHeight: number, rowGap: number): number {
	return Math.max(1, iconRowsBelow(height, rowHeight, rowGap));
}

/** 위젯 아래 높이에 들어가는 아이콘 줄 수. 위젯이 페이지를 다 차지하면 0 (그 페이지에는 앱을 두지 않는다) */
export function iconRowsBelow(height: number, rowHeight: number, rowGap: number): number {
	if (rowHeight <= 0) return 1;
	return Math.max(0, Math.floor((height + rowGap) / (rowHeight + rowGap)));
}

/** 위젯이 두 줄 이하인 페이지의 위젯 아래에 늘 남겨 둘 아이콘 줄 수 (위젯이 화면을 다 차지해 앱이 잘리지 않게) */
export const MIN_ICON_ROWS = 2;
/** 위젯 한 줄의 가장 낮은 높이 (이보다 줄이면 내용이 들어가지 않는다) */
export const MIN_WIDGET_ROW = 112;

/**
 * 위젯 한 줄의 높이. 화면 크기로만 정하고, 위젯을 옮기거나 더해도 바뀌지 않는다 (iOS처럼 위젯 크기는 고정).
 * 정사각형(작은 위젯의 폭)이 기본이고, 두 조건에 맞게 줄인다:
 * - 위젯 두 줄 아래에 아이콘 MIN_ICON_ROWS줄이 들어간다 (처음 구성처럼 두 줄인 페이지)
 * - 위젯 MAX_WIDGET_ROWS(세 줄)가 페이지에 들어간다 (그 페이지는 아이콘이 줄거나 없다)
 * 예전에는 위젯 줄 수가 가장 많은 페이지에 맞췄다. 그래서 한 페이지가 세 줄이 되면 모든 페이지의 위젯이 작아졌다.
 * 너무 낮아지면 MIN_WIDGET_ROW에서 멈춘다
 * @param height 페이지 높이
 * @param square 작은 위젯의 폭
 * @param gaps 위젯 사이, 위젯과 아이콘 사이, 아이콘 줄 사이
 */
export function widgetRowHeight(
	height: number,
	square: number,
	iconRow: number,
	gaps: { widget: number; top: number; icon: number }
): number {
	const icons = MIN_ICON_ROWS * iconRow + (MIN_ICON_ROWS - 1) * gaps.icon;
	const twoRows = Math.floor((height - gaps.top - icons - gaps.widget) / 2);
	const fullPage = Math.floor((height - (MAX_WIDGET_ROWS - 1) * gaps.widget) / MAX_WIDGET_ROWS);
	return Math.max(MIN_WIDGET_ROW, Math.min(square, twoRows, fullPage));
}

/**
 * 앱을 페이지로 나눈다: 위젯이 있는 앞 페이지들은 위젯 아래 칸 수(leadingSlots)만큼, 그다음부터는 slotsPerPage칸씩.
 * 위젯이 있는 페이지는 앱이 모자라도 모두 만든다 (빈 칸은 그대로)
 */
export function pageApps<T>(apps: readonly T[], leadingSlots: readonly number[], slotsPerPage: number): T[][] {
	const pages: T[][] = [];
	let start = 0;
	for (const slots of leadingSlots) {
		// 위젯이 페이지를 다 차지하면 앱을 두지 않는다 (0칸)
		const count = Math.max(0, slots);
		pages.push(apps.slice(start, start + count));
		start += count;
	}
	const rest = Math.max(1, slotsPerPage);
	for (; start < apps.length; start += rest) pages.push(apps.slice(start, start + rest));
	return pages.length ? pages : [[]];
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
