// 떠 있는 창(메뉴·팝오버)의 자리. 화면 가장자리에서 EDGE만큼 띄우고, 넘치면 안쪽으로 당긴다.

/** 화면 가장자리와 띄울 간격 */
export const EDGE = 8;

export interface Size {
	width: number;
	height: number;
}

export interface Point {
	left: number;
	top: number;
}

/** 기준이 되는 단추 등의 자리 (getBoundingClientRect) */
export interface AnchorRect {
	left: number;
	top: number;
	right: number;
	bottom: number;
	width: number;
}

const viewport = (): Size => ({ width: window.innerWidth, height: window.innerHeight });

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

/** 한 점(우클릭한 자리 등)에 왼쪽 위를 맞춘다. 오른쪽·아래로 넘치면 안쪽으로 */
export function placeAtPoint(point: Point, size: Size, view: Size = viewport()): Point {
	return {
		left: clamp(point.left, EDGE, view.width - size.width - EDGE),
		top: clamp(point.top, EDGE, view.height - size.height - EDGE),
	};
}

/**
 * 기준 아래에 둔다. align: start는 왼쪽 끝을 맞추고, center는 가운데를 맞춘다.
 * 가로로는 화면 안쪽으로 당기고, 아래로 넘치는데 위에 자리가 있으면 기준 위에 둔다.
 */
export function placeBelow(
	anchor: AnchorRect,
	size: Size,
	{ align = 'start', gap = 6 }: { align?: 'start' | 'center'; gap?: number } = {},
	view: Size = viewport()
): Point {
	const left = align === 'center' ? anchor.left + anchor.width / 2 - size.width / 2 : anchor.left;
	// 아래에 자리가 없고 위에는 있으면 위로 연다 (휴대폰 아래 도구 막대의 단추처럼)
	const below = anchor.bottom + gap;
	const above = anchor.top - gap - size.height;
	const top = below + size.height > view.height - EDGE && above >= EDGE ? above : below;
	return { left: clamp(left, EDGE, view.width - size.width - EDGE), top };
}

/** 기준 오른쪽에 위를 맞춰 둔다 (표 손잡이 메뉴). 오른쪽으로 넘치면 안쪽으로 */
export function placeRight(anchor: AnchorRect, size: Size, { gap = 6 } = {}, view: Size = viewport()): Point {
	return { left: Math.min(anchor.right + gap, view.width - size.width - EDGE), top: anchor.top };
}
