// 화면이 보이는 동안만 주기적으로 다시 조회한다 (활동 상태 보기, 메모의 조회수).
// 일정(간격·중복 방지·실패 시 백오프)은 shared/lib/poller.ts가 정하고, 여기서는 문서의 visibility와 켜는 조건을 연결한다
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPoller, type Poller, type PollerState } from '@/shared/lib/poller';

const subscribeVisibility = (onChange: () => void) => {
	document.addEventListener('visibilitychange', onChange);
	return () => document.removeEventListener('visibilitychange', onChange);
};

/** 브라우저 탭이 보이는지 (다른 탭으로 옮기거나 창을 내리면 false) */
export function useDocumentVisible(): boolean {
	return useSyncExternalStore(
		subscribeVisibility,
		() => document.visibilityState !== 'hidden',
		() => true
	);
}

export interface PollingOptions {
	/** 성공한 뒤 다음 조회까지 간격 (ms) */
	intervalMs: number;
	/** 조회할 조건 (앱 창이 열려 있다, 그 탭을 보고 있다 등). 문서가 숨으면 이 값과 관계없이 멈춘다 */
	active: boolean;
	/** 조회 조건 (기간 등). 바뀌면 진행 중인 응답을 버리고 바로 다시 조회한다 */
	resetKey?: string;
	maxBackoffMs?: number;
}

export interface Polling extends PollerState {
	/** 지금 다시 조회한다 (수동 새로 고침). 진행 중이면 요청을 더 보내지 않는다 */
	refresh: () => void;
}

/**
 * run은 조회 한 번 (실패하면 reject). isCurrent()가 false면 조건이 바뀐 뒤에 돌아온 응답이라 반영하지 않는다.
 * run은 렌더링마다 바뀌어도 된다 (늘 마지막 것을 부른다)
 */
export function usePolling(run: (isCurrent: () => boolean) => Promise<unknown>, options: PollingOptions): Polling {
	const { intervalMs, active, resetKey = '', maxBackoffMs } = options;
	const runRef = useRef(run);
	const intervalRef = useRef(intervalMs);
	useEffect(() => {
		runRef.current = run;
		intervalRef.current = intervalMs;
	});
	const [state, setState] = useState<PollerState>({ loading: false, updatedAt: null, failures: 0 });
	const visible = useDocumentVisible();
	const on = active && visible;

	// 일정은 마운트할 때 만들고, 내려가면 진행 중인 응답까지 버린다
	const pollerRef = useRef<Poller | null>(null);
	useEffect(() => {
		const poller = createPoller({
			intervalMs: intervalRef.current,
			maxBackoffMs,
			run: (isCurrent) => runRef.current(isCurrent),
			onChange: setState,
		});
		pollerRef.current = poller;
		return () => {
			poller.dispose();
			pollerRef.current = null;
		};
	}, [maxBackoffMs]);

	useEffect(() => pollerRef.current?.setIntervalMs(intervalMs), [intervalMs]);

	// 조건이 바뀌면 다시 조회한다 (처음 그릴 때는 아래 setActive가 조회한다)
	const lastKey = useRef(resetKey);
	useEffect(() => {
		if (lastKey.current === resetKey) return;
		lastKey.current = resetKey;
		pollerRef.current?.reset();
	}, [resetKey]);

	useEffect(() => {
		pollerRef.current?.setActive(on);
		return () => pollerRef.current?.setActive(false);
	}, [on, maxBackoffMs]);

	const refresh = useCallback(() => pollerRef.current?.refresh(), []);
	return { ...state, refresh };
}
