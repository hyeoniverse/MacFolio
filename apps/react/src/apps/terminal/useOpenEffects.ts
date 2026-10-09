import { useAppState } from '@/desktop/useAppState';
import { APP_MANIFEST } from '@/apps/manifest';
import type { Effect } from './commands';
import { openExternal } from '@/shared/analytics/analytics';

/** 명령의 효과 중 앱·주소 열기를 실행한다. 터미널과 단축어가 함께 쓴다. */
export function useOpenEffects() {
	const { openApp, bringAppToFront } = useAppState();

	return (effects: Effect[]) => {
		for (const effect of effects) {
			if (effect.type === 'open-url') openExternal(effect.url, 'noopener');
			if (effect.type === 'open-app') {
				const action = APP_MANIFEST[effect.app].action;
				if (action?.type === 'link') openExternal(action.url, 'noopener');
				else {
					openApp(effect.app);
					bringAppToFront(effect.app);
				}
			}
		}
	};
}
