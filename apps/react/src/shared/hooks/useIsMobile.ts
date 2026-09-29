import { isMobileViewport } from '@/desktop/layout';
import { useViewport } from '@/shared/hooks/useViewport';

/** 모바일 셸(iOS 홈 화면)을 써야 하는 화면인지. 화면 크기가 바뀌면 다시 계산한다. */
export function useIsMobile(): boolean {
	return isMobileViewport(useViewport());
}
