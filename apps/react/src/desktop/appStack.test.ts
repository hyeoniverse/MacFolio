import { describe, expect, it } from 'vitest';
import { bringToFront } from './appStack';

const apps = {
	a: { zIndex: 3, isMinimized: false, isRunning: true },
	b: { zIndex: 1, isMinimized: true, isRunning: true },
	c: { zIndex: 2, isMinimized: false, isRunning: false },
};

describe('bringToFront', () => {
	it('대상 앱이 가장 큰 zIndex를 갖는다', () => {
		const next = bringToFront(apps, 'b');
		expect(next.b.zIndex).toBeGreaterThan(next.a.zIndex);
		expect(next.b.zIndex).toBeGreaterThan(next.c.zIndex);
	});

	it('나머지 앱의 상대적인 순서는 유지된다', () => {
		const next = bringToFront(apps, 'b');
		expect(next.c.zIndex).toBeLessThan(next.a.zIndex);
	});

	it('최소화된 앱은 복원된다', () => {
		expect(bringToFront(apps, 'b').b.isMinimized).toBe(false);
	});

	it('입력 객체를 바꾸지 않는다', () => {
		const snapshot = structuredClone(apps);
		bringToFront(apps, 'b');
		expect(apps).toEqual(snapshot);
	});

	it('다른 필드는 그대로 둔다', () => {
		expect(bringToFront(apps, 'c').c.isRunning).toBe(false);
	});
});
