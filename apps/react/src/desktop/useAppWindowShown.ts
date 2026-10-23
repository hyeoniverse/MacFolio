import { foregroundApp } from '@macfolio/desktop-core';
import type { AppName } from '@/apps/manifest';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { useAppState } from './useAppState';

/**
 * 앱 창이 화면에 있는지: 열려 있고 최소화하지 않았다. 앱 컴포넌트는 창을 닫거나 최소화해도 내려가지 않으므로
 * 주기적으로 조회하는 앱(활동 상태 보기, 메모, 메시지, 메일 등)은 이 값으로 조회를 멈춘다
 */
export function useAppWindowShown(appName: AppName): boolean {
	const { isRunning, isMinimized } = useAppState().apps[appName];
	return isRunning && !isMinimized;
}

/**
 * 위젯이 놓인 화면이 보이는지. 바탕화면(넓은 화면)은 늘 보인다고 본다 (창이 위젯을 덮었는지는 알 수 없다).
 * 휴대폰 홈 화면은 앞에 앱이 없을 때만 보인다
 */
export function useHomeScreenShown(): boolean {
	const mobile = useIsMobile();
	const { apps } = useAppState();
	return !mobile || foregroundApp(apps) === null;
}
