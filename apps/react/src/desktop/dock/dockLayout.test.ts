import { describe, expect, it } from 'vitest';
import type { AppName } from '@/apps/manifest';
import {
	DOCK_GAP,
	DOCK_MARGIN,
	DOCK_PADDING,
	DOCK_DIVIDER,
	dockAppCapacity,
	dockIconSize,
	dockLayout,
} from './dockLayout';

const apps = (...names: string[]) => names as AppName[];
const none = () => false;

describe('dockAppCapacity', () => {
	it('앱 칸 + Launchpad·휴지통 + 구분선이 화면 여백 안에 들어간다', () => {
		for (const width of [400, 768, 769, 900, 1280, 1600, 2560]) {
			const capacity = dockAppCapacity(width);
			const icon = dockIconSize(width);
			const items = capacity + 2;
			const dock = 2 * DOCK_PADDING + items * icon + (items - 1) * DOCK_GAP + DOCK_GAP + DOCK_DIVIDER;
			expect(dock).toBeLessThanOrEqual(width - 2 * DOCK_MARGIN);
			// 한 칸 더 넣으면 넘친다 (자리를 남기지 않는다)
			expect(dock + icon + DOCK_GAP).toBeGreaterThan(width - 2 * DOCK_MARGIN);
		}
	});

	it('아주 좁으면 앱 칸은 0', () => {
		expect(dockAppCapacity(100)).toBe(0);
	});
});

describe('dockLayout', () => {
	const dock = apps('finder', 'music', 'safari', 'memo', 'github');
	const launchpad = apps('apidocs');

	it('자리가 넉넉하면 고정 앱은 모두 Dock에, 고정하지 않은 앱은 Launchpad에', () => {
		expect(dockLayout(10, dock, launchpad, none)).toEqual({
			pinned: dock,
			running: [],
			launchpad: apps('apidocs'),
		});
	});

	it('자리가 모자라면 뒤쪽 고정 앱부터 Launchpad로', () => {
		expect(dockLayout(3, dock, launchpad, none)).toEqual({
			pinned: apps('finder', 'music', 'safari'),
			running: [],
			launchpad: apps('memo', 'github', 'apidocs'),
		});
	});

	it('실행 중인 앱이 자리를 차지하면 고정 앱을 하나 더 보낸다 (Launchpad 칸과 겹치지 않는다)', () => {
		const layout = dockLayout(5, dock, launchpad, (name) => name === 'apidocs');
		expect(layout.pinned).toEqual(apps('finder', 'music', 'safari', 'memo'));
		expect(layout.running).toEqual(apps('apidocs'));
		expect(layout.launchpad).toEqual(apps('github', 'apidocs'));
		expect(layout.pinned.length + layout.running.length).toBe(5);
	});

	it('넘친 고정 앱이 실행 중이면 고정 앱 뒤에 나타난다', () => {
		const layout = dockLayout(3, dock, launchpad, (name) => name === 'github');
		expect(layout.pinned).toEqual(apps('finder', 'music'));
		expect(layout.running).toEqual(apps('github'));
	});

	it('실행 중인 앱이 칸보다 많아도 칸 수를 넘지 않는다', () => {
		const layout = dockLayout(2, dock, launchpad, () => true);
		expect(layout.pinned).toEqual([]);
		expect(layout.running).toHaveLength(2);
	});
});
