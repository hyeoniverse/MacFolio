// 벤토 격자의 칸 계산 (BentoGrid): 6열 격자에 크기를 섞어 놓되 항목이 몇 개든 빈 칸이 없게

/** 칸 하나: 열 수(1~6), 행 수(1~2), 크기 이름 (lg 큰 칸, wide 넓고 낮은 칸, sm 작은 칸) */
export interface BentoCell {
	col: number;
	row: number;
	size: 'lg' | 'wide' | 'sm';
}

export const BENTO_COLUMNS = 6;

const cell = (col: number, row: number): BentoCell => ({
	col,
	row,
	size: row === 2 && col >= 4 ? 'lg' : col >= 3 ? 'wide' : 'sm',
});

/**
 * 항목 n개의 칸 크기 (격자는 grid-auto-flow: dense).
 * 셋씩 묶어 큰 칸 하나(4×2)와 작은 칸 둘(2×1)로 한 덩어리를 짓고, 덩어리마다 큰 칸이 왼쪽·오른쪽을 번갈아 선다.
 * 남는 하나는 한 줄을 다 쓰고(6×1), 남는 둘은 반씩(3×1). 하나뿐이면 6×2, 둘이면 4×2와 2×2
 */
export function bentoLayout(n: number): BentoCell[] {
	if (n <= 0) return [];
	if (n === 1) return [cell(6, 2)];
	if (n === 2) return [cell(4, 2), cell(2, 2)];
	const cells: BentoCell[] = [];
	const blocks = Math.floor(n / 3);
	for (let b = 0; b < blocks; b++) {
		// 오른쪽에 큰 칸: 작은 칸(왼쪽 위) → 큰 칸 → 작은 칸(dense가 왼쪽 아래로 채운다)
		if (b % 2 === 0) cells.push(cell(4, 2), cell(2, 1), cell(2, 1));
		else cells.push(cell(2, 1), cell(4, 2), cell(2, 1));
	}
	const rest = n % 3;
	if (rest === 1) cells.push(cell(6, 1));
	if (rest === 2) cells.push(cell(3, 1), cell(3, 1));
	return cells;
}
