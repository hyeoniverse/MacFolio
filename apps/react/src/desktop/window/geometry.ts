// 창 위치·크기 계산. React와 DOM에 의존하지 않는 순수 함수만 둔다.

export interface Rect {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface Viewport {
	width: number;
	height: number;
}

export type ResizeDirection =
	'top' | 'right' | 'bottom' | 'left' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

/** 화면 위쪽 상태 표시줄 높이. 창은 이 아래에만 놓인다. */
export const STATUSBAR_HEIGHT = 25;
export const MIN_SIZE = { width: 360, height: 200 } as const;
/** 최대화할 때 비워 두는 화면 아래 Dock 영역 (Dock.css: bottom 2rem + height 6rem, 여유 8px) */
export const DOCK_RESERVED_HEIGHT = 136;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/**
 * 처음 여는 창의 크기. 앱이 정한 크기(size)가 없으면
 * 기존 CSS(min-width: clamp(360px, 40%, 800px), min-height: 40%)가 만들던 크기와 같다.
 */
export function defaultRect(viewport: Viewport, size?: { width: number; height: number }): Rect {
	const width = size?.width ?? Math.max(400, clamp(viewport.width * 0.4, 360, 800));
	const height = size?.height ?? Math.min(Math.max(300, viewport.height * 0.4), viewport.height - 160);
	return clampRect({ x: 100, y: 100, width, height }, viewport);
}

/** 창이 화면 밖으로 나가지 않도록 크기와 위치를 제한한다. */
export function clampRect(rect: Rect, viewport: Viewport): Rect {
	const maxWidth = viewport.width;
	const maxHeight = viewport.height - STATUSBAR_HEIGHT;
	const width = clamp(rect.width, Math.min(MIN_SIZE.width, maxWidth), maxWidth);
	const height = clamp(rect.height, Math.min(MIN_SIZE.height, maxHeight), maxHeight);
	return {
		x: clamp(rect.x, 0, viewport.width - width),
		y: clamp(rect.y, STATUSBAR_HEIGHT, viewport.height - height),
		width,
		height,
	};
}

/** 드래그: 시작 위치에서 포인터가 움직인 만큼 옮긴다. */
export function moveRect(start: Rect, dx: number, dy: number, viewport: Viewport): Rect {
	return clampRect({ ...start, x: start.x + dx, y: start.y + dy }, viewport);
}

/** 크기 조절: 잡은 변·모서리를 포인터가 움직인 만큼 옮긴다. 반대쪽 변은 고정된다. */
export function resizeRect(start: Rect, direction: ResizeDirection, dx: number, dy: number, viewport: Viewport): Rect {
	let left = start.x;
	let top = start.y;
	let right = start.x + start.width;
	let bottom = start.y + start.height;

	if (direction.includes('left')) left = clamp(left + dx, 0, right - MIN_SIZE.width);
	if (direction.includes('right')) right = clamp(right + dx, left + MIN_SIZE.width, viewport.width);
	if (direction.includes('top')) top = clamp(top + dy, STATUSBAR_HEIGHT, bottom - MIN_SIZE.height);
	if (direction.includes('bottom')) bottom = clamp(bottom + dy, top + MIN_SIZE.height, viewport.height);

	return clampRect({ x: left, y: top, width: right - left, height: bottom - top }, viewport);
}

/** 최대화: 상태 표시줄과 Dock 사이 전체 (macOS처럼 Dock을 가리지 않는다) */
export function maximizedRect(viewport: Viewport): Rect {
	const height = Math.max(MIN_SIZE.height, viewport.height - STATUSBAR_HEIGHT - DOCK_RESERVED_HEIGHT);
	return { x: 0, y: STATUSBAR_HEIGHT, width: viewport.width, height };
}
