// 사용 이벤트를 모으는 곳: 새로 연 앱, 앱이 보여 주는 글·프로젝트 (#102)
import { appAddresses } from '@/shared/lib/appLink';
import { track } from './analytics';

/** 앞의 상태에서 실행 중이 아니었는데 지금 실행 중인 앱 */
export function newlyOpened<Name extends string>(
	before: Record<Name, { isRunning: boolean }>,
	now: Record<Name, { isRunning: boolean }>
): Name[] {
	return (Object.keys(now) as Name[]).filter((name) => now[name].isRunning && !before[name]?.isRunning);
}

/**
 * 앱이 보여 주는 항목(메모의 글, Safari의 프로젝트)이 바뀔 때마다 남긴다. 주소 막대와 같은 값을 쓴다 (shared/lib/appLink).
 * 구독을 끊는 함수를 돌려준다
 */
export function trackItemViews(): () => void {
	let seen = appAddresses.getState();
	for (const [app, id] of Object.entries(seen)) if (id) track({ type: 'item', app, item: id });
	return appAddresses.subscribe((now) => {
		for (const [app, id] of Object.entries(now))
			if (id && seen[app as keyof typeof seen] !== id) track({ type: 'item', app, item: id });
		seen = now;
	});
}
