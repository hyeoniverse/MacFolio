// 화면이 보이는 동안만 주기적으로 다시 조회한다 (활동 상태 보기, 메모, 메시지, 메일, 위젯 등).
// 일정(간격·중복 방지·실패 시 백오프)은 shared/lib/poller.ts가 정하고, 여기서는 문서의 visibility와 켜는 조건을 연결한다
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPoller, type Poller, type PollerState, type SharedPoller } from '@/shared/lib/poller';

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
	/**
	 * 조회할 조건 (앱 창이 열려 있다, 그 탭을 보고 있다 등). 문서가 숨으면 이 값과 관계없이 멈춘다.
	 * false에서 true가 되면 바로 조회하고, 문서가 다시 보일 때는 간격이 지났을 때만 조회한다
	 */
	active: boolean;
	/** 조회 조건 (기간 등). 바뀌면 진행 중인 응답을 버리고 바로 다시 조회한다 */
	resetKey?: string;
	maxBackoffMs?: number;
	/** false면 처음 켜질 때(와 resetKey가 바뀔 때·refresh)만 조회한다 (poller.ts의 repeat). 기본 true */
	repeat?: boolean;
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
	const { intervalMs, active, resetKey = '', maxBackoffMs, repeat = true } = options;
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
			repeat,
			run: (isCurrent) => runRef.current(isCurrent),
			onChange: setState,
		});
		pollerRef.current = poller;
		return () => {
			poller.dispose();
			pollerRef.current = null;
		};
	}, [maxBackoffMs, repeat]);

	useEffect(() => pollerRef.current?.setIntervalMs(intervalMs), [intervalMs]);

	// 조건이 바뀌면 다시 조회한다 (처음 그릴 때는 아래 setActive가 조회한다)
	const lastKey = useRef(resetKey);
	useEffect(() => {
		if (lastKey.current === resetKey) return;
		lastKey.current = resetKey;
		pollerRef.current?.reset();
	}, [resetKey]);

	// active가 다시 켜졌으면(창·탭을 다시 열었다) 바로 조회한다. 문서만 다시 보이면 간격이 지났을 때만 조회한다
	const wasActive = useRef(false);
	useEffect(() => {
		const reopened = active && !wasActive.current;
		wasActive.current = active;
		pollerRef.current?.setActive(on, reopened);
		return () => pollerRef.current?.setActive(false);
	}, [on, active, maxBackoffMs, repeat]);

	const refresh = useCallback(() => pollerRef.current?.refresh(), []);
	return { ...state, refresh };
}

/**
 * 공유 일정(poller.ts의 createSharedPoller)을 이 화면도 본다. active이고 문서가 보이는 동안만 acquire한다.
 * 위젯 여러 개와 앱 창이 같은 값을 보아도 요청은 하나다. 일정의 상태(마지막 성공 시각, 실패 횟수)를 돌려준다
 */
export function useSharedPolling(shared: SharedPoller, active: boolean): PollerState {
	const visible = useDocumentVisible();
	const on = active && visible;
	useEffect(() => (on ? shared.acquire() : undefined), [shared, on]);
	return useSyncExternalStore(shared.subscribe, shared.getState, shared.getState);
}
