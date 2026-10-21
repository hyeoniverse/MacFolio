import { describe, expect, it } from 'vitest';
import { DEFAULT_DESKTOP_WIDGETS, newWidgetId, parseWidgets, type PlacedWidget } from './catalog';
import {
	canPlace,
	cellToPoint,
	dropAt,
	firstFree,
	gridOf,
	MARGIN,
	pixelSize,
	pointToCell,
	resize,
	UNIT,
	visibleLayout,
} from './layout';

const screen = { width: 1440, height: 900 };
const widget = (id: string, col: number, row: number, size: PlacedWidget['size'] = 'small'): PlacedWidget => ({
	id,
	kind: 'calendar',
	size,
	col,
	row,
});

describe('바탕화면 위젯 자리', () => {
	it('작은 위젯은 한 칸, 중간 위젯은 가로 두 칸 (사이 포함)', () => {
		expect(pixelSize('small')).toEqual({ width: 164, height: 164 });
		expect(pixelSize('medium')).toEqual({ width: 344, height: 164 });
		expect(cellToPoint({ col: 1, row: 2 })).toEqual({ x: MARGIN.left + UNIT, y: MARGIN.top + 2 * UNIT });
	});

	it('화면에 들어가는 칸 수', () => {
		expect(gridOf(screen)).toEqual({ cols: 7, rows: 4 });
		expect(gridOf({ width: 100, height: 100 })).toEqual({ cols: 1, rows: 1 });
	});

	it('픽셀 자리를 가까운 칸으로, 중간 위젯은 오른쪽 끝을 넘지 않게', () => {
		expect(pointToCell({ x: MARGIN.left + UNIT * 0.6, y: MARGIN.top - 50 }, 'small', screen)).toEqual({
			col: 1,
			row: 0,
		});
		expect(pointToCell({ x: 5000, y: 5000 }, 'medium', screen)).toEqual({ col: 5, row: 3 });
	});

	it('겹치면 놓을 수 없고, 빈 칸은 위 줄 왼쪽부터 찾는다', () => {
		const all = [widget('a', 0, 0, 'medium'), widget('b', 2, 0)];
		expect(canPlace({ col: 1, row: 0 }, 'small', all, screen)).toBe(false);
		expect(canPlace({ col: 1, row: 0 }, 'small', all, screen, 'a')).toBe(true);
		expect(firstFree('medium', all, screen)).toEqual({ col: 3, row: 0 });
		expect(firstFree('small', all, { width: 400, height: 300 })).toBeNull();
	});

	it('끌어 놓기: 빈 칸이면 거기, 다른 위젯 위면 제자리', () => {
		const a = widget('a', 0, 0);
		const all = [a, widget('b', 1, 0)];
		expect(dropAt(a, cellToPoint({ col: 3, row: 2 }), all, screen)).toEqual({ col: 3, row: 2 });
		expect(dropAt(a, cellToPoint({ col: 1, row: 0 }), all, screen)).toEqual({ col: 0, row: 0 });
	});

	it('크기 바꾸기: 옆이 비면 그 자리, 막히면 빈 칸으로', () => {
		const a = widget('a', 0, 0);
		expect(resize(a, 'medium', [a], screen)).toMatchObject({ col: 0, row: 0, size: 'medium' });
		const all = [a, widget('b', 1, 0)];
		expect(resize(a, 'medium', all, screen)).toMatchObject({ col: 2, row: 0, size: 'medium' });
	});

	it('화면이 작아지면 밖으로 나간 위젯을 빈 칸으로 옮기고, 들어갈 데가 없으면 그리지 않는다', () => {
		const small = { width: 700, height: 600 };
		const all = [widget('a', 0, 0), widget('far', 6, 3), widget('b', 1, 0)];
		expect(visibleLayout(all, small)).toEqual([widget('a', 0, 0), widget('far', 2, 0), widget('b', 1, 0)]);
		expect(visibleLayout(all, { width: 300, height: 300 }).map((item) => item.id)).toEqual(['a']);
	});
});

describe('위젯 목록 저장', () => {
	it('처음 모양은 서로 겹치지 않는다', () => {
		expect(visibleLayout(DEFAULT_DESKTOP_WIDGETS, screen)).toEqual(DEFAULT_DESKTOP_WIDGETS);
	});

	it('저장한 값에서 맞는 것만 꺼낸다 (모르는 종류, 고를 수 없는 크기, 겹친 id, 음수 칸은 뺀다)', () => {
		expect(parseWidgets('x')).toBeNull();
		expect(
			parseWidgets([
				{ id: 'a', kind: 'weather', size: 'medium', col: 0, row: 0 },
				{ id: 'a', kind: 'clock', size: 'small', col: 1, row: 0 },
				{ id: 'b', kind: 'clock', size: 'medium', col: 1, row: 0 },
				{ id: 'c', kind: 'nope', size: 'small', col: 1, row: 0 },
				{ id: 'd', kind: 'clock', size: 'small', col: -1, row: 0 },
				null,
			])
		).toEqual([{ id: 'a', kind: 'weather', size: 'medium', col: 0, row: 0 }]);
	});

	it('새 id는 종류 이름, 겹치면 번호를 붙인다', () => {
		expect(newWidgetId('clock', [])).toBe('clock');
		expect(newWidgetId('clock', [{ id: 'clock' }, { id: 'clock-2' }])).toBe('clock-3');
	});
});
