/** 넘긴 방향: 다음(오른쪽에서 들어온다)인지 이전(왼쪽에서)인지 */
export type MoveDirection = 'next' | 'prev';

/**
 * 번호가 바뀐 방향. 처음(앞 번호가 없을 때)과 같은 번호는 null.
 * count를 주면 돌아가며 넘기는 목록이다: 끝에서 처음으로는 다음, 처음에서 끝으로는 이전 (사진 넘기기)
 */
export function moveDirection(from: number | null, to: number, count?: number): MoveDirection | null {
	if (from === null || from === to) return null;
	if (count !== undefined && count > 2) {
		if (from === count - 1 && to === 0) return 'next';
		if (from === 0 && to === count - 1) return 'prev';
	}
	return to > from ? 'next' : 'prev';
}
