import { describe, expect, it } from 'vitest';
import {
	arrange,
	cellToPoint,
	cleanUp,
	clickSelect,
	drop,
	intersects,
	parseSaved,
	pointToCell,
	rectFrom,
	rowsFor,
} from './layout';

// 1280×820: 줄 수 = floor((820 - 34 - 96) / 100) = 6
const viewport = { width: 1280, height: 820 };

describe('바탕화면 아이콘 자리', () => {
	it('처음에는 오른쪽 위에서 아래로 한 열을 채우고 왼쪽 열로 넘어간다', () => {
		expect(rowsFor(viewport)).toBe(6);
		const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
		const cells = arrange(ids, {}, viewport);
		expect(cells.a).toEqual({ col: 0, row: 0 });
		expect(cells.f).toEqual({ col: 0, row: 5 });
		expect(cells.g).toEqual({ col: 1, row: 0 });
		expect(cellToPoint(cells.a, viewport)).toEqual({ x: 1280 - 12 - 96, y: 34 });
	});

	it('저장한 칸은 지키고, 겹치거나 화면 밖이면 빈 칸에 둔다', () => {
		const cells = arrange(
			['a', 'b', 'c'],
			{ a: { col: 3, row: 2 }, b: { col: 3, row: 2 }, c: { col: 99, row: 0 } },
			viewport
		);
		expect(cells.a).toEqual({ col: 3, row: 2 });
		expect(cells.b).toEqual({ col: 0, row: 0 });
		expect(cells.c).toEqual({ col: 0, row: 1 });
	});

	it('픽셀 자리는 가장 가까운 칸으로 맞추고 화면 안으로 당긴다', () => {
		const point = cellToPoint({ col: 2, row: 3 }, viewport);
		expect(pointToCell({ x: point.x + 30, y: point.y - 40 }, viewport)).toEqual({ col: 2, row: 3 });
		expect(pointToCell({ x: 5000, y: -300 }, viewport)).toEqual({ col: 0, row: 0 });
		expect(pointToCell({ x: -5000, y: 5000 }, viewport)).toEqual({ col: 12, row: 5 });
	});

	it('끌어 놓은 칸에 다른 아이콘이 있으면 가까운 빈 칸으로 간다', () => {
		const cells = { a: { col: 0, row: 0 }, b: { col: 0, row: 1 } };
		const moved = drop(cells, { a: cellToPoint({ col: 0, row: 1 }, viewport) }, viewport);
		expect(moved.b).toEqual({ col: 0, row: 1 });
		expect(moved.a).not.toEqual({ col: 0, row: 1 });
		expect(Math.abs(moved.a.col) + Math.abs(moved.a.row - 1)).toBe(1);
	});

	it('함께 끈 아이콘끼리는 서로 겹치지 않는다', () => {
		const cells = { a: { col: 0, row: 0 }, b: { col: 0, row: 1 } };
		const target = cellToPoint({ col: 4, row: 4 }, viewport);
		const moved = drop(cells, { a: target, b: target }, viewport);
		expect(moved.a).toEqual({ col: 4, row: 4 });
		expect(moved.b).not.toEqual(moved.a);
	});

	it('정리하기는 주어진 차례대로 다시 채운다', () => {
		expect(cleanUp(['b', 'a'], viewport)).toEqual({ b: { col: 0, row: 0 }, a: { col: 0, row: 1 } });
	});
});

describe('바탕화면 선택', () => {
	it('그냥 누르면 하나만, 이미 고른 것을 누르면 그대로 둔다', () => {
		expect(clickSelect(['a', 'b'], 'c', { toggle: false, extend: false })).toEqual(['c']);
		expect(clickSelect(['a', 'b'], 'a', { toggle: false, extend: false })).toEqual(['a', 'b']);
	});

	it('⌘는 넣고 빼고, ⇧는 더한다', () => {
		expect(clickSelect(['a', 'b'], 'a', { toggle: true, extend: false })).toEqual(['b']);
		expect(clickSelect(['a'], 'b', { toggle: true, extend: false })).toEqual(['a', 'b']);
		expect(clickSelect(['a'], 'b', { toggle: false, extend: true })).toEqual(['a', 'b']);
	});

	it('끈 사각형은 방향과 상관없이 겹친 것을 찾는다', () => {
		const band = rectFrom({ x: 100, y: 100 }, { x: 0, y: 0 });
		expect(intersects(band, { left: 50, top: 50, right: 150, bottom: 150 })).toBe(true);
		expect(intersects(band, { left: 101, top: 0, right: 200, bottom: 50 })).toBe(false);
	});
});

describe('저장한 칸 읽기', () => {
	it('모양이 맞는 항목만 남긴다', () => {
		expect(parseSaved({ a: { col: 1, row: 2 }, b: { col: -1, row: 0 }, c: 'x', d: { col: 1.5, row: 0 } })).toEqual({
			a: { col: 1, row: 2 },
		});
		expect(parseSaved(null)).toEqual({});
		expect(parseSaved([1])).toEqual({});
	});
});
