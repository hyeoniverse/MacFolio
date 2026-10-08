import { describe, expect, it } from 'vitest';
import { moveDirection } from './direction';

describe('넘긴 방향', () => {
	it('뒤 번호면 다음, 앞 번호면 이전', () => {
		expect(moveDirection(2, 3, 9)).toBe('next');
		expect(moveDirection(3, 2, 9)).toBe('prev');
		expect(moveDirection(1, 7, 9)).toBe('next');
	});

	it('돌아가며 넘기는 목록: 끝에서 처음은 다음, 처음에서 끝은 이전', () => {
		expect(moveDirection(8, 0, 9)).toBe('next');
		expect(moveDirection(0, 8, 9)).toBe('prev');
	});

	it('돌아가지 않는 목록(방문 기록): 번호 그대로', () => {
		expect(moveDirection(1, 0)).toBe('prev');
		expect(moveDirection(0, 1)).toBe('next');
		// 둘뿐이면 돌아가며 넘겨도 번호 그대로
		expect(moveDirection(1, 0, 2)).toBe('prev');
	});

	it('처음 열 때와 같은 번호는 방향이 없다', () => {
		expect(moveDirection(null, 4, 9)).toBeNull();
		expect(moveDirection(4, 4, 9)).toBeNull();
	});
});
