// 주기적으로 다시 조회하는 일정 관리 (React 없이). usePolling(shared/hooks)이 화면 상태와 연결한다.
// - 켜져 있을 때(active)만 조회한다. 꺼지면 예약한 조회를 취소하고, 다시 켜지면 바로 조회한다
//   (실패가 이어지는 중이면 늘린 간격이 지난 뒤에)
// - 조회가 끝난 시각부터 다음 간격을 잰다 (setInterval처럼 응답이 늦어도 요청이 겹치지 않는다)
// - 같은 조회가 진행 중이면 새로 보내지 않는다 (수동 새로 고침을 여러 번 눌러도 요청 1개)
// - 실패하면 간격을 2배씩 늘린다 (상한 maxBackoffMs). 성공하면 원래 간격으로 돌아온다
// - reset()은 조건(기간 등)이 바뀌었을 때: 진행 중인 응답을 버리고 바로 다시 조회한다

export interface PollerState {
	/** 조회가 진행 중인지 */
	loading: boolean;
	/** 마지막으로 성공한 시각 (ms). reset 뒤 아직 성공하지 않았으면 null */
	updatedAt: number | null;
	/** 이어서 실패한 횟수 (성공하면 0) */
	failures: number;
}

export interface PollerOptions {
	/** 성공한 뒤 다음 조회까지 간격 (ms) */
	intervalMs: number;
	/** 실패가 이어질 때 늘어나는 간격의 상한 (ms). 기본 10분 */
	maxBackoffMs?: number;
	/**
	 * 조회 한 번. 실패하면 reject한다 (간격을 늘린다).
	 * isCurrent()가 false면 그 사이 reset됐다: 응답을 화면에 반영하지 않는다
	 */
	run: (isCurrent: () => boolean) => Promise<unknown>;
	onChange?: (state: PollerState) => void;
	now?: () => number;
}

export interface Poller {
	/** 조회할 조건(문서가 보이고 앱 창이 열려 있다 등)이 바뀌었다 */
	setActive: (active: boolean) => void;
	/** 지금 조회한다 (수동 새로 고침). 꺼져 있거나 이미 진행 중이면 아무것도 하지 않는다 */
	refresh: () => void;
	/** 조회 조건(기간 등)이 바뀌었다: 진행 중인 응답을 버리고, 켜져 있으면 바로 다시 조회한다 */
	reset: () => void;
	/** 멈추고 진행 중인 응답을 버린다 (컴포넌트가 내려갈 때) */
	dispose: () => void;
	/** 간격을 바꾼다 (다음 예약부터) */
	setIntervalMs: (ms: number) => void;
	getState: () => PollerState;
}

export const DEFAULT_MAX_BACKOFF_MS = 10 * 60_000;

/** 실패가 failures번 이어졌을 때 다음 조회까지 간격 */
export function nextDelay(intervalMs: number, failures: number, maxBackoffMs = DEFAULT_MAX_BACKOFF_MS): number {
	if (failures <= 0) return intervalMs;
	return Math.min(intervalMs * 2 ** failures, Math.max(intervalMs, maxBackoffMs));
}

export function createPoller(options: PollerOptions): Poller {
	const now = options.now ?? Date.now;
	let intervalMs = options.intervalMs;
	let active = false;
	/** reset할 때마다 1 늘린다. 응답이 돌아왔을 때 같은 세대인지 본다 */
	let generation = 0;
	let running = false;
	let timer: ReturnType<typeof setTimeout> | undefined;
	/** 마지막 조회가 끝난 시각 (성공·실패 모두) */
	let finishedAt: number | null = null;
	let state: PollerState = { loading: false, updatedAt: null, failures: 0 };

	const emit = (patch: Partial<PollerState>) => {
		state = { ...state, ...patch };
		options.onChange?.(state);
	};
	const delay = () => nextDelay(intervalMs, state.failures, options.maxBackoffMs);
	const cancel = () => {
		clearTimeout(timer);
		timer = undefined;
	};
	const schedule = (ms: number) => {
		cancel();
		timer = setTimeout(fire, Math.max(0, ms));
	};

	function fire() {
		if (!active || running) return;
		cancel();
		running = true;
		const mine = generation;
		const isCurrent = () => mine === generation;
		emit({ loading: true });
		let ok = false;
		let task: Promise<unknown>;
		try {
			task = options.run(isCurrent);
		} catch (error) {
			task = Promise.reject(error);
		}
		void task
			.then(
				() => {
					ok = true;
				},
				() => undefined
			)
			.then(() => {
				// reset된 뒤에 돌아온 응답: 상태를 건드리지 않는다 (reset이 이미 새 조회를 보냈다)
				if (!isCurrent()) return;
				running = false;
				finishedAt = now();
				emit(
					ok ? { loading: false, updatedAt: finishedAt, failures: 0 } : { loading: false, failures: state.failures + 1 }
				);
				if (active) schedule(delay());
			});
	}

	return {
		setActive(next) {
			if (next === active) return;
			active = next;
			if (!active) return cancel();
			if (running) return;
			// 다시 켜졌다 (탭이 다시 보인다, 그 표를 다시 연다): 바로 조회한다. 실패가 이어지는 중이면 늘린 간격을 지킨다
			const wait = finishedAt === null || state.failures === 0 ? 0 : delay() - (now() - finishedAt);
			if (wait <= 0) fire();
			else schedule(wait);
		},
		refresh() {
			fire();
		},
		reset() {
			generation += 1;
			running = false;
			finishedAt = null;
			cancel();
			emit({ loading: false, updatedAt: null, failures: 0 });
			fire();
		},
		dispose() {
			active = false;
			generation += 1;
			running = false;
			cancel();
		},
		setIntervalMs(ms) {
			intervalMs = ms;
		},
		getState: () => state,
	};
}
