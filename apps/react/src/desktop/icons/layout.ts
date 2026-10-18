// 바탕화면 아이콘의 자리 계산. React와 DOM에 의존하지 않는 순수 함수만 둔다 (layout.test.ts).
// 자리는 픽셀이 아니라 칸(오른쪽에서 몇째 열, 위에서 몇째 줄)으로 다룬다: macOS처럼 오른쪽 위에 붙어 있으므로,
// 창 크기가 바뀌어도 오른쪽 끝을 기준으로 같은 칸에 남는다. 저장(localStorage)도 칸으로 한다.

/** 한 칸의 크기: 아이콘(64px) + 이름 두 줄 */
export const CELL = { width: 96, height: 100 } as const;
/** 바탕화면 가장자리 여백: 위는 메뉴 막대 아래, 아래는 Dock 위 */
export const MARGIN = { top: 34, right: 12, bottom: 96 } as const;

/** 칸: col은 오른쪽 끝에서 0부터, row는 위에서 0부터 */
export interface Cell {
	col: number;
	row: number;
}
export interface Point {
	x: number;
	y: number;
}
export interface Rect {
	left: number;
	top: number;
	right: number;
	bottom: number;
}
export interface Viewport {
	width: number;
	height: number;
}

/** 한 열에 들어가는 줄 수 (적어도 1) */
export function rowsFor({ height }: Viewport): number {
	return Math.max(1, Math.floor((height - MARGIN.top - MARGIN.bottom) / CELL.height));
}

/** 화면에 들어가는 열 수 (적어도 1) */
export function colsFor({ width }: Viewport): number {
	return Math.max(1, Math.floor((width - MARGIN.right) / CELL.width));
}

/** 칸의 왼쪽 위 (화면 기준 픽셀) */
export function cellToPoint({ col, row }: Cell, viewport: Viewport): Point {
	return { x: viewport.width - MARGIN.right - (col + 1) * CELL.width, y: MARGIN.top + row * CELL.height };
}

/** 픽셀 자리에서 가장 가까운 칸. 화면 밖이면 안쪽 칸으로 당긴다 */
export function pointToCell({ x, y }: Point, viewport: Viewport): Cell {
	const col = Math.round((viewport.width - MARGIN.right - CELL.width - x) / CELL.width);
	const row = Math.round((y - MARGIN.top) / CELL.height);
	return {
		col: Math.min(colsFor(viewport) - 1, Math.max(0, col)),
		row: Math.min(rowsFor(viewport) - 1, Math.max(0, row)),
	};
}

const keyOf = ({ col, row }: Cell) => `${col}:${row}`;

/** 차례대로 채울 때 n번째 칸: 위에서 아래로 한 열을 채우고 왼쪽 열로 넘어간다 */
export function nthCell(index: number, rows: number): Cell {
	return { col: Math.floor(index / rows), row: index % rows };
}

/** 쓰이지 않은 칸 가운데 want에서 가장 가까운 칸 (거리가 같으면 채우는 차례가 앞선 칸) */
export function nearestFree(want: Cell, taken: ReadonlySet<string>, rows: number, cols: number): Cell {
	let best: Cell | null = null;
	let bestDistance = Infinity;
	// 화면이 꽉 차면 화면 밖 열에도 둔다 (아이콘을 잃지 않게)
	const limit = Math.max(cols, Math.ceil((taken.size + 1) / rows) + 1);
	for (let col = 0; col < limit; col++) {
		for (let row = 0; row < rows; row++) {
			if (taken.has(keyOf({ col, row }))) continue;
			const distance = (col - want.col) ** 2 + (row - want.row) ** 2;
			if (distance < bestDistance) {
				best = { col, row };
				bestDistance = distance;
			}
		}
	}
	return best ?? { col: limit, row: 0 };
}

