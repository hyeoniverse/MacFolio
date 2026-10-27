import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import {
	navigatedFrameHistory,
	observeFrameHistory,
	startFrameHistory,
	stepFrameHistory,
	type FrameHistory,
} from '@/shared/ui/web-frame/frameHistory';

/** iframe 안의 이동(pushState)은 알려 주는 이벤트가 없어서 history.length를 이 간격으로 다시 읽는다 */
const POLL_MS = 400;
/** 뒤로·앞으로·새로 고침 뒤 이만큼 안에 오는 load는 새 이동이 아니다 (bfcache로 돌아가면 load가 오지 않아 시간으로 끊는다) */
const OWN_LOAD_MS = 3000;

/**
 * iframe 안 페이지의 뒤로·앞으로 (frameHistory.ts). onLoad는 iframe의 load에 연결하고,
 * expectLoad는 이 틀이 직접 iframe을 옮긴 시각(새로 고침)에 부른다
 */
export function useFrameHistory(frame: RefObject<HTMLIFrameElement | null>) {
	const [state, setState] = useState<FrameHistory>(() => startFrameHistory(window.history.length));
	const quietUntil = useRef(0);
	const loadedAt = useRef(0);

	useEffect(() => {
		const timer = setInterval(() => {
			const own = document.activeElement === frame.current || Date.now() - loadedAt.current < POLL_MS * 2;
			setState((current) => observeFrameHistory(current, window.history.length, own));
		}, POLL_MS);
		return () => clearInterval(timer);
	}, [frame]);

	const expectLoad = useCallback(() => {
		quietUntil.current = Date.now() + OWN_LOAD_MS;
	}, []);

	const onLoad = useCallback(() => {
		loadedAt.current = Date.now();
		if (Date.now() < quietUntil.current) {
			quietUntil.current = 0;
			return;
		}
		setState((current) => navigatedFrameHistory(current, window.history.length));
	}, []);

	const go = useCallback(
		(step: -1 | 1) => {
			expectLoad();
			setState((current) => stepFrameHistory(current, step));
			if (step < 0) window.history.back();
			else window.history.forward();
		},
		[expectLoad]
	);

	return { state, go, onLoad, expectLoad };
}
