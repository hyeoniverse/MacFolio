/**
 * iframe 안 페이지의 방문 기록 위치 (WebFrame의 뒤로·앞으로 버튼).
 *
 * 다른 출처의 iframe은 history를 읽을 수 없다. 대신 iframe 안의 이동도 바깥 문서의 기록(history.length)에 쌓이고
 * 이 사이트는 기록을 replaceState로만 바꾸므로, 늘어난 수를 그 iframe이 쌓은 기록으로 본다.
 * 뒤로·앞으로는 바깥 문서의 history.back()/forward()로 옮긴다 (마지막에 쌓인 기록이 iframe의 것이면 iframe이 움직인다).
 */
export interface FrameHistory {
	/** 이 iframe을 띄운 시각의 history.length (다른 곳에서 쌓인 기록만큼 뒤로 민다) */
	base: number;
	/** 처음 페이지 뒤로 쌓인 기록 수 */
	length: number;
	/** 지금 보는 기록의 위치 (0 = 처음 페이지) */
	index: number;
}

export const startFrameHistory = (total: number): FrameHistory => ({ base: total, length: 0, index: 0 });

/**
 * history.length를 다시 읽은 결과. own이 참이면(이 iframe에 초점이 있거나 방금 불러졌으면) 늘어난 기록을 이 iframe의 것으로,
 * 아니면 다른 iframe의 것으로 보고 base를 민다. 앞쪽 기록이 있는 위치에서 새로 이동하면 앞쪽은 지워지므로 length는 새 위치가 된다
 */
export function observeFrameHistory(state: FrameHistory, total: number, own: boolean): FrameHistory {
	const added = total - state.base - state.length;
	if (added === 0) return state;
	if (!own) return { ...state, base: state.base + added };
	const length = Math.max(0, total - state.base);
	return { ...state, length, index: length };
}

/** 이 iframe이 페이지를 새로 불러왔다 (기록 수가 그대로여도: 앞쪽 기록이 하나 남은 위치에서 이동하면 수가 같다) */
export function navigatedFrameHistory(state: FrameHistory, total: number): FrameHistory {
	const length = Math.max(0, total - state.base);
	if (length !== state.length) return { ...state, length, index: length };
	return state.index < state.length ? { ...state, index: state.index + 1, length: state.index + 1 } : state;
}

export const stepFrameHistory = (state: FrameHistory, step: -1 | 1): FrameHistory => ({
	...state,
	index: Math.min(state.length, Math.max(0, state.index + step)),
});

export const canGoBack = (state: FrameHistory) => state.index > 0;
export const canGoForward = (state: FrameHistory) => state.index < state.length;
