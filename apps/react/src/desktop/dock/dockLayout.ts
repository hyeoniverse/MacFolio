import type { AppName } from '@/apps/manifest';

/** Dock 치수 (px). Dock.css가 이 값을 CSS 변수(--dock-icon, --dock-gap, --dock-padding, --dock-divider)로 받아 쓴다. 칸 수 계산과 그리는 크기가 늘 같다 */
export const DOCK_GAP = 16;
/** Dock 안쪽 좌우 여백 */
export const DOCK_PADDING = 16;
/** Dock과 화면 끝 사이 최소 여백 */
export const DOCK_MARGIN = 16;
/** 앱 칸과 휴지통 사이 구분선 두께 */
export const DOCK_DIVIDER = 2;
/** 앱이 아닌 칸: Launchpad, 휴지통 */
const SYSTEM_ITEMS = 2;

/** 아이콘 크기: 좁은 화면(태블릿)에서는 조금 작게 */
export const dockIconSize = (viewportWidth: number) => (viewportWidth <= 768 ? 56 : 64);

/** 이 폭의 화면에서 Dock에 앱 아이콘을 몇 개 놓을 수 있나 (Launchpad·휴지통·구분선 자리는 뺀다) */
export function dockAppCapacity(viewportWidth: number): number {
	const slot = dockIconSize(viewportWidth) + DOCK_GAP;
	const inner = viewportWidth - 2 * DOCK_MARGIN - 2 * DOCK_PADDING;
	// 칸 n개 = n × 아이콘 + (n - 1) × 간격, 구분선은 간격 하나와 자기 두께를 더한다 → n × slot + 구분선
	return Math.max(0, Math.floor((inner - DOCK_DIVIDER) / slot) - SYSTEM_ITEMS);
}

export interface DockLayout {
	/** Dock에 고정해서 보이는 앱 */
	pinned: AppName[];
	/** Dock에 보이지 않지만 실행 중이라 고정 앱 뒤에 나타나는 앱 (macOS처럼) */
	running: AppName[];
	/** Launchpad에 모이는 앱: 자리가 없어 넘친 고정 앱 + 처음부터 Dock에 고정하지 않은 앱 */
	launchpad: AppName[];
}

/**
 * 어떤 앱을 Dock에 두고 어떤 앱을 Launchpad로 보낼지 정한다.
 * 실행 중인 앱도 자리를 차지하므로, 고정 앱 + 실행 중인 앱이 칸 수를 넘지 않을 때까지 고정 앱을 뒤에서부터 Launchpad로 보낸다.
 * 그래서 앱이 많아도 Launchpad·휴지통 칸과 겹치지 않는다
 */
export function dockLayout(
	capacity: number,
	dockApps: readonly AppName[],
	launchpadApps: readonly AppName[],
	isRunning: (name: AppName) => boolean
): DockLayout {
	const runningOf = (shown: number) => [...dockApps.slice(shown), ...launchpadApps].filter(isRunning);
	let shown = Math.min(dockApps.length, capacity);
	while (shown > 0 && shown + runningOf(shown).length > capacity) shown -= 1;
	return {
		pinned: dockApps.slice(0, shown),
		// 고정 앱을 모두 보내도 실행 중인 앱이 칸보다 많으면 들어가는 만큼만 (나머지는 Launchpad에서)
		running: runningOf(shown).slice(0, capacity - shown),
		launchpad: [...dockApps.slice(shown), ...launchpadApps],
	};
}
