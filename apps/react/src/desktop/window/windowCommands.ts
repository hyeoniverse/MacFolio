// 창 밖(메뉴 막대의 메뉴, 이후 단축키)에서 창에 시키는 일. 닫기·최소화·확대는 창이 하던 애니메이션을 그대로 쓰도록
// 창이 직접 한다: 바깥은 명령만 보내고, 창이 자기 앱으로 온 명령을 받아 처리한다 (#96).
import { useEffect, useRef } from 'react';
import type { AppName } from '@/apps/manifest';
import { createStore } from '@/shared/lib/createStore';

export type WindowCommand = 'close' | 'minimize' | 'toggleMaximize' | 'quit';

const commandStore = createStore<{ request: { app: AppName; command: WindowCommand } | null }>({ request: null });

/** 그 앱의 창에 명령을 보낸다. 창이 없으면(닫혀 있으면) 아무 일도 없다 */
export const sendWindowCommand = (app: AppName, command: WindowCommand) =>
	commandStore.setState({ request: { app, command } });

/** 이 창으로 온 명령을 받아 처리한다. 처리한 명령은 지운다 */
export function useWindowCommands(app: AppName, handlers: Record<WindowCommand, () => void>) {
	const latest = useRef(handlers);
	useEffect(() => {
		latest.current = handlers;
	});

	useEffect(() => {
		const take = () => {
			const { request } = commandStore.getState();
			if (request?.app !== app) return;
			commandStore.setState({ request: null });
			latest.current[request.command]();
		};
		take();
		return commandStore.subscribe(take);
	}, [app]);
}
