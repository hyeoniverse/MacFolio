// 창 쌓임 순서 계산. React에 의존하지 않는 순수 함수만 둔다.

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
