import { describe, expect, it } from 'vitest';
import { boardOf, COLUMNS, composeBoard, packSizes, packSpans, rowsOf, type TileSize, type TileSpec } from './layout';

const SIZES: TileSize[] = ['small', 'stat', 'item', 'wide', 'full'];

/** 줄마다 꽉 찬다 (마지막 줄까지) */
const expectFull = (spans: number[]) => {
	for (const row of rowsOf(spans)) expect(row.reduce((a, b) => a + b, 0)).toBe(COLUMNS);
};

/** 고정된 씨앗으로 섞은 크기 목록 */
function* samples(): Generator<TileSize[]> {
	let seed = 7;
	const next = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31);
	for (let n = 1; n <= 14; n++)
		for (let k = 0; k < 40; k++) yield Array.from({ length: n }, () => SIZES[next() % SIZES.length]);
}

describe('packSpans', () => {
	it('바라는 너비가 줄을 꼭 채우면 그대로 둔다', () => {
		expect(packSpans([3, 3, 3, 3])).toEqual([3, 3, 3, 3]);
		expect(packSpans([4, 4, 4])).toEqual([4, 4, 4]);
		expect(packSpans([6, 6, 12])).toEqual([6, 6, 12]);
	});

	it('모자라는 줄은 넓혀서 채운다', () => {
		expect(packSpans([4, 4])).toEqual([6, 6]);
		expect(packSpans([3, 3, 3])).toEqual([4, 4, 4]);
		expect(packSpans([4])).toEqual([12]);
	});

	it('하나만 남는 줄보다 고르게 나눈다', () => {
		expect(rowsOf(packSpans([4, 4, 4, 4]))).toEqual([
			[6, 6],
			[6, 6],
		]);
		expect(rowsOf(packSpans([4, 4, 4, 4, 4]))).toHaveLength(2);
	});

	it('한 줄 전체 타일은 다른 타일과 나누지 않는다', () => {
		expect(packSpans([4, 12, 4])).toEqual([12, 12, 12]);
	});
});

describe('packSizes', () => {
	it('어떤 개수·크기든 세 폭 모두 비는 칸이 없다', () => {
		for (const sizes of samples()) {
			const packed = packSizes(sizes);
			for (const spans of [packed.lg, packed.md, packed.sm]) {
				expect(spans).toHaveLength(sizes.length);
				expectFull(spans);
			}
		}
	});

	it('좁은 폭에서는 숫자만 둘씩, 나머지는 한 줄씩', () => {
		expect(packSizes(['stat', 'stat', 'item', 'wide']).sm).toEqual([6, 6, 12, 12]);
	});
});

describe('composeBoard', () => {
	const tiles = (sizes: TileSize[]): TileSpec[] => sizes.map((size, i) => ({ id: `t${i}`, size }));

	it('옆 타일이 둘이면 머리 타일은 넓은 폭에서 8칸 두 줄이고 그 둘을 오른쪽에 쌓는다', () => {
		const placed = composeBoard(tiles(['full', 'item', 'item', 'wide', 'wide', 'small']), 2);
		expect(placed.slice(0, 3).map((p) => [p.lg, p.rows])).toEqual([
			[8, 2],
			[4, 1],
			[4, 1],
		]);
		expectFull(placed.slice(3).map((p) => p.lg));
		expect(placed[0].md).toBe(12);
	});

	it('옆 타일이 하나면 머리 타일과 한 줄, 없으면 전체', () => {
		expect(composeBoard(tiles(['full', 'item', 'wide']), 1).map((p) => [p.lg, p.rows])).toEqual([
			[8, 1],
			[4, 1],
			[12, 1],
		]);
		expect(composeBoard(tiles(['full', 'wide', 'wide']), 0).map((p) => p.lg)).toEqual([12, 6, 6]);
	});

	it('어떤 조합이든 머리 타일 아래의 줄이 꽉 찬다', () => {
		for (const sizes of samples())
			for (const side of [0, 1, 2] as const) {
				const placed = composeBoard(tiles(['full', ...sizes]), side);
				const skip = side && placed.length > side ? side + 1 : 0;
				expectFull(placed.slice(skip).map((p) => p.lg));
				expectFull(placed.map((p) => p.md));
				expectFull(placed.map((p) => p.sm));
			}
	});

	it('타일이 없으면 빈 목록', () => {
		expect(composeBoard([])).toEqual([]);
	});
});

describe('boardOf', () => {
	const ALL = [
		'stats',
		'features',
		'screens',
		'steps',
		'built',
		'troubleshooting',
		'stories',
		'controls',
		'tech',
		'team',
		'role',
		'timeline',
		'deployments',
		'credits',
	];

	it('예시 전체: 머리 옆에 대표 화면과 숫자, 그 아래 둘·셋·넷씩 꽉 찬 줄, 맨 아래 마무리', () => {
		const board = boardOf({ shot: true, sections: ALL });
		const lg = [...board.values()].map((p) => p.lg);
		expect(lg.slice(0, 3)).toEqual([8, 4, 4]);
		expect(board.get('hero')?.rows).toBe(2);
		expect(rowsOf(lg.slice(3))).toEqual([[6, 6], [4, 4, 4], [3, 3, 3, 3], [3, 3, 3, 3], [12]]);
	});

	it('대표 화면이 없으면 숫자만 머리 옆에 한 줄로', () => {
		const board = boardOf({ shot: false, sections: ALL });
		expect([board.get('hero')?.lg, board.get('hero')?.rows, board.get('stats')?.lg]).toEqual([8, 1, 4]);
	});

	it('이름과 기능뿐이면 머리, 기능, 마무리가 한 줄씩', () => {
		const board = boardOf({ shot: false, sections: ['features'] });
		expect([...board.values()].map((p) => [p.id, p.lg])).toEqual([
			['hero', 12],
			['features', 12],
			['closing', 12],
		]);
	});
});
