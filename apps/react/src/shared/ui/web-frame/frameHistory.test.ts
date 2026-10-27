import { describe, expect, it } from 'vitest';
import {
	canGoBack,
	canGoForward,
	navigatedFrameHistory,
	observeFrameHistory,
	startFrameHistory,
	stepFrameHistory,
} from '@/shared/ui/web-frame/frameHistory';

describe('frameHistory', () => {
	it('처음 페이지에서는 뒤로도 앞으로도 갈 수 없다', () => {
		const state = startFrameHistory(3);
		expect(canGoBack(state)).toBe(false);
		expect(canGoForward(state)).toBe(false);
	});

	it('이 iframe에서 늘어난 기록만큼 뒤로 갈 수 있다', () => {
		const state = observeFrameHistory(startFrameHistory(3), 5, true);
		expect(state).toEqual({ base: 3, length: 2, index: 2 });
		expect(canGoBack(state)).toBe(true);
		expect(canGoForward(state)).toBe(false);
	});

	it('다른 곳에서 늘어난 기록은 이 iframe의 것으로 보지 않는다', () => {
		const state = observeFrameHistory(startFrameHistory(3), 4, false);
		expect(state).toEqual({ base: 4, length: 0, index: 0 });
		expect(canGoBack(state)).toBe(false);
	});

	it('뒤로 간 뒤에는 앞으로 갈 수 있고, 끝을 넘지 않는다', () => {
		let state = observeFrameHistory(startFrameHistory(1), 3, true);
		state = stepFrameHistory(state, -1);
		expect(state.index).toBe(1);
		expect(canGoForward(state)).toBe(true);
		state = stepFrameHistory(stepFrameHistory(state, 1), 1);
		expect(state.index).toBe(2);
	});

	it('뒤로 간 위치에서 새로 이동하면 앞쪽 기록이 지워진다', () => {
		// 기록 3개 중 처음으로 돌아가 링크를 누르면 기록은 1개가 된다
		let state = observeFrameHistory(startFrameHistory(0), 3, true);
		state = stepFrameHistory(stepFrameHistory(stepFrameHistory(state, -1), -1), -1);
		state = observeFrameHistory(state, 1, true);
		expect(state).toEqual({ base: 0, length: 1, index: 1 });
		expect(canGoForward(state)).toBe(false);
	});

	it('앞쪽 기록이 하나 남은 위치에서 새로 불러오면 수는 같아도 끝으로 간다', () => {
		let state = observeFrameHistory(startFrameHistory(0), 2, true);
		state = stepFrameHistory(state, -1);
		state = navigatedFrameHistory(state, 2);
		expect(state).toEqual({ base: 0, length: 2, index: 2 });
	});

	it('처음 불러온 load는 이동이 아니다', () => {
		const state = startFrameHistory(2);
		expect(navigatedFrameHistory(state, 2)).toBe(state);
	});
});