/** 모든 아이콘의 칸. 저장한 칸이 화면 안이고 겹치지 않으면 그대로, 아니면 차례대로 빈 칸에 둔다 */
export function arrange(
	ids: readonly string[],
	saved: Readonly<Record<string, Cell>>,
	viewport: Viewport
): Record<string, Cell> {
	const rows = rowsFor(viewport);
	const cols = colsFor(viewport);
	const taken = new Set<string>();
	const result: Record<string, Cell> = {};
	for (const id of ids) {
		const cell = saved[id];
		if (cell && cell.col < cols && cell.row < rows && !taken.has(keyOf(cell))) {
			result[id] = cell;
			taken.add(keyOf(cell));
		}
	}
	let next = 0;
	for (const id of ids) {
		if (result[id]) continue;
		while (taken.has(keyOf(nthCell(next, rows)))) next++;
		result[id] = nthCell(next, rows);
		taken.add(keyOf(result[id]));
	}
	return result;
}

/** 정리하기: 주어진 차례대로 처음 칸부터 다시 채운다 */
export function cleanUp(ids: readonly string[], viewport: Viewport): Record<string, Cell> {
	const rows = rowsFor(viewport);
	return Object.fromEntries(ids.map((id, index) => [id, nthCell(index, rows)]));
}

/** 끌어 놓기: moved 아이콘을 놓인 픽셀 자리에서 가까운 칸에 맞춘다. 다른 아이콘이 있는 칸이면 가까운 빈 칸으로 */
export function drop(
	cells: Readonly<Record<string, Cell>>,
	moved: Readonly<Record<string, Point>>,
	viewport: Viewport
): Record<string, Cell> {
	const rows = rowsFor(viewport);
	const cols = colsFor(viewport);
	const result: Record<string, Cell> = { ...cells };
	const taken = new Set(
		Object.entries(cells)
			.filter(([id]) => !(id in moved))
			.map(([, cell]) => keyOf(cell))
	);
	for (const [id, point] of Object.entries(moved)) {
		const want = pointToCell(point, viewport);
		const cell = taken.has(keyOf(want)) ? nearestFree(want, taken, rows, cols) : want;
		result[id] = cell;
		taken.add(keyOf(cell));
	}
	return result;
}

/** 두 사각형이 겹치는가 (테두리만 닿아도 겹친 것으로 본다) */
export function intersects(a: Rect, b: Rect): boolean {
	return a.left <= b.right && b.left <= a.right && a.top <= b.bottom && b.top <= a.bottom;
}

/** 두 점으로 만든 사각형 (끄는 방향과 상관없이) */
export function rectFrom(a: Point, b: Point): Rect {
	return {
		left: Math.min(a.x, b.x),
		top: Math.min(a.y, b.y),
		right: Math.max(a.x, b.x),
		bottom: Math.max(a.y, b.y),
	};
}

/**
 * 아이콘을 눌렀을 때의 선택. ⌘는 하나를 넣고 빼고, ⇧는 더한다. 아무 키 없이 이미 고른 것을 누르면
 * 선택을 그대로 둔다 (여럿을 함께 끌 수 있게: macOS와 같다)
 */
export function clickSelect(
	selected: readonly string[],
	id: string,
	{ toggle, extend }: { toggle: boolean; extend: boolean }
): string[] {
	if (toggle) return selected.includes(id) ? selected.filter((one) => one !== id) : [...selected, id];
	if (extend || selected.includes(id)) return selected.includes(id) ? [...selected] : [...selected, id];
	return [id];
}

/** 저장해 둔 값이 칸 목록인지 확인한다 (다른 모양이면 그 항목만 버린다) */
export function parseSaved(raw: unknown): Record<string, Cell> {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
	const result: Record<string, Cell> = {};
	for (const [id, cell] of Object.entries(raw as Record<string, unknown>)) {
		if (!cell || typeof cell !== 'object') continue;
		const { col, row } = cell as Record<string, unknown>;
		if (typeof col === 'number' && typeof row === 'number' && Number.isInteger(col) && Number.isInteger(row))
			if (col >= 0 && row >= 0) result[id] = { col, row };
	}
	return result;
}
