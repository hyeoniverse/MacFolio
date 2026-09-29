// 화면 크기에 따라 데스크톱(macOS)과 모바일(iOS) 중 어느 셸을 쓸지 정한다. 순수 함수만 둔다.
import type { Viewport } from '@/desktop/window/geometry';

/** 이보다 좁으면 창을 여러 개 띄우기 어려워 모바일 셸을 쓴다 */
export const MOBILE_MAX_WIDTH = 767;
/** 가로로 눕힌 휴대폰처럼 넓어도 낮은 화면은 모바일로 본다 */
const LANDSCAPE_PHONE = { maxWidth: 1023, maxHeight: 499 };

export function isMobileViewport({ width, height }: Viewport): boolean {
	if (width <= MOBILE_MAX_WIDTH) return true;
	return width <= LANDSCAPE_PHONE.maxWidth && height <= LANDSCAPE_PHONE.maxHeight;
}
