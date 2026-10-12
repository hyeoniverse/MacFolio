import { describe, expect, it } from 'vitest';
import { BENTO_COLUMNS, bentoLayout, type BentoCell } from './bento';

/**
 * CSS grid의 grid-auto-flow: dense를 흉내 내 칸을 놓는다: 칸마다 위에서부터, 왼쪽부터 처음 들어가는 자리.
 * 돌려주는 것: 줄마다 찬 열 (true = 참)
 */
function pack(cells: BentoCell[]): boolean[][] {
	const rows: boolean[][] = [];
	const free = (r: number, c: number) => !(rows[r]?.[c] ?? false);
	for (const cell of cells) {
		let placed = false;
		for (let r = 0; !placed; r++) {
			for (let c = 0; c + cell.col <= BENTO_COLUMNS && !placed; c++) {
				let fits = true;
				for (let dr = 0; dr < cell.row && fits; dr++)
					for (let dc = 0; dc < cell.col && fits; dc++) fits = free(r + dr, c + dc);
				if (!fits) continue;
				for (let dr = 0; dr < cell.row; dr++) {
					rows[r + dr] ??= Array(BENTO_COLUMNS).fill(false);
					for (let dc = 0; dc < cell.col; dc++) rows[r + dr][c + dc] = true;
				}
				placed = true;
			}
		}
	}
	return rows;
}

describe('bentoLayout', () => {
	it('항목 수만큼 칸을 돌려주고, 0개면 빈 목록', () => {
		expect(bentoLayout(0)).toEqual([]);
		for (let n = 1; n <= 12; n++) expect(bentoLayout(n)).toHaveLength(n);
	});

	it('1~12개 모두 6열 격자에 빈 칸이 없다', () => {
		for (let n = 1; n <= 12; n++) {
			const rows = pack(bentoLayout(n));
			expect(rows.length, `${n}개`).toBeGreaterThan(0);
			for (const row of rows) expect(row.every(Boolean), `${n}개: ${JSON.stringify(rows)}`).toBe(true);
		}
	});

	it('2~8개는 큰 칸을 하나 이상 섞는다 (크기가 다 같지 않다)', () => {
		for (let n = 2; n <= 8; n++) {
			const cells = bentoLayout(n);
			expect(cells.some((cell) => cell.size === 'lg')).toBe(true);
			expect(new Set(cells.map((cell) => `${cell.col}x${cell.row}`)).size).toBeGreaterThan(1);
		}
	});

	it('크기 이름: 4×2 이상은 lg, 3열 이상 한 줄은 wide, 나머지 sm', () => {
		expect(bentoLayout(5).map((cell) => cell.size)).toEqual(['lg', 'sm', 'sm', 'wide', 'wide']);
		expect(bentoLayout(4).at(-1)).toEqual({ col: 6, row: 1, size: 'wide' });
	});

	it('여섯 개 넘으면 다음 덩어리의 큰 칸은 반대쪽 (작은 칸이 먼저)', () => {
		const cells = bentoLayout(6);
		expect(cells[0].size).toBe('lg');
		expect(cells[3].size).toBe('sm');
		expect(cells[4].size).toBe('lg');
	});
});
