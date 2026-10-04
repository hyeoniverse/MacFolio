// 서버(API) 상태: 메뉴 막대의 Wi-Fi 자리에 보인다. /health를 주기적으로 불러 응답 시간과 DB 상태로 나눈다.
import { useEffect, useSyncExternalStore } from 'react';
import { env } from '@/shared/config/env';
import { createStore } from '@/shared/lib/createStore';

export type ServerState =
	/** 서버 주소가 없다 (로컬에서 API 없이 띄웠을 때) */
	| 'disabled'
	/** 처음 확인하는 중 */
	| 'checking'
	| 'online'
	/** 응답은 하지만 느리다 */
	| 'slow'
	/** 서버는 응답하지만 DB에 연결하지 못한다 */
	| 'database'
	/** 서버에 닿지 않는다 (꺼졌거나 터널이 끊겼다) */
	| 'offline'
	/** 이 기기가 인터넷에 연결되어 있지 않다 */
	| 'no-network';

export interface ServerStatus {
	state: ServerState;
	/** 마지막 응답 시간 (ms). 응답이 없었으면 null */
	latency: number | null;
	/** 마지막으로 확인한 때 (Date.now()) */
	checkedAt: number | null;
}

/** 이보다 오래 걸리면 느림 */
export const SLOW_MS = 1000;
/** 이보다 빠르면 막대 셋 */
export const FAST_MS = 300;
/** 응답을 기다리는 한도 */
export const TIMEOUT_MS = 6000;
/** 다시 확인하는 간격 (탭이 보이는 동안만) */
export const POLL_MS = 30_000;

/** 확인 결과를 상태로 나눈다 */
export function classify(result: {
	network: boolean;
	/** 응답 코드. 응답이 없었으면(연결 실패·시간 초과) null */
	status: number | null;
	databaseDown: boolean;
	latency: number;
}): ServerState {
	if (!result.network) return 'no-network';
	if (result.status === null) return 'offline';
	if (result.status === 503 && result.databaseDown) return 'database';
	if (result.status < 200 || result.status >= 300) return 'offline';
	return result.latency > SLOW_MS ? 'slow' : 'online';
}

/** Wi-Fi 막대 수 (0~3) */
export function barsOf({ state, latency }: Pick<ServerStatus, 'state' | 'latency'>): number {
	if (state === 'online') return latency !== null && latency < FAST_MS ? 3 : 2;
	if (state === 'slow' || state === 'database') return 1;
	return 0;
}

export const STATE_LABEL: Record<ServerState, string> = {
	disabled: '연결된 서버 없음',
	checking: '확인하는 중',
	online: '정상',
	slow: '응답 느림',
	database: 'DB 연결 안 됨',
	offline: '서버에 연결할 수 없음',
	'no-network': '인터넷 연결 없음',
};

export const serverStore = createStore<ServerStatus>({
	state: env.apiUrl ? 'checking' : 'disabled',
	latency: null,
	checkedAt: null,
});

let inFlight: Promise<void> | null = null;

/** 지금 확인한다 (이미 확인하는 중이면 그 결과를 기다린다) */
export function checkServer(apiUrl = env.apiUrl, fetchImpl: typeof fetch = fetch): Promise<void> {
	if (!apiUrl) {
		serverStore.setState({ state: 'disabled', latency: null, checkedAt: null });
		return Promise.resolve();
	}
	inFlight ??= (async () => {
		const started = performance.now();
		let status: number | null;
		let databaseDown = false;
		try {
			const response = await fetchImpl(`${apiUrl}/health`, {
				cache: 'no-store',
				signal: AbortSignal.timeout(TIMEOUT_MS),
			});
			status = response.status;
			if (status === 503) {
				const body = (await response.json().catch(() => ({}))) as { message?: string };
				databaseDown = /DB/.test(body.message ?? '');
			}
		} catch {
			status = null;
		}
		const latency = Math.round(performance.now() - started);
		const network = typeof navigator === 'undefined' || navigator.onLine !== false;
		const state = classify({ network, status, databaseDown, latency });
		serverStore.setState({
			state,
			latency: status === null ? null : latency,
			checkedAt: Date.now(),
		});
	})().finally(() => {
		inFlight = null;
	});
	return inFlight;
}

let watchers = 0;
let timer: ReturnType<typeof setInterval> | undefined;
let stop = () => {};

/** 화면에 상태가 보이는 동안 주기적으로 확인한다. 탭을 다시 보거나 인터넷이 돌아오면 바로 확인한다 */
function watch() {
	watchers += 1;
	if (watchers > 1) return unwatch;
	const check = () => {
		if (document.visibilityState === 'visible') void checkServer();
	};
	const offline = () => serverStore.setState((state) => ({ ...state, state: 'no-network', checkedAt: Date.now() }));
	check();
	timer = setInterval(check, POLL_MS);
	document.addEventListener('visibilitychange', check);
	window.addEventListener('online', check);
	window.addEventListener('offline', offline);
	stop = () => {
		clearInterval(timer);
		document.removeEventListener('visibilitychange', check);
		window.removeEventListener('online', check);
		window.removeEventListener('offline', offline);
	};
	return unwatch;
}

function unwatch() {
	watchers -= 1;
	if (watchers === 0) stop();
}

/** 서버 상태 (보는 동안 주기적으로 확인한다) */
export function useServerStatus(): ServerStatus {
	useEffect(() => (env.apiUrl ? watch() : undefined), []);
	return useSyncExternalStore(serverStore.subscribe, serverStore.getState);
}
