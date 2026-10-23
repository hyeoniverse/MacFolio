import { afterEach, describe, expect, it, vi } from 'vitest';
import { keyboardInset, keyboardViewport } from './useKeyboardInset';

/** iPhone 13 (레이아웃 뷰포트 844px)에서 보이는 곳의 높이와 offsetTop */
const stubViewport = (height: number, offsetTop: number) =>
	vi.stubGlobal('window', { innerHeight: 844, visualViewport: { height, offsetTop } });

describe('화면 키보드', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('visualViewport가 없으면 키보드가 없는 것으로 본다', () => {
		vi.stubGlobal('window', { innerHeight: 844 });
		expect(keyboardInset()).toBe(0);
		expect(keyboardViewport()).toBeNull();
	});

	it('주소창이 접히고 펴지는 정도(120px 미만)는 키보드로 보지 않는다', () => {
		stubViewport(760, 0);
		expect(keyboardViewport()).toBeNull();
	});

	it('키보드가 올라오면 보이는 곳의 위치와 높이를 돌려준다', () => {
		stubViewport(508, 0);
		expect(keyboardViewport()).toEqual({ top: 0, height: 508 });
		expect(keyboardInset()).toBe(336);
	});

	it('iOS가 보이는 곳을 아래로 옮겨도(offsetTop) 키보드로 판정하고, 옮겨 간 거리를 top으로 돌려준다', () => {
		stubViewport(508, 336);
		// keyboardInset()은 옮겨 간 거리를 빼므로 0이 된다 (머리를 고정할 때는 쓸 수 없다)
		expect(keyboardInset()).toBe(0);
		expect(keyboardViewport()).toEqual({ top: 336, height: 508 });
	});
});
