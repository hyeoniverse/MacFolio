import { describe, expect, it } from 'vitest';
import { widgetRows, type PageWidget, type WidgetSize } from '@/desktop/widgets/catalog';
import { canMoveTo, moveByKey, normalizeOrder, orderForDrop, packWidgets, positionOf } from './widgetOrder';

const small = (id: string): PageWidget => ({ id, kind: 'clock', size: 'small' });
const medium = (id: string): PageWidget => ({ id, kind: 'github', size: 'medium' });
const ids = (widgets: readonly PageWidget[]) => widgets.map((widget) => widget.id);

describe('휴대폰 위젯 순서', () => {
	it('칸 놓기: 중간 위젯은 한 줄을 다 쓰고, 작은 위젯은 앞의 빈 칸부터 채운다', () => {
		expect(packWidgets([small('a'), medium('b'), small('c')])).toEqual([
			{ col: 0, row: 0 },
			{ col: 0, row: 1 },
			{ col: 1, row: 0 },
		]);
		expect(packWidgets([medium('a'), small('b'), small('c'), small('d')])).toEqual([
			{ col: 0, row: 0 },
			{ col: 0, row: 1 },
			{ col: 1, row: 1 },
			{ col: 0, row: 2 },
		]);
	});

	it('놓은 줄 수는 widgetRows와 같다 (어떤 순서든)', () => {
		const sizes: WidgetSize[][] = [
			['small', 'medium', 'small'],
			['small', 'small', 'small', 'medium'],
			['medium', 'small', 'medium', 'small'],
			['small'],
		];
		for (const list of sizes) {
			const widgets = list.map((size) => ({ size }));
			const rows = Math.max(-1, ...packWidgets(widgets).map((cell) => cell.row)) + 1;
			expect(rows).toBe(widgetRows(widgets));
		}
	});

	it('보이는 순서로 늘어놓는다: [작게, 중간, 작게]는 [작게, 작게, 중간]', () => {
		expect(ids(normalizeOrder([small('a'), medium('b'), small('c')]))).toEqual(['a', 'c', 'b']);
		expect(ids(normalizeOrder([medium('a'), small('b')]))).toEqual(['a', 'b']);
	});

	it('끌어 놓을 순서: 끄는 위젯의 가운데에 가장 가까운 자리', () => {
		const page = [small('a'), small('b'), medium('c')];
		// 작은 위젯 a를 오른쪽 칸 위로: a와 b가 자리를 바꾼다
		expect(ids(orderForDrop(page, page[0], { x: 1.5, y: 0.5 }))).toEqual(['b', 'a', 'c']);
		// 중간 위젯 c를 맨 위로: 작은 위젯 둘이 한 줄 아래로 비켜 준다
		expect(ids(orderForDrop(page, page[2], { x: 1, y: 0.4 }))).toEqual(['c', 'a', 'b']);
		// 작은 위젯은 빈 칸을 채우므로 중간 위젯 아래로 혼자 내려가지 않는다 (격자 규칙)
		expect(ids(orderForDrop(page, page[0], { x: 0.5, y: 1.6 }))).toEqual(['a', 'b', 'c']);
	});

	it('경계 근처에서는 지금 순서를 지킨다 (위젯이 오가며 떨리지 않게)', () => {
		const page = [small('a'), small('b')];
		// a의 가운데(0.5)와 b 자리의 가운데(1.5) 사이 정중앙보다 조금 오른쪽: 아직 바꾸지 않는다
		expect(ids(orderForDrop(page, page[0], { x: 1.05, y: 0.5 }))).toEqual(['a', 'b']);
		expect(ids(orderForDrop(page, page[0], { x: 1.3, y: 0.5 }))).toEqual(['b', 'a']);
	});

	it('다른 페이지에서 온 위젯은 가장 가까운 자리에 끼운다', () => {
		const page = [medium('a'), medium('b')];
		expect(ids(orderForDrop(page, medium('x'), { x: 1, y: 1.5 }))).toEqual(['a', 'x', 'b']);
	});

	it('다른 페이지로 옮길 수 있는지: 그 페이지에 줄이 남아야 한다', () => {
		const pages = [[medium('a')], [medium('b'), medium('c'), medium('d')], [small('e')]];
		expect(canMoveTo(pages, 1, pages[0][0])).toBe(false);
		expect(canMoveTo(pages, 2, pages[0][0])).toBe(true);
		expect(canMoveTo(pages, 3, pages[0][0])).toBe(false);
		// 같은 페이지 안에서 옮기는 위젯은 자기 줄을 센다
		expect(canMoveTo(pages, 1, pages[1][0])).toBe(true);
	});

	it('키보드: 보이는 자리가 바뀌는 가장 가까운 순서로 한 칸 옮기고, 끝이면 옆 페이지로 넘긴다', () => {
		const pages = [[small('a'), small('b'), medium('c')], [medium('d')], []];
		// b를 앞으로: a와 자리를 바꾼다
		expect(moveByKey(pages, 'b', -1)).toEqual({
			pages: [[small('b'), small('a'), medium('c')], [medium('d')], []],
			page: 0,
		});
		// c를 앞으로: 작은 위젯 둘 위로 올라간다
		expect(ids(moveByKey(pages, 'c', -1)!.pages[0])).toEqual(['c', 'a', 'b']);
		// c를 뒤로: 페이지 끝이라 2쪽 처음으로
		expect(moveByKey(pages, 'c', 1)).toEqual({
			pages: [[small('a'), small('b')], [medium('c'), medium('d')], []],
			page: 1,
		});
		// a를 앞으로: 1쪽 처음이고 앞 페이지가 없다
		expect(moveByKey(pages, 'a', -1)).toBeNull();
	});

	it('키보드: 옆 페이지에 자리가 없으면 그다음 페이지로', () => {
		const full = [medium('x'), medium('y'), medium('z')];
		const result = moveByKey([[medium('a')], full, []], 'a', 1);
		expect(result?.page).toBe(2);
		expect(ids(result!.pages[2])).toEqual(['a']);
	});

	it('위젯이 보이는 자리 (1부터)', () => {
		expect(positionOf([[small('a')], [small('b'), small('c')]], 'c')).toEqual({ page: 2, index: 2 });
		expect(positionOf([[small('a')]], 'z')).toBeNull();
	});
});
