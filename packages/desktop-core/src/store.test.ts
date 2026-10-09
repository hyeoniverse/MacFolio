import { describe, expect, it, vi } from 'vitest';
import { createStore } from './store.js';

describe('createStore', () => {
	it('일부 필드만 바꿔도 나머지는 유지된다', () => {
		const store = createStore({ a: 1, b: 2 });
		store.setState({ a: 10 });
		expect(store.getState()).toEqual({ a: 10, b: 2 });
	});

	it('바뀔 때 구독자에게 알리고, 구독을 해제하면 멈춘다', () => {
		const store = createStore({ count: 0 });
		const listener = vi.fn();
		const unsubscribe = store.subscribe(listener);

		store.setState((state) => ({ count: state.count + 1 }));
		expect(listener).toHaveBeenCalledWith({ count: 1 });

		unsubscribe();
		store.setState({ count: 2 });
		expect(listener).toHaveBeenCalledTimes(1);
	});

	it('같은 상태를 돌려주면 알리지 않는다', () => {
		const store = createStore({ count: 0 });
		const listener = vi.fn();
		store.subscribe(listener);
		store.setState((state) => state);
		expect(listener).not.toHaveBeenCalled();
	});
});
