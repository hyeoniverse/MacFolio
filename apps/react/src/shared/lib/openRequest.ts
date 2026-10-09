// 다른 앱의 항목 하나를 열어 달라는 요청 (Finder에서 글을 열면 메모가 그 글을, 프로젝트를 열면 Safari가 그 탭을 연다).
// 받는 앱이 아직 한 번도 열리지 않아 마운트 전이어도 요청이 남아 있다가, 마운트되면 그때 처리한다.
import { useEffect, useRef } from 'react';
import { createStore } from '@macfolio/desktop-core';
import type { LinkedApp } from './appLink';

interface OpenRequest {
	app: LinkedApp;
	id: string;
}

const openRequestStore = createStore<{ request: OpenRequest | null }>({ request: null });

/** 앱에 항목을 열어 달라고 요청한다. 창을 여는 일(openApp)은 부르는 쪽이 한다 */
export const requestOpen = (app: LinkedApp, id: string) => openRequestStore.setState({ request: { app, id } });

/** 이 앱으로 온 요청을 받아 처리한다. 처리한 요청은 지운다 */
export function useOpenRequest(app: LinkedApp, onOpen: (id: string) => void) {
	const handler = useRef(onOpen);
	useEffect(() => {
		handler.current = onOpen;
	});

	useEffect(() => {
		const take = () => {
			const { request } = openRequestStore.getState();
			if (request?.app !== app) return;
			openRequestStore.setState({ request: null });
			handler.current(request.id);
		};
		take();
		return openRequestStore.subscribe(take);
	}, [app]);
}
