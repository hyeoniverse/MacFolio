// 바탕화면 아이콘이 차지한 자리 (화면 기준 픽셀). DesktopIcons가 자리를 정할 때마다 알리고, 위젯이 이 자리를 피해 놓인다
import { createStore } from '@macfolio/desktop-core';
import type { Rect } from './layout';

export const desktopIconRects = createStore<{ rects: Rect[] }>({ rects: [] });
