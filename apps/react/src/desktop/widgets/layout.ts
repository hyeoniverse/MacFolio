// 바탕화면 위젯의 자리 계산. React와 DOM에 의존하지 않는 순수 함수만 둔다 (layout.test.ts).
// 자리는 픽셀이 아니라 칸으로 다룬다: 바탕화면 아이콘이 오른쪽 위에 붙는 것과 달리 위젯은 왼쪽 위부터 놓인다 (macOS와 같다).
// 작은 위젯이 한 칸, 중간 위젯이 가로로 두 칸이다. 저장(localStorage)도 칸으로 한다
import type { PlacedWidget, WidgetSize } from './catalog';

/** 작은 위젯의 한 변 */
export const SMALL = 164;
/** 위젯 사이 */
export const GAP = 16;
/** 한 칸 (위젯 + 사이) */
export const UNIT = SMALL + GAP;
/** 바탕화면 가장자리 여백: 위는 메뉴 막대 아래, 아래는 Dock 위 */
export const MARGIN = { top: 44, left: 24, bottom: 96 } as const;

export interface Viewport {
	width: number;
	height: number;
}
export interface Point {
	x: number;
	y: number;
}
export interface Cell {
	col: number;
	row: number;
}

/** 크기가 차지하는 칸 수 */
export const spanOf = (size: WidgetSize) => ({ cols: size === 'medium' ? 2 : 1, rows: 1 });

/** 위젯의 픽셀 크기 */
export function pixelSize(size: WidgetSize) {
	const { cols, rows } = spanOf(size);
	return { width: cols * UNIT - GAP, height: rows * UNIT - GAP };
}

/** 화면에 들어가는 열·줄 수 (적어도 1) */
export function gridOf({ width, height }: Viewport) {
	return {
		cols: Math.max(1, Math.floor((width - MARGIN.left + GAP) / UNIT)),
		rows: Math.max(1, Math.floor((height - MARGIN.top - MARGIN.bottom + GAP) / UNIT)),
	};
}

/** 칸의 왼쪽 위 (화면 기준 픽셀) */
export const cellToPoint = ({ col, row }: Cell): Point => ({ x: MARGIN.left + col * UNIT, y: MARGIN.top + row * UNIT });

/** 픽셀 자리(위젯의 왼쪽 위)에서 가장 가까운 칸. 위젯이 화면 밖으로 나가지 않게 안쪽으로 당긴다 */
export function pointToCell({ x, y }: Point, size: WidgetSize, viewport: Viewport): Cell {
	const { cols, rows } = gridOf(viewport);
	const span = spanOf(size);
	return {
		col: Math.min(Math.max(0, cols - span.cols), Math.max(0, Math.round((x - MARGIN.left) / UNIT))),
		row: Math.min(Math.max(0, rows - span.rows), Math.max(0, Math.round((y - MARGIN.top) / UNIT))),
	};
}

/** 두 위젯이 칸을 나눠 쓰는지 */
export function overlaps(a: Cell & { size: WidgetSize }, b: Cell & { size: WidgetSize }): boolean {
	const sa = spanOf(a.size);
	const sb = spanOf(b.size);
	return a.col < b.col + sb.cols && b.col < a.col + sa.cols && a.row < b.row + sb.rows && b.row < a.row + sa.rows;
}

/** 이 칸에 놓을 수 있는지: 화면 안이고 다른 위젯과 겹치지 않는다 */
export function canPlace(
	cell: Cell,
	size: WidgetSize,
	others: readonly PlacedWidget[],
	viewport: Viewport,
	except?: string
): boolean {
	const { cols, rows } = gridOf(viewport);
	const span = spanOf(size);
	if (cell.col < 0 || cell.row < 0 || cell.col + span.cols > cols || cell.row + span.rows > rows) return false;
	return others.every((other) => other.id === except || !overlaps({ ...cell, size }, other));
}

/** 빈 칸 중 처음 것: 위 줄부터, 왼쪽부터. 자리가 없으면 null */
export function firstFree(size: WidgetSize, others: readonly PlacedWidget[], viewport: Viewport): Cell | null {
	const { cols, rows } = gridOf(viewport);
	for (let row = 0; row < rows; row++)
		for (let col = 0; col < cols; col++) if (canPlace({ col, row }, size, others, viewport)) return { col, row };
	return null;
}

/**
 * 끌어 놓은 자리. 놓은 칸이 비어 있으면 거기, 다른 위젯과 겹치면 놓기 전 자리로 돌아간다 (macOS처럼 밀어내지 않는다)
 */
export function dropAt(widget: PlacedWidget, point: Point, all: readonly PlacedWidget[], viewport: Viewport): Cell {
	const cell = pointToCell(point, widget.size, viewport);
	return canPlace(cell, widget.size, all, viewport, widget.id) ? cell : { col: widget.col, row: widget.row };
}

/** 크기를 바꾼다. 그 자리에서 커질 수 없으면 빈 칸으로 옮기고, 빈 칸도 없으면 그대로 */
export function resize(
	widget: PlacedWidget,
	size: WidgetSize,
	all: readonly PlacedWidget[],
	viewport: Viewport
): PlacedWidget {
	if (canPlace(widget, size, all, viewport, widget.id)) return { ...widget, size };
	const cell = firstFree(
		size,
		all.filter((other) => other.id !== widget.id),
		viewport
	);
	return cell ? { ...widget, ...cell, size } : widget;
}

/**
 * 지금 화면에 그릴 자리. 저장한 자리가 화면 밖이거나(창을 줄였다) 겹치면 빈 칸으로 옮기고, 빈 칸도 없으면 그리지 않는다.
 * 저장한 값은 바꾸지 않는다: 창을 다시 키우면 원래 자리로 돌아간다
 */
export function visibleLayout(widgets: readonly PlacedWidget[], viewport: Viewport): PlacedWidget[] {
	const placed: PlacedWidget[] = [];
	const moved: PlacedWidget[] = [];
	for (const widget of widgets) (canPlace(widget, widget.size, placed, viewport) ? placed : moved).push(widget);
	for (const widget of moved) {
		const cell = firstFree(widget.size, placed, viewport);
		if (cell) placed.push({ ...widget, ...cell });
	}
	return widgets.flatMap((widget) => placed.find((item) => item.id === widget.id) ?? []);
}
