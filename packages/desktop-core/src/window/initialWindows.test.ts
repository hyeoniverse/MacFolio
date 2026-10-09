import { describe, expect, it } from 'vitest';
import { initialWindows, restoreWindows } from './initialWindows';

const names = ['finder', 'memo', 'music'] as const;

describe('initialWindows', () => {
	it('runningAtStart인 앱만 켜고, 주소로 들어온 앱은 맨 앞에 연다', () => {
		const apps = initialWindows(names, { linked: 'memo', runningAtStart: (name) => name === 'finder' });
		expect(apps.finder).toMatchObject({ isRunning: true, hasOpened: true });
		expect(apps.music).toMatchObject({ isRunning: false, hasOpened: false });
		expect(apps.memo).toMatchObject({ isRunning: true, hasOpened: true });
		expect(apps.memo.zIndex).toBeGreaterThan(apps.finder.zIndex);
	});
});

describe('restoreWindows', () => {
	const initial = initialWindows(names, { linked: null, runningAtStart: () => false });
	const memo = { isRunning: true, isMinimized: false, zIndex: 5, hasOpened: true };

	it('아는 앱 중 모양이 맞는 것만 덮는다', () => {
		const restored = restoreWindows(initial, { memo, music: { isRunning: 'yes' }, gone: memo });
		expect(restored.memo).toEqual(memo);
		expect(restored.music).toEqual(initial.music);
		expect(restored).not.toHaveProperty('gone');
	});

	it('객체가 아니면 처음 상태 그대로', () => {
		expect(restoreWindows(initial, null)).toEqual(initial);
		expect(restoreWindows(initial, 'x')).toEqual(initial);
	});
});
