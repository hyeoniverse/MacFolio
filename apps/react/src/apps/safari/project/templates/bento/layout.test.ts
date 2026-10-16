import { describe, expect, it } from 'vitest';
import { bentoOf, COLUMNS, composeBento, packSizes, packSpans, rowsOf, type TileSize, type TileSpec } from './layout';

const SIZES: TileSize[] = ['stat', 'item', 'wide', 'full'];

/** 줄마다 꽉 찬다 (마지막 줄까지) */
const expectFull = (spans: number[]) => {
	for (const row of rowsOf(spans)) expect(row.reduce((a, b) => a + b, 0)).toBe(COLUMNS);
};

/** 고정된 씨앗으로 섞은 크기 목록 */
function* samples(): Generator<TileSize[]> {
	let seed = 7;
	const next = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31);
	for (let n = 1; n <= 14; n++) for (let k = 0; k < 40; k++) yield Array.from({ length: n }, () => SIZES[next() % 4]);
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

describe('composeBento', () => {
	const tiles = (sizes: TileSize[]): TileSpec[] => sizes.map((size, i) => ({ id: `t${i}`, size }));

	it('머리 타일은 넓은 폭에서 8칸 두 줄이고 다음 두 타일을 오른쪽에 쌓는다', () => {
		const placed = composeBento(tiles(['wide', 'stat', 'stat', 'stat', 'stat', 'wide', 'item']), { lead: true });
		expect(placed.slice(0, 3).map((p) => [p.lg, p.rows])).toEqual([
			[8, 2],
			[4, 1],
			[4, 1],
		]);
		expectFull(placed.slice(3).map((p) => p.lg));
		expect(placed[0].md).toBe(12);
		expect(placed.map((p) => p.order)).toEqual([1, 2, 3, 4, 5, 6, 7]);
	});

	it('숫자 타일은 다른 타일과 한 줄에 섞이지 않는다', () => {
		const placed = composeBento(tiles(['item', 'stat', 'stat', 'item', 'item']));
		expect(rowsOf(placed.map((p) => p.lg))).toEqual([[12], [6, 6], [6, 6]]);
	});

	it('비용이 같으면 그림 타일이 넓다', () => {
		expect(packSpans([6, 4])).toEqual([8, 4]);
	});

	it('머리 타일 옆에 하나뿐이면 한 줄로, 없으면 전체로', () => {
		expect(composeBento(tiles(['wide', 'item']), { lead: true }).map((p) => [p.lg, p.rows])).toEqual([
			[8, 1],
			[4, 1],
		]);
		expect(composeBento(tiles(['wide']), { lead: true }).map((p) => p.lg)).toEqual([12]);
		expect(composeBento(tiles(['wide', 'full', 'item']), { lead: true }).map((p) => p.lg)).toEqual([12, 12, 12]);
	});

	it('머리 타일 없이 어떤 조합이든 줄이 꽉 찬다', () => {
		for (const sizes of samples()) {
			const placed = composeBento(tiles(sizes));
			expectFull(placed.map((p) => p.lg));
			expectFull(placed.map((p) => p.md));
			expectFull(placed.map((p) => p.sm));
		}
	});

	it('머리 타일이 있어도 나머지 줄이 꽉 찬다', () => {
		for (const sizes of samples()) {
			const placed = composeBento(tiles(sizes), { lead: true });
			const sideRows = placed[0].rows === 2 ? 3 : placed[0].lg === 8 ? 2 : 1;
			expectFull(placed.slice(sideRows).map((p) => p.lg));
			expectFull(placed.map((p) => p.md));
		}
	});

	it('타일이 없으면 빈 목록', () => {
		expect(composeBento([])).toEqual([]);
	});
});

describe('bentoOf', () => {
	it('예시의 첫 격자: 그림 있는 머리 기능 옆에 숫자 둘', () => {
		const { lead, placements } = bentoOf({
			features: [{ media: [1] }, { media: [1, 2] }, { media: [] }, { media: [] }, { media: [] }],
			facts: 4,
			screens: true,
			stack: 9,
			role: { contributions: 5 },
		});
		expect(lead).toBe(true);
		// 머리 옆에는 그림 없는 기능 둘, 그 아래 숫자 한 줄, 그림 있는 기능은 8칸
		expect([...placements.values()].map((p) => [p.id, p.lg])).toEqual([
			['feature-0', 8],
			['feature-2', 4],
			['feature-3', 4],
			['stat-0', 3],
			['stat-1', 3],
			['stat-2', 3],
			['stat-3', 3],
			['feature-1', 8],
			['feature-4', 4],
			['tech', 6],
			['role', 6],
			['screens', 12],
		]);
	});

	it('그림 없는 기능 둘만 있으면 머리 타일 없이 절반씩', () => {
		const { lead, placements } = bentoOf({
			features: [{ media: [] }, { media: [] }],
			facts: 0,
			screens: false,
			stack: 0,
			role: null,
		});
		expect(lead).toBe(false);
		expect([...placements.values()].map((p) => p.lg)).toEqual([6, 6]);
	});
});

describe('bentoOf: 그림 없는 예시', () => {
	it('그림이 없어도 기능이 셋 넘으면 머리 타일을 두고 옆에 기능 둘을 쌓는다', () => {
		const { lead, placements } = bentoOf({
			features: Array.from({ length: 5 }, () => ({ media: [] })),
			facts: 4,
			screens: false,
			stack: 9,
			role: { contributions: 5 },
		});
		expect(lead).toBe(true);
		expect([...placements.values()].map((p) => [p.id, p.lg, p.rows])).toEqual([
			['feature-0', 8, 2],
			['feature-1', 4, 1],
			['feature-2', 4, 1],
			['stat-0', 3, 1],
			['stat-1', 3, 1],
			['stat-2', 3, 1],
			['stat-3', 3, 1],
			['feature-3', 6, 1],
			['feature-4', 6, 1],
			['tech', 6, 1],
			['role', 6, 1],
		]);
	});
});
