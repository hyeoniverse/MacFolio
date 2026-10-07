import { useState } from 'react';
import { useAppState } from '@/desktop/AppStateContext';
import { APP_MANIFEST, type AppName } from '@/apps/manifest';
import { notify } from '@/desktop/notifications/notificationStore';
import { openExternal } from '@/shared/analytics/analytics';

/** 공유 앱의 실행 중 표시(점)를 켜 두는 시간. 알림이 떠 있는 동안 */
const SHARING_MS = 3500;

/**
 * 앱 아이콘을 눌렀을 때의 동작. Dock과 모바일 홈 화면이 함께 쓴다.
 * 링크 앱은 새 탭을 열고, 공유 앱은 주소를 복사하고, 나머지는 창을 연다.
 */
export function useLaunchApp() {
	const { apps, openApp, maximizeApp, bringAppToFront } = useAppState();
	const [isSharing, setIsSharing] = useState(false);

	const launch = (appName: AppName) => {
		const action = APP_MANIFEST[appName].action;

		if (action?.type === 'link') {
			openExternal(action.url, '');
			return;
		}

		if (action?.type === 'share') {
			const url = window.location.href;
			setIsSharing(true);
			setTimeout(() => setIsSharing(false), SHARING_MS);
			// 복사가 끝난 뒤에 알린다. 브라우저가 클립보드 쓰기를 막으면(권한, 포커스) 주소를 대신 보여 준다
			navigator.clipboard.writeText(url).then(
				() => notify({ app: 'share', title: '링크 복사됨', body: '링크가 복사되었습니다!' }),
				() => notify({ app: 'share', title: '링크를 복사하지 못했습니다', body: url })
			);
			return;
		}

		// 창을 여는 앱만 앞으로 (링크·공유는 창이 없어서 메뉴 막대는 Finder로 남는다)
		bringAppToFront(appName);
		if (apps[appName].isRunning) maximizeApp(appName);
		else openApp(appName);
	};

	/** 실행 중 표시(점). 공유 앱은 알림이 떠 있는 동안 켠다. */
	const isActive = (appName: AppName) =>
		APP_MANIFEST[appName].action?.type === 'share'
			? isSharing
			: // Finder처럼 끌 수 없는 앱은 창이 없어도 늘 켜짐
				APP_MANIFEST[appName].alwaysRunning === true || apps[appName].isRunning;

	return { launch, isActive };
}
