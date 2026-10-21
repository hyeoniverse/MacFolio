// 처음 온 사람에게 둘러보기를 띄운다. 로딩 화면이 걷힌 뒤 App이 부른다
import { isMobileViewport } from '@/desktop/layout';
import { hasSeenTour, startTour } from './tourStore';
import { stepsFor } from './tourSteps';

/** 지금 화면(데스크톱·휴대폰)에 맞는 둘러보기 단계 */
export const currentSteps = () => stepsFor(isMobileViewport({ width: window.innerWidth, height: window.innerHeight }));

/** 이 브라우저에서 처음이면 둘러보기를 연다. 로딩 화면이 사라지는 움직임이 끝난 뒤에 */
export function startFirstVisitTour() {
	if (hasSeenTour()) return;
	window.setTimeout(() => {
		if (!hasSeenTour()) startTour(currentSteps());
	}, 600);
}
