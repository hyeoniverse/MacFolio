// 편집기 안의 이미지를 크게 보기. 이미지는 ProseMirror 노드 뷰(blocks.ts, React 밖)가 그려서,
// 크게 볼 이미지를 이 저장소에 넣으면 편집기 컴포넌트가 읽기 화면과 같은 Lightbox로 띄운다
import { useSyncExternalStore } from 'react';
import { createStore } from '@macfolio/desktop-core';

const zoomStore = createStore<{ image: { src: string; alt: string } | null }>({ image: null });

export const openImageZoom = (src: string, alt: string) => zoomStore.setState({ image: { src, alt } });
export const closeImageZoom = () => zoomStore.setState({ image: null });
export const useImageZoom = () => useSyncExternalStore(zoomStore.subscribe, () => zoomStore.getState().image);
