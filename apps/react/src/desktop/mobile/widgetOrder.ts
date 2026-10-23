// 휴대폰 홈 화면 위젯의 순서 바꾸기 (iOS 홈 화면처럼 끌어 옮긴다). React와 DOM에 의존하지 않는 순수 함수만 둔다.
// 위젯은 2열 격자에 페이지 안의 순서대로 놓인다: 중간 위젯은 한 줄을 다 쓰고, 작은 위젯은 앞에서부터 빈 칸을 채운다
// (CSS grid-auto-flow: row dense와 같다). 바탕화면 위젯(desktop/widgets/layout.ts)은 칸 좌표를 저장하는 자유 배치라 규칙이 다르다
import { fitsOnPage, type PageWidget, type WidgetSize } from '@/desktop/widgets/catalog';

/** 위젯 격자의 열 수 */
export const WIDGET_COLUMNS = 2;

export interface WidgetCell {
	col: number;
	row: number;
}

/** 칸 단위 좌표 (작은 위젯 한 칸이 가로·세로 1). 위젯 묶음의 왼쪽 위가 0 */
export interface CellPoint {
	x: number;
	y: number;
}

const spanOf = (size: WidgetSize) => (size === 'medium' ? WIDGET_COLUMNS : 1);

/** 순서대로 놓은 칸: 위 줄부터 빈 칸을 찾는다 (중간 위젯은 빈 줄에만 들어간다) */
export function packWidgets(widgets: readonly { size: WidgetSize }[]): WidgetCell[] {
	const filled: boolean[][] = [];
	return widgets.map(({ size }) => {
		const span = spanOf(size);
		for (let row = 0; ; row++) {
			const line = (filled[row] ??= Array.from({ length: WIDGET_COLUMNS }, () => false));
			for (let col = 0; col + span <= WIDGET_COLUMNS; col++) {
				if (line.slice(col, col + span).some(Boolean)) continue;
				for (let index = col; index < col + span; index++) line[index] = true;
				return { col, row };
			}
		}
	});
}

/**
 * 화면에 보이는 순서(위 줄부터, 왼쪽부터)로 다시 늘어놓는다. 놓인 자리는 그대로다:
 * [작게, 중간, 작게]는 두 번째 작은 위젯이 첫 줄의 빈 칸에 들어가므로 [작게, 작게, 중간]과 같다
 */
export function normalizeOrder<T extends { size: WidgetSize }>(widgets: readonly T[]): T[] {
	const cells = packWidgets(widgets);
	return widgets
		.map((widget, index) => ({ widget, cell: cells[index] }))
		.sort((a, b) => a.cell.row - b.cell.row || a.cell.col - b.cell.col)
		.map(({ widget }) => widget);
}

const sameOrder = (a: readonly { id: string }[], b: readonly { id: string }[]) =>
	a.length === b.length && a.every((widget, index) => widget.id === b[index].id);

/** 위젯이 놓인 자리의 가운데 (칸 단위) */
function centerOf(widgets: readonly PageWidget[], id: string): CellPoint {
	const index = widgets.findIndex((widget) => widget.id === id);
	const cell = packWidgets(widgets)[index];
	return { x: cell.col + spanOf(widgets[index].size) / 2, y: cell.row + 0.5 };
}

/** 끄는 위젯을 page의 index번째에 넣은 순서들 (보이는 순서가 같은 것은 하나만) */
function candidates(others: readonly PageWidget[], widget: PageWidget): PageWidget[][] {
	const orders: PageWidget[][] = [];
	for (let index = 0; index <= others.length; index++) {
		const order = normalizeOrder([...others.slice(0, index), widget, ...others.slice(index)]);
		if (!orders.some((seen) => sameOrder(seen, order))) orders.push(order);
	}
	return orders;
}

