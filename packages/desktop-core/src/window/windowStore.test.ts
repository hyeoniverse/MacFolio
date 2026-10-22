import { describe, expect, it, vi } from 'vitest';
import { initialWindows } from './initialWindows.js';
import { activeApp, createWindowStore, isAppRunning } from './windowStore.js';

const names = ['finder', 'memo', 'music'] as const;
const setup = () =>
	createWindowStore(initialWindows(names, { linked: null, runningAtStart: (name) => name === 'finder' }));

describe('createWindowStore', () => {
	it('앱을 열면 맨 앞에 켜지고 지금 쓰는 앱이 된다', () => {
		const store = setup();
		store.open('memo');
		const { apps } = store.getState();
		expect(apps.memo).toMatchObject({ isRunning: true, hasOpened: true });
		expect(apps.memo.zIndex).toBeGreaterThan(apps.finder.zIndex);
		expect(activeApp(store.getState())).toBe('memo');
	});

	it('창 밖을 누르면 지금 쓰는 앱이 없어지고, 창을 누르면 돌아온다', () => {
		const store = setup();
		store.focusDesktop();
		expect(activeApp(store.getState())).toBeNull();
		store.bringToFront('finder');
		expect(activeApp(store.getState())).toBe('finder');
	});

	it('바탕화면을 누르면 창을 치우고, 다시 누르면 돌아온다', () => {
		const store = setup();
		store.toggleDesktopRevealed();
		expect(store.getState().desktopRevealed).toBe(true);
		expect(activeApp(store.getState())).toBeNull();
		store.toggleDesktopRevealed();
		expect(store.getState().desktopRevealed).toBe(false);
	});

	it('치워 둔 창은 창을 누르거나 앱을 열면 돌아온다', () => {
		const store = setup();
		store.toggleDesktopRevealed();
		store.bringToFront('finder');
		expect(store.getState().desktopRevealed).toBe(false);
		store.toggleDesktopRevealed();
		store.open('memo');
		expect(store.getState().desktopRevealed).toBe(false);
	});

	it('떠 있는 창이 없으면 바탕화면을 눌러도 치울 것이 없다', () => {
		const store = setup();
		store.minimize('finder');
		const listener = vi.fn();
		store.subscribe(listener);
		store.toggleDesktopRevealed();
		expect(store.getState().desktopRevealed).toBe(false);
		expect(listener).not.toHaveBeenCalled();
	});

	it('이미 창 밖에 있으면 구독자에게 다시 알리지 않는다', () => {
		const store = setup();
		store.focusDesktop();
		const listener = vi.fn();
		store.subscribe(listener);
		store.focusDesktop();
		expect(listener).not.toHaveBeenCalled();
	});

	it('close는 창만 닫고, quit은 앱도 내린다', () => {
		const store = setup();
		store.open('memo');
		store.close('memo');
		expect(store.getState().apps.memo).toMatchObject({ isRunning: false, hasOpened: true });
		store.quit('memo');
		expect(store.getState().apps.memo.hasOpened).toBe(false);
	});

	it('최소화한 앱은 맨 앞이 아니고, 되살리면 다시 보인다', () => {
		const store = setup();
		store.open('memo');
		store.minimize('memo');
		expect(activeApp(store.getState())).toBe('finder');
		store.restore('memo');
		expect(activeApp(store.getState())).toBe('memo');
	});

	it('toggleRunning은 켤 때 최소화를 풀고, toggleMinimized는 최소화만 뒤집는다', () => {
		const store = setup();
		store.toggleMinimized('finder');
		expect(store.getState().apps.finder.isMinimized).toBe(true);
		store.toggleRunning('music');
		expect(store.getState().apps.music).toMatchObject({ isRunning: true, isMinimized: false, hasOpened: true });
	});

	it('홈으로 가면 켜진 앱을 모두 최소화한다', () => {
		const store = setup();
		store.open('memo');
		store.goHome();
		const { apps } = store.getState();
		expect(apps.finder.isMinimized && apps.memo.isMinimized).toBe(true);
		expect(apps.music.isMinimized).toBe(false);
		expect(activeApp(store.getState())).toBeNull();
	});

	it('창 없이도 실행 중(keepAlive): 최소화해도 그대로, 창을 닫거나 종료하면 함께 꺼진다', () => {
		const store = setup();
		const running = () => isAppRunning(store.getState(), 'music');
		expect(running()).toBe(false);
		store.keepAlive('music', true);
		expect(running()).toBe(true);
		expect(store.getState().apps.music.isRunning).toBe(false);
		// 창을 열고 최소화해도 실행 중
		store.open('music');
		store.minimize('music');
		expect(running()).toBe(true);
		// 빨간 버튼(close)은 앱을 끈다
		store.close('music');
		expect(running()).toBe(false);
		store.keepAlive('music', true);
		store.quit('music');
		expect(running()).toBe(false);
		// 같은 값이면 상태를 바꾸지 않는다
		const before = store.getState();
		store.keepAlive('music', false);
		expect(store.getState()).toBe(before);
	});
});
