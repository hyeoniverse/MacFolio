import { useState } from 'react';
import { moveDirection, type MoveDirection } from './direction';

/**
 * 보이는 번호가 바뀔 때마다 넘긴 방향 (그리는 중에 앞 번호와 비교해 바로 정한다).
 * 바뀐 것을 그 칸의 data-direction에 두면 CSS가 넘긴 쪽에서 들어오게 한다 (motion.css의 slide-from-right·left).
 * 번호와 상관없이 같은 칸이 새로 그려지는 일(보기 바꾸기 등)은 reset에 넣는다: 그것만 바뀌면 방향을 지워 서서히 바뀌게 한다
 */
export function useMoveDirection(index: number, count?: number, reset?: unknown): MoveDirection | null {
	const [state, setState] = useState<{ index: number; reset: unknown; direction: MoveDirection | null }>({
		index,
		reset,
		direction: null,
	});
	if (state.index !== index || state.reset !== reset) {
		const next = { index, reset, direction: state.index !== index ? moveDirection(state.index, index, count) : null };
		setState(next);
		return next.direction;
	}
	return state.direction;
}
