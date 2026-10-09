import { createStore } from '@macfolio/desktop-core';

/** 다른 곳('이 Mac에 관하여'의 추가 정보…)에서 시스템 설정을 열 때 보일 항목. 앱이 읽고 비운다 */
export const requestedSection = createStore<{ section: string | null }>({ section: null });
