import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { scrollToSettled } from './scrollToSettled';

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

function setup({ distance = 500, viewport = 1000 } = {}) {
	// 시험은 DOM 없이(node) 돈다. 쓰는 속성만 갖춘 대역을 HTMLElement로 넘긴다
	const scroller = Object.assign(new EventTarget(), { clientHeight: viewport, getBoundingClientRect: () => rect(0) });
	let height = 1000;
	const body = { getBoundingClientRect: () => rect(0, height) };
	const target = { getBoundingClientRect: () => rect(distance), scrollIntoView: vi.fn() };
	return {
		scroller: scroller as unknown as HTMLElement,
		body: body as unknown as HTMLElement,
		target: target as unknown as HTMLElement & { scrollIntoView: ReturnType<typeof vi.fn> },
		grow: (by: number) => (height += by),
	};
}

beforeEach(() => {
	vi.useFakeTimers();
	observers = [];
	vi.stubGlobal('ResizeObserver', FakeResizeObserver);
});
afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe('scrollToSettled', () => {
	it('가까운 제목은 부드럽게, 화면 세 개보다 먼 제목은 바로 넘긴다 (지나가는 그림을 모두 받지 않게)', () => {
		const near = setup({ distance: 2000 });
		scrollToSettled(near.target, near.body, near.scroller, true);
		expect(near.target.scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'smooth' });

		const far = setup({ distance: 30000 });
		scrollToSettled(far.target, far.body, far.scroller, true);
		expect(far.target.scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'auto' });
	});

	it('늦게 받은 그림이 본문을 늘리면 같은 제목으로 다시 넘긴다', () => {
		const { scroller, body, target, grow } = setup();
		scrollToSettled(target, body, scroller, false);
		grow(300);
		observers[0].callback();
		expect(target.scrollIntoView).toHaveBeenCalledTimes(2);
		expect(target.scrollIntoView).toHaveBeenLastCalledWith({ block: 'start', behavior: 'auto' });
		// 높이가 그대로면 다시 넘기지 않는다
		observers[0].callback();
		expect(target.scrollIntoView).toHaveBeenCalledTimes(2);
	});

	it('높이가 한동안 그대로면 붙잡기를 그만둔다', () => {
		const { scroller, body, target } = setup();
		scrollToSettled(target, body, scroller, false);
		vi.advanceTimersByTime(1300);
		expect(observers[0].disconnected).toBe(true);
	});

	it('사용자가 휠로 스크롤하면 바로 그만둔다', () => {
		const { scroller, body, target, grow } = setup();
		scrollToSettled(target, body, scroller, false);
		scroller.dispatchEvent(new Event('wheel'));
		expect(observers[0].disconnected).toBe(true);
		grow(300);
		expect(target.scrollIntoView).toHaveBeenCalledTimes(1);
	});
});
