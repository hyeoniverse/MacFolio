import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { easeOutCubic, scrollToSettled, smoothDuration } from './scrollToSettled';

/** ResizeObserver 대역: 시험에서 본문 높이가 바뀐 것처럼 콜백을 부른다 */
let observers: { callback: () => void; disconnected: boolean }[] = [];
class FakeResizeObserver {
	entry: { callback: () => void; disconnected: boolean };
	constructor(callback: () => void) {
		this.entry = { callback, disconnected: false };
		observers.push(this.entry);
	}
	observe() {}
	disconnect() {
		this.entry.disconnected = true;
	}
}

const rect = (top: number, height = 0) => ({ top, height }) as DOMRect;
const PADDING = 50;

/**
 * 시험은 DOM 없이(node) 돈다. 쓰는 속성만 갖춘 대역을 HTMLElement로 넘긴다.
 * 제목은 본문 맨 위에서 at px 아래에 있고, grow로 그 위의 그림이 받아진 것처럼 본문과 제목 자리를 늘린다
 */
function setup({ at = 600, viewport = 1000 } = {}) {
	let position = at;
	let height = at + 2000;
	const scroller = Object.assign(new EventTarget(), {
		clientHeight: viewport,
		scrollTop: 0,
		getBoundingClientRect: () => rect(0),
		scrollTo: vi.fn(({ top }: { top: number }) => {
			scroller.scrollTop = top;
		}),
	});
	const body = { getBoundingClientRect: () => rect(-scroller.scrollTop, height) };
	const target = { getBoundingClientRect: () => rect(position - scroller.scrollTop), scrollIntoView: vi.fn() };
	return {
		scroller: scroller as unknown as HTMLElement & { scrollTo: ReturnType<typeof vi.fn> },
		body: body as unknown as HTMLElement,
		target: target as unknown as HTMLElement,
		/** 제목을 맨 위에 둔 scrollTop */
		destination: () => position - PADDING,
		grow: (by: number) => {
			position += by;
			height += by;
		},
	};
}

beforeEach(() => {
	vi.useFakeTimers();
	observers = [];
	vi.stubGlobal('ResizeObserver', FakeResizeObserver);
	vi.stubGlobal('getComputedStyle', () => ({ scrollPaddingTop: `${PADDING}px` }));
	vi.stubGlobal('performance', { now: () => Date.now() });
	vi.stubGlobal('requestAnimationFrame', (callback: (now: number) => void) =>
		setTimeout(() => callback(Date.now()), 16)
	);
	vi.stubGlobal('cancelAnimationFrame', (id: ReturnType<typeof setTimeout>) => clearTimeout(id));
});
afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe('scrollToSettled', () => {
	it('부드럽게 넘기면 여러 프레임에 걸쳐 제목에 도착한다', () => {
		const { scroller, body, target, destination } = setup({ at: 1500 });
		scrollToSettled(target, body, scroller, true);
		vi.advanceTimersByTime(100);
		expect(scroller.scrollTop).toBeGreaterThan(0);
		expect(scroller.scrollTop).toBeLessThan(destination());
		vi.advanceTimersByTime(800);
		expect(scroller.scrollTop).toBe(destination());
	});

	it('스크롤하는 동안 그림이 받아져 제목이 밀려도 애니메이션을 이어서 바뀐 자리에 도착한다', () => {
		const { scroller, body, target, destination, grow } = setup({ at: 1500 });
		scrollToSettled(target, body, scroller, true);
		vi.advanceTimersByTime(100);
		grow(400);
		observers[0].callback();
		const middle = scroller.scrollTop;
		vi.advanceTimersByTime(16);
		// 바로 건너뛰지 않고 계속 움직인다
		expect(scroller.scrollTop).toBeGreaterThan(middle);
		expect(scroller.scrollTop).toBeLessThan(destination());
		vi.advanceTimersByTime(800);
		expect(scroller.scrollTop).toBe(destination());
	});

	it('화면 세 개보다 먼 제목은 한 화면 앞까지 바로 옮긴 뒤 부드럽게 넘긴다 (지나가는 그림을 모두 받지 않게)', () => {
		const { scroller, body, target, destination } = setup({ at: 30000 });
		scrollToSettled(target, body, scroller, true);
		expect(scroller.scrollTo).toHaveBeenNthCalledWith(1, { top: destination() - 1000, behavior: 'instant' });
		vi.advanceTimersByTime(800);
		expect(scroller.scrollTop).toBe(destination());
	});

	it('움직임 줄이기 설정이면 바로 넘긴다', () => {
		const { scroller, body, target, destination } = setup({ at: 30000 });
		scrollToSettled(target, body, scroller, false);
		expect(scroller.scrollTop).toBe(destination());
	});

	it('도착한 뒤 그림이 받아져 본문이 늘면 같은 제목으로 다시 맞춘다', () => {
		const { scroller, body, target, destination, grow } = setup();
		scrollToSettled(target, body, scroller, false);
		grow(300);
		observers[0].callback();
		expect(scroller.scrollTop).toBe(destination());
	});

	it('높이가 한동안 그대로면 붙잡기를 그만둔다', () => {
		const { scroller, body, target } = setup();
		scrollToSettled(target, body, scroller, false);
		vi.advanceTimersByTime(1300);
		expect(observers[0].disconnected).toBe(true);
	});

	it('사용자가 휠로 스크롤하면 애니메이션과 붙잡기를 바로 그만둔다', () => {
		const { scroller, body, target } = setup({ at: 1500 });
		scrollToSettled(target, body, scroller, true);
		vi.advanceTimersByTime(50);
		scroller.dispatchEvent(new Event('wheel'));
		const stopped = scroller.scrollTop;
		vi.advanceTimersByTime(800);
		expect(scroller.scrollTop).toBe(stopped);
		expect(observers[0].disconnected).toBe(true);
	});
});

describe('smoothDuration, easeOutCubic', () => {
	it('멀수록 길지만 상한이 있다', () => {
		expect(smoothDuration(500, 1000)).toBe(350);
		expect(smoothDuration(-1000, 1000)).toBe(420);
		expect(smoothDuration(10000, 1000)).toBe(700);
	});
	it('처음과 끝은 0과 1이고 처음에 빠르다', () => {
		expect(easeOutCubic(0)).toBe(0);
		expect(easeOutCubic(1)).toBe(1);
		expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
	});
});
