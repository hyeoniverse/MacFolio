import type { AppName } from '@/apps/manifest';
import { useAppState } from './useAppState';

/**
 * 앱 창이 화면에 있는지: 열려 있고 최소화하지 않았다. 앱 컴포넌트는 창을 닫거나 최소화해도 내려가지 않으므로
 * 주기적으로 조회하는 앱(활동 상태 보기, 메모의 조회수)은 이 값으로 조회를 멈춘다
 */
export function useAppWindowShown(appName: AppName): boolean {
	const { isRunning, isMinimized } = useAppState().apps[appName];
	return isRunning && !isMinimized;
}
