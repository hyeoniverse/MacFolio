import { describe, expect, it } from 'vitest';
import { bringToFront, foregroundApp, minimizeAll } from './appStack';

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

describe('foregroundApp', () => {
	it('실행 중이고 최소화되지 않은 앱 중 맨 앞의 앱을 고른다', () => {
		expect(foregroundApp(apps)).toBe('a');
	});

	it('최소화된 앱과 실행 중이 아닌 앱은 고르지 않는다', () => {
		expect(foregroundApp({ ...apps, a: { ...apps.a, isMinimized: true } })).toBeNull();
	});
});

describe('minimizeAll', () => {
	it('실행 중인 앱을 모두 최소화한다', () => {
		const next = minimizeAll(apps);
		expect(next.a.isMinimized).toBe(true);
		expect(foregroundApp(next)).toBeNull();
	});

	it('실행 중이 아닌 앱은 그대로 둔다', () => {
		expect(minimizeAll(apps).c).toBe(apps.c);
	});
});
