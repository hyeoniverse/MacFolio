import type { AppWindow, AppWindows } from './windowStore.js';

/**
 * 처음 창 상태. linked(앱 항목 주소로 들어온 앱)는 맨 앞에 열어 두고, 나머지는 runningAtStart가 참인 앱만 켠다.
 * 모바일은 홈 화면에서 시작하므로 runningAtStart가 늘 거짓이다
 */
export function initialWindows<Name extends string>(
	names: readonly Name[],
	{ linked, runningAtStart }: { linked: Name | null; runningAtStart: (name: Name) => boolean }
): AppWindows<Name> {
	return Object.fromEntries(
		names.map((name): [Name, AppWindow] => {
			if (name === linked) return [name, { isRunning: true, isMinimized: false, zIndex: 2, hasOpened: true }];
			const running = runningAtStart(name);
			return [name, { isRunning: running, isMinimized: false, zIndex: 1, hasOpened: running }];
		})
	) as AppWindows<Name>;
}

const isAppWindow = (value: unknown): value is AppWindow => {
	const state = value as AppWindow | null;
	return (
		typeof state === 'object' &&
		state !== null &&
		typeof state.isRunning === 'boolean' &&
		typeof state.isMinimized === 'boolean' &&
		typeof state.hasOpened === 'boolean' &&
		Number.isFinite(state.zIndex)
	);
};

/**
 * 저장해 둔 창 상태(JSON에서 읽은 값)를 initial 위에 덮는다. 앱 목록이 그사이 바뀌었을 수 있어서
 * initial에 있는 앱 중 모양이 맞는 것만 덮는다
 */
export function restoreWindows<Name extends string>(initial: AppWindows<Name>, saved: unknown): AppWindows<Name> {
	const restored = { ...initial };
	if (typeof saved !== 'object' || saved === null) return restored;
	for (const name of Object.keys(initial) as Name[]) {
		const state = (saved as Record<string, unknown>)[name];
		if (isAppWindow(state)) restored[name] = state;
	}
	return restored;
}
