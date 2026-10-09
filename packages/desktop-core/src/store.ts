/**
 * 프레임워크에 의존하지 않는 작은 상태 저장소.
 * React에서는 useSyncExternalStore로 구독한다. Vue라면 shallowRef에 담아 subscribe로 갱신하면 된다.
 */
export interface Store<State> {
	getState: () => State;
	setState: (update: Partial<State> | ((state: State) => State)) => void;
	subscribe: (listener: (state: State) => void) => () => void;
}

export function createStore<State extends object>(initialState: State): Store<State> {
	let state = initialState;
	const listeners = new Set<(state: State) => void>();

	return {
		getState: () => state,
		setState: (update) => {
			const next = typeof update === 'function' ? update(state) : { ...state, ...update };
			if (Object.is(next, state)) return;
			state = next;
			listeners.forEach((listener) => listener(state));
		},
		subscribe: (listener) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
	};
}
