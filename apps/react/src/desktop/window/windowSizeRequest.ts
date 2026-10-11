// 앱 안에서 창을 키워 달라고 할 때 (시스템 설정의 프로젝트 편집: 폼과 미리 보기가 나란히 들어가게).
// 창 틀(useWindowFrame)이 읽고, 지금보다 작을 때만 그 크기로 키운다. 화면보다 크면 화면에 맞춘다
import { createStore } from '@macfolio/desktop-core';
import type { AppName } from '@/apps/manifest';

export const windowSizeRequest = createStore<{ app: AppName | null; width: number; height: number; seq: number }>({
	app: null,
	width: 0,
	height: 0,
	seq: 0,
});

/** 이 앱의 창을 적어도 이 크기로 (이미 더 크면 그대로) */
export const requestWindowSize = (app: AppName, width: number, height: number) =>
	windowSizeRequest.setState((state) => ({ app, width, height, seq: state.seq + 1 }));
