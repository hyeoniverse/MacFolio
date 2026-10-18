// QuickTime Player에 열린 동영상·소리 파일. Finder·바탕화면에서 mp4·mp3 등을 열면 여기에 두고, 창이 그린다.
import { useSyncExternalStore } from 'react';
import { createStore } from '@macfolio/desktop-core';

export interface PlayerFile {
	/** R2 키 (/files/<key>) 또는 방문자가 놓은 파일의 blob 주소 */
	key: string;
	name: string;
	media: 'video' | 'audio';
}

const store = createStore<{ file: PlayerFile | null }>({ file: null });

/** 파일을 연다 (macOS QuickTime처럼 창 하나에 하나). 창을 여는 일(openApp)은 부르는 쪽이 한다 */
export const openInPlayer = (file: PlayerFile) => store.setState({ file });
/** 창을 닫으면 비운다 (다음에 열 때 파일 고르기부터) */
export const resetPlayer = () => store.setState({ file: null });
export const usePlayer = () => useSyncExternalStore(store.subscribe, () => store.getState().file);
