import { useSyncExternalStore } from 'react';
import { createStore } from '@macfolio/desktop-core';

/** '이 Mac에 관하여' 창이 열려 있는지 (Apple 메뉴에서 연다) */
export const aboutStore = createStore<{ open: boolean }>({ open: false });

export const openAbout = () => aboutStore.setState({ open: true });
export const closeAbout = () => aboutStore.setState({ open: false });
export const useAboutOpen = () => useSyncExternalStore(aboutStore.subscribe, () => aboutStore.getState().open);
