// 브라우저의 환경 질문(matchMedia)을 한 곳에서: 움직임 줄이기, 어두운 화면 모드, 손가락 입력.
// 화면 크기는 shared/hooks/useViewport.ts, 모바일 셸 여부는 desktop/layout.ts의 isMobileViewport가 맡는다.
// matchMedia가 없는 환경(시험, 아주 옛 브라우저)에서는 모두 false
import { useSyncExternalStore } from 'react';

export const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
export const DARK_SCHEME = '(prefers-color-scheme: dark)';
export const COARSE_POINTER = '(pointer: coarse)';

const queryOf = (query: string): MediaQueryList | null =>
	typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query) : null;

/** 지금 맞는지 한 번 묻는다 */
export const mediaMatches = (query: string): boolean => queryOf(query)?.matches ?? false;

/** 맞는지가 바뀔 때마다 부른다. 돌려준 함수로 그만둔다 */
export function onMediaChange(query: string, onChange: () => void): () => void {
	const list = queryOf(query);
	if (!list) return () => {};
	list.addEventListener('change', onChange);
	return () => list.removeEventListener('change', onChange);
}

/** 맞는지를 상태로. 바뀌면 다시 렌더링한다 */
export function useMediaQuery(query: string): boolean {
	return useSyncExternalStore(
		(onChange) => onMediaChange(query, onChange),
		() => mediaMatches(query),
		() => false
	);
}

/** 움직임 줄이기(시스템 접근성 설정). 켜져 있으면 연출을 건너뛴다 */
export const prefersReducedMotion = () => mediaMatches(REDUCED_MOTION);
/** 시스템이 어두운 화면 모드인지 (설정의 '시스템' 테마가 따르는 값) */
export const prefersDarkScheme = () => mediaMatches(DARK_SCHEME);
/** 주된 입력이 손가락(터치)인지 */
export const hasCoarsePointer = () => mediaMatches(COARSE_POINTER);
