// 다른 곳에서 Finder에 저장소 문서 하나를 열어 달라는 요청 (Apple 메뉴의 '개인정보 처리 방침' → docs/privacy.md).
// Finder는 처음 열 때 불러오는 앱이라, 요청을 여기에 남겨 두면 Finder가 마운트되며 가져간다.
import { createStore } from '@macfolio/desktop-core';

export const finderDocRequest = createStore<{ path: string | null }>({ path: null });

/** Finder에 문서를 열어 달라고 요청한다. 창을 여는 일(openApp)은 부르는 쪽이 한다 */
export const requestFinderDoc = (path: string) => finderDocRequest.setState({ path });

// 바탕화면 폴더 아이콘을 열면 Finder에 그 폴더를 보여 달라는 요청 (desktop/icons). 문서 요청과 같은 방식이다
export const finderFolderRequest = createStore<{ id: string | null }>({ id: null });

/** Finder에 폴더를 열어 달라고 요청한다 (폴더 id: docs:이력서, pictures…). 창을 여는 일은 부르는 쪽이 한다 */
export const requestFinderFolder = (id: string) => finderFolderRequest.setState({ id });
