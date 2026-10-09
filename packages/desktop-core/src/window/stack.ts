// 창 쌓임 순서 계산. 입력을 바꾸지 않는 순수 함수만 둔다.

export interface StackedApp {
	zIndex: number;
	isMinimized: boolean;
}

/**
 * 앱을 맨 앞으로 가져오고, 최소화되어 있었다면 복원한다.
 * 나머지 앱은 기존 순서를 유지한 채 0부터 다시 번호를 매긴다. 입력은 바꾸지 않는다.
 */
export function bringToFront<Name extends string, App extends StackedApp>(
	apps: Record<Name, App>,
	target: NoInfer<Name>
): Record<Name, App> {
	const others = (Object.keys(apps) as Name[])
		.filter((name) => name !== target)
		.sort((a, b) => apps[a].zIndex - apps[b].zIndex);

	const next = {} as Record<Name, App>;
	others.forEach((name, index) => {
		next[name] = { ...apps[name], zIndex: index };
	});
	next[target] = { ...apps[target], zIndex: others.length, isMinimized: false };
	return next;
}

export interface RunningApp extends StackedApp {
	isRunning: boolean;
}

/** 화면 맨 앞에 보이는 앱. 실행 중이고 최소화되지 않은 앱 중 zIndex가 가장 크다. 없으면 null. */
export function foregroundApp<Name extends string>(apps: Record<Name, RunningApp>): Name | null {
	let top: Name | null = null;
	for (const name of Object.keys(apps) as Name[]) {
		const app = apps[name];
		if (!app.isRunning || app.isMinimized) continue;
		if (top === null || app.zIndex > apps[top].zIndex) top = name;
	}
	return top;
}

/** 실행 중인 앱을 모두 최소화한다 (모바일의 홈으로 가기). 입력은 바꾸지 않는다. */
export function minimizeAll<Name extends string, App extends RunningApp>(apps: Record<Name, App>): Record<Name, App> {
	const next = { ...apps };
	for (const name of Object.keys(apps) as Name[]) {
		if (apps[name].isRunning) next[name] = { ...apps[name], isMinimized: true };
	}
	return next;
}

/** 실행 중인 앱을 최근에 쓴 순서(zIndex가 큰 순)로. 모바일 앱 전환기의 카드 순서 */
export function runningByRecency<Name extends string>(apps: Record<Name, RunningApp>): Name[] {
	return (Object.keys(apps) as Name[])
		.filter((name) => apps[name].isRunning)
		.sort((a, b) => apps[b].zIndex - apps[a].zIndex);
}
