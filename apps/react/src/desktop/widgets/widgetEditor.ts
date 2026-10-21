// 위젯 편집 중인지 (macOS의 '위젯 편집…'). 바탕화면 메뉴(DesktopIcons)가 켜고, 위젯 층(DesktopWidgets)이 갤러리를 띄운다
import { useSyncExternalStore } from 'react';
import { createStore } from '@macfolio/desktop-core';

const store = createStore<{ editing: boolean }>({ editing: false });

export const openWidgetEditor = () => store.setState({ editing: true });
export const closeWidgetEditor = () => store.setState({ editing: false });
export const useWidgetEditing = () => useSyncExternalStore(store.subscribe, () => store.getState().editing);
