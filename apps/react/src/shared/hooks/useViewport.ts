import { useSyncExternalStore } from 'react';
import type { Viewport } from '@/desktop/window/geometry';

let cached: Viewport | null = null;

const subscribe = (onChange: () => void) => {
	window.addEventListener('resize', onChange);
	return () => window.removeEventListener('resize', onChange);
};

// 크기가 바뀌었을 때만 새 객체를 돌려준다 (useSyncExternalStore는 같은 값이면 같은 참조를 기대한다)
const getSnapshot = (): Viewport => {
	if (!cached || cached.width !== window.innerWidth || cached.height !== window.innerHeight) {
		cached = { width: window.innerWidth, height: window.innerHeight };
	}
	return cached;
};

/** 브라우저 창 크기. 크기가 바뀌면 다시 렌더링한다. */
export function useViewport(): Viewport {
	return useSyncExternalStore(subscribe, getSnapshot);
}