/**
 * 끄는 위젯을 놓을 순서: 그 순서로 놓았을 때 위젯의 가운데가 끄는 위젯의 가운데(center)와 가장 가까운 것.
 * 지금 순서보다 확실히 가까울 때만 바꿔(hysteresis) 경계에서 다른 위젯이 오가며 떨리지 않게 한다
 * @param page 지금 보이는 순서 (끄는 위젯이 이 페이지에 있으면 포함, 다른 페이지에서 왔으면 빠져 있다)
 * @param widget 끄는 위젯
 * @param center 끄는 위젯의 가운데 (칸 단위)
 */
export function orderForDrop(page: readonly PageWidget[], widget: PageWidget, center: CellPoint): PageWidget[] {
	const others = page.filter((item) => item.id !== widget.id);
	const distance = (order: readonly PageWidget[]) => {
		const at = centerOf(order, widget.id);
		return Math.hypot(at.x - center.x, at.y - center.y);
	};
	const current = page.some((item) => item.id === widget.id) ? normalizeOrder(page) : null;
	let best = current ?? normalizeOrder([...others, widget]);
	let bestDistance = distance(best) - (current ? HYSTERESIS : 0);
	for (const order of candidates(others, widget)) {
		const d = distance(order);
		if (d < bestDistance) {
			best = order;
			bestDistance = d;
		}
	}
	return best;
}

/** 지금 순서를 지키는 여유 (칸 단위) */
export const HYSTERESIS = 0.15;

/** 위젯을 다른 페이지로 옮길 수 있는지 (그 페이지에 줄이 남는지) */
export const canMoveTo = (pages: readonly (readonly PageWidget[])[], target: number, widget: PageWidget) =>
	target >= 0 &&
	target < pages.length &&
	fitsOnPage(
		pages[target].filter((item) => item.id !== widget.id),
		widget.size
	);

/** 위젯을 모든 페이지에서 빼고 target 페이지를 order로 바꾼다 */
export function placeOnPage(pages: readonly PageWidget[][], id: string, target: number, order: PageWidget[]) {
	return pages.map((page, index) => (index === target ? order : page.filter((widget) => widget.id !== id)));
}

/**
 * 키보드로 한 칸 옮긴다 (편집 중 ← ↑는 앞으로, → ↓는 뒤로). 보이는 자리가 바뀌는 가장 가까운 순서를 고르고,
 * 페이지 끝이면 자리가 있는 옆 페이지의 처음(뒤로)이나 끝(앞으로)으로 넘긴다. 더 갈 곳이 없으면 null
 */
export function moveByKey(
	pages: readonly PageWidget[][],
	id: string,
	step: -1 | 1
): { pages: PageWidget[][]; page: number } | null {
	const from = pages.findIndex((page) => page.some((widget) => widget.id === id));
	if (from < 0) return null;
	const current = normalizeOrder(pages[from]);
	const index = current.findIndex((widget) => widget.id === id);
	const widget = current[index];
	const others = current.filter((item) => item.id !== id);
	for (let to = index + step; to >= 0 && to <= others.length; to += step) {
		const order = normalizeOrder([...others.slice(0, to), widget, ...others.slice(to)]);
		if (!sameOrder(order, current)) return { pages: placeOnPage(pages, id, from, order), page: from };
	}
	for (let target = from + step; target >= 0 && target < pages.length; target += step) {
		if (!canMoveTo(pages, target, widget)) continue;
		const list = pages[target];
		const order = normalizeOrder(step > 0 ? [widget, ...list] : [...list, widget]);
		return { pages: placeOnPage(pages, id, target, order), page: target };
	}
	return null;
}

/** 위젯이 보이는 자리 (몇 쪽 몇 번째, 1부터) */
export function positionOf(pages: readonly PageWidget[][], id: string): { page: number; index: number } | null {
	for (const [page, list] of pages.entries()) {
		const index = list.findIndex((widget) => widget.id === id);
		if (index >= 0) return { page: page + 1, index: index + 1 };
	}
	return null;
}
