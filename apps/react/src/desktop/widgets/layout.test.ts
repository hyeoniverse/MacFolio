import { describe, expect, it } from 'vitest';
import {
	DEFAULT_DESKTOP_WIDGETS,
	DEFAULT_MOBILE_WIDGETS,
	newWidgetId,
	pageToAdd,
	parseMobileWidgets,
	parseWidgets,
	widgetRows,
	type PlacedWidget,
} from './catalog';
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

	it('메모 위젯이 보일 글은 아는 값만 남긴다', () => {
		expect(
			parseWidgets([
				{ id: 'a', kind: 'posts', size: 'medium', col: 0, row: 0, posts: 'popular' },
				{ id: 'b', kind: 'posts', size: 'small', col: 0, row: 1, posts: 'best' },
			])
		).toEqual([
			{ id: 'a', kind: 'posts', size: 'medium', col: 0, row: 0, posts: 'popular' },
			{ id: 'b', kind: 'posts', size: 'small', col: 0, row: 1 },
		]);
	});

	it('새 id는 종류 이름, 겹치면 번호를 붙인다', () => {
		expect(newWidgetId('clock', [])).toBe('clock');
		expect(newWidgetId('clock', [{ id: 'clock' }, { id: 'clock-2' }])).toBe('clock-3');
	});

	it('휴대폰 위젯 줄 수: 작은 위젯은 둘이 한 줄, 중간 위젯은 혼자 한 줄', () => {
		expect(widgetRows([])).toBe(0);
		expect(widgetRows([{ size: 'small' }, { size: 'small' }, { size: 'medium' }])).toBe(2);
		expect(widgetRows([{ size: 'small' }, { size: 'medium' }, { size: 'small' }])).toBe(2);
		expect(DEFAULT_MOBILE_WIDGETS.map(widgetRows)).toEqual([2, 2, 2]);
	});

	it('휴대폰에 더할 페이지: 지금 페이지에 자리가 있으면 거기, 없으면 자리가 있는 첫 페이지', () => {
		const medium = { size: 'medium' as const };
		const full = [medium, medium, medium];
		expect(pageToAdd([[medium], full, []], 0, 'medium')).toBe(0);
		expect(pageToAdd([[medium], full, []], 1, 'medium')).toBe(0);
		expect(pageToAdd([full, full, full], 0, 'small')).toBe(-1);
	});

	it('저장한 휴대폰 위젯: 페이지는 세 개로 맞추고, 줄이 넘치거나 틀린 위젯은 뺀다', () => {
		expect(parseMobileWidgets({})).toBeNull();
		const medium = (id: string) => ({ id, kind: 'github', size: 'medium' });
		expect(
			parseMobileWidgets([
				[medium('a'), medium('b'), medium('c'), medium('d')],
				[
					{ id: 'a', kind: 'clock', size: 'small' },
					{ id: 'e', kind: 'clock', size: 'medium' },
				],
			])
		).toEqual([[medium('a'), medium('b'), medium('c')], [], []]);
		// 사진 위젯의 앨범은 글자면 남긴다 (없어진 앨범이면 위젯이 모든 앨범을 보인다)
		expect(parseMobileWidgets([[{ id: 'p', kind: 'photos', size: 'small', album: 'qru' }]])?.[0]).toEqual([
			{ id: 'p', kind: 'photos', size: 'small', album: 'qru' },
		]);
		expect(parseWidgets([{ id: 'p', kind: 'photos', size: 'small', col: 0, row: 0, album: 3 }])).toEqual([
			{ id: 'p', kind: 'photos', size: 'small', col: 0, row: 0 },
		]);
	});
});

describe('바탕화면 아이콘을 피한다', () => {
	const screen = { width: 1440, height: 900 };
	// 첫 칸(0, 0)의 가운데에 걸친 폴더 아이콘 하나
	const { x, y } = cellToPoint({ col: 0, row: 0 });
	const icon = { left: x + 40, top: y + 40, right: x + 136, bottom: y + 140 };
	const at = (col: number, row: number, size: PlacedWidget['size'] = 'small'): PlacedWidget => ({
		id: `w${col}${row}`,
		kind: 'clock',
		size,
		col,
		row,
	});

	it('아이콘이 있는 칸에는 놓지 않고, 다음 빈 칸을 고른다', () => {
		expect(canPlace({ col: 0, row: 0 }, 'small', [], screen, undefined, [icon])).toBe(false);
		expect(firstFree('small', [], screen, [icon])).toEqual({ col: 1, row: 0 });
		// 중간 위젯은 두 칸이라 (0,0)에서 시작하지 못한다
		expect(firstFree('medium', [], screen, [icon])).toEqual({ col: 1, row: 0 });
	});

	it('아이콘 위로 끌어 놓으면 제자리, 아이콘을 가리게 된 위젯은 빈 칸에 그린다 (저장한 자리는 그대로)', () => {
		const widget = at(2, 1);
		expect(dropAt(widget, { x, y }, [widget], screen, [icon])).toEqual({ col: 2, row: 1 });
		const covered = at(0, 0);
		expect(visibleLayout([covered], screen, [icon])).toEqual([{ ...covered, col: 1, row: 0 }]);
		expect(visibleLayout([covered], screen)).toEqual([covered]);
	});

	it('크기를 키울 때 아이콘에 걸리면 빈 칸으로 옮긴다', () => {
		const right = cellToPoint({ col: 1, row: 0 });
		const block = { left: right.x + 10, top: right.y + 10, right: right.x + 100, bottom: right.y + 100 };
		expect(resize(at(0, 0), 'medium', [at(0, 0)], screen, [block])).toMatchObject({ col: 2, row: 0, size: 'medium' });
	});
});
