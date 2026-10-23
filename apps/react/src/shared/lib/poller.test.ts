import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPoller, createSharedPoller, keepIfSame, nextDelay, type PollerOptions } from './poller';

/** 응답을 시험이 정하는 조회: 부를 때마다 calls에 쌓이고, resolve·reject를 직접 부른다 */
function deferredRun() {
	const calls: { resolve: () => void; reject: () => void; isCurrent: () => boolean }[] = [];
	const run: PollerOptions['run'] = (isCurrent) =>
		new Promise<void>((resolve, reject) => {
			calls.push({ resolve, reject: () => reject(new Error('fail')), isCurrent });
		});
	return { calls, run };
}

describe('createPoller', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(0);
	});
	afterEach(() => vi.useRealTimers());

	it('켜지면 바로 조회하고, 끝난 시각부터 간격마다 다시 조회한다', async () => {
		const { calls, run } = deferredRun();
		const poller = createPoller({ intervalMs: 60_000, run });
		expect(calls).toHaveLength(0);
		poller.setActive(true);
		expect(calls).toHaveLength(1);
		expect(poller.getState().loading).toBe(true);

		// 응답이 2초 걸렸다: 다음 조회는 끝난 시각(2초)부터 60초 뒤
		await vi.advanceTimersByTimeAsync(2000);
		calls[0].resolve();
		await vi.advanceTimersByTimeAsync(0);
		expect(poller.getState()).toEqual({ loading: false, updatedAt: 2000, failures: 0 });
		await vi.advanceTimersByTimeAsync(59_999);
		expect(calls).toHaveLength(1);
		await vi.advanceTimersByTimeAsync(1);
		expect(calls).toHaveLength(2);
	});

	it('진행 중에는 새로 보내지 않는다 (수동 새로 고침을 여러 번 눌러도 요청 1개)', async () => {
		const { calls, run } = deferredRun();
		const poller = createPoller({ intervalMs: 60_000, run });
		poller.setActive(true);
		poller.refresh();
		poller.refresh();
		expect(calls).toHaveLength(1);
		calls[0].resolve();
		await vi.advanceTimersByTimeAsync(0);
		// 끝난 뒤에는 간격을 기다리지 않고 바로
		poller.refresh();
		expect(calls).toHaveLength(2);
	});

	it('꺼지면(문서가 숨거나 창을 닫으면) 멈추고, 간격이 지난 뒤 다시 켜지면 바로 조회한다', async () => {
		const { calls, run } = deferredRun();
		const poller = createPoller({ intervalMs: 60_000, run });
		poller.setActive(true);
		calls[0].resolve();
		await vi.advanceTimersByTimeAsync(0);

		poller.setActive(false);
		await vi.advanceTimersByTimeAsync(10 * 60_000);
		expect(calls).toHaveLength(1);

		poller.setActive(true);
		expect(calls).toHaveLength(2);
		// 진행 중에 껐다 켜도 요청을 더 보내지 않는다
		poller.setActive(false);
		poller.setActive(true);
		expect(calls).toHaveLength(2);
		calls[1].resolve();
		await vi.advanceTimersByTimeAsync(60_000);
		expect(calls).toHaveLength(3);
	});

	it('간격이 지나기 전에 다시 켜지면 바로 묻지 않고 남은 시간 뒤에 조회한다 (탭을 잠깐 옮겼다 돌아온 경우)', async () => {
		const { calls, run } = deferredRun();
		const poller = createPoller({ intervalMs: 60_000, run });
		poller.setActive(true);
		calls[0].resolve();
		await vi.advanceTimersByTimeAsync(20_000);
		poller.setActive(false);
		await vi.advanceTimersByTimeAsync(10_000);
		poller.setActive(true);
		expect(calls).toHaveLength(1);
		// 끝난 시각(0초)부터 60초: 30초가 지났으니 30초 뒤
		await vi.advanceTimersByTimeAsync(29_999);
		expect(calls).toHaveLength(1);
		await vi.advanceTimersByTimeAsync(1);
		expect(calls).toHaveLength(2);
	});

	it('창·탭을 다시 열었으면(immediate) 간격 안이어도 바로 조회한다', async () => {
		const { calls, run } = deferredRun();
		const poller = createPoller({ intervalMs: 60_000, run });
		poller.setActive(true);
		calls[0].resolve();
		await vi.advanceTimersByTimeAsync(5_000);
		poller.setActive(false);
		poller.setActive(true, true);
		expect(calls).toHaveLength(2);
	});

	it('repeat: false면 처음 켜질 때만 조회하고 다시 예약하지 않는다 (reset은 다시 조회한다)', async () => {
		const { calls, run } = deferredRun();
		const poller = createPoller({ intervalMs: 1000, run, repeat: false });
		poller.setActive(true);
		calls[0].resolve();
		await vi.advanceTimersByTimeAsync(10_000);
		poller.setActive(false);
		poller.setActive(true);
		await vi.advanceTimersByTimeAsync(10_000);
		expect(calls).toHaveLength(1);
		poller.reset();
		expect(calls).toHaveLength(2);
	});

	it('실패가 이어지는 중에 다시 켜지면 늘린 간격이 지난 뒤에 조회한다', async () => {
		const { calls, run } = deferredRun();
		const poller = createPoller({ intervalMs: 60_000, run });
		poller.setActive(true);
		calls[0].reject();
		await vi.advanceTimersByTimeAsync(20_000);
		poller.setActive(false);
		poller.setActive(true);
		expect(calls).toHaveLength(1);
		// 실패 1번: 120초. 20초가 지났으니 100초 뒤
		await vi.advanceTimersByTimeAsync(99_999);
		expect(calls).toHaveLength(1);
		await vi.advanceTimersByTimeAsync(1);
		expect(calls).toHaveLength(2);
	});

	it('꺼져 있으면 수동 새로 고침도 보내지 않는다', () => {
		const { calls, run } = deferredRun();
		const poller = createPoller({ intervalMs: 60_000, run });
		poller.refresh();
		expect(calls).toHaveLength(0);
	});

	it('실패하면 간격을 2배씩 늘리고(상한까지), 성공하면 원래 간격으로 돌아온다', async () => {
		const { calls, run } = deferredRun();
		const poller = createPoller({ intervalMs: 60_000, maxBackoffMs: 5 * 60_000, run });
		poller.setActive(true);
		calls[0].reject();
		await vi.advanceTimersByTimeAsync(0);
		expect(poller.getState()).toMatchObject({ failures: 1, updatedAt: null, loading: false });
		await vi.advanceTimersByTimeAsync(119_999);
		expect(calls).toHaveLength(1);
		await vi.advanceTimersByTimeAsync(1);
		expect(calls).toHaveLength(2);

		calls[1].reject();
		await vi.advanceTimersByTimeAsync(240_000);
		expect(calls).toHaveLength(3);
		calls[2].reject();
		// 3번째 실패: 480초가 아니라 상한 300초
		await vi.advanceTimersByTimeAsync(300_000);
		expect(calls).toHaveLength(4);

		calls[3].resolve();
		await vi.advanceTimersByTimeAsync(0);
		expect(poller.getState().failures).toBe(0);
		await vi.advanceTimersByTimeAsync(60_000);
		expect(calls).toHaveLength(5);
	});

	it('run이 바로 예외를 던져도 실패로 센다', async () => {
		const poller = createPoller({
			intervalMs: 1000,
			run: () => {
				throw new Error('sync');
			},
		});
		poller.setActive(true);
		await vi.advanceTimersByTimeAsync(0);
		expect(poller.getState()).toMatchObject({ loading: false, failures: 1 });
	});

	it('reset: 진행 중인 응답을 버리고 바로 다시 조회한다', async () => {
		const { calls, run } = deferredRun();
		const poller = createPoller({ intervalMs: 60_000, run });
		poller.setActive(true);
		poller.reset();
		expect(calls).toHaveLength(2);
		expect(calls[0].isCurrent()).toBe(false);
		expect(calls[1].isCurrent()).toBe(true);

		// 앞의 응답이 늦게 와도 상태와 일정은 새 조회를 따른다
		calls[0].resolve();
		await vi.advanceTimersByTimeAsync(0);
		expect(poller.getState()).toMatchObject({ loading: true, updatedAt: null });
		calls[1].resolve();
		await vi.advanceTimersByTimeAsync(0);
		expect(poller.getState()).toMatchObject({ loading: false, updatedAt: 0 });
		expect(calls).toHaveLength(2);
	});

	it('dispose: 멈추고 진행 중인 응답을 버린다 (컴포넌트가 내려갈 때)', async () => {
		const { calls, run } = deferredRun();
		const poller = createPoller({ intervalMs: 1000, run });
		poller.setActive(true);
		poller.dispose();
		expect(calls[0].isCurrent()).toBe(false);
		calls[0].resolve();
		await vi.advanceTimersByTimeAsync(10_000);
		expect(calls).toHaveLength(1);
		poller.refresh();
		expect(calls).toHaveLength(1);
	});

	it('간격을 바꾸면 다음 예약부터 따른다', async () => {
		const { calls, run } = deferredRun();
		const poller = createPoller({ intervalMs: 10_000, run });
		poller.setActive(true);
		poller.setIntervalMs(60_000);
		calls[0].resolve();
		await vi.advanceTimersByTimeAsync(10_000);
		expect(calls).toHaveLength(1);
		await vi.advanceTimersByTimeAsync(50_000);
		expect(calls).toHaveLength(2);
	});
});

describe('nextDelay', () => {
	it('실패 0번이면 간격 그대로, 이어서 실패하면 2배씩, 상한은 간격보다 짧아지지 않는다', () => {
		expect(nextDelay(60_000, 0)).toBe(60_000);
		expect(nextDelay(60_000, 1)).toBe(120_000);
		expect(nextDelay(60_000, 10)).toBe(600_000);
		expect(nextDelay(60_000, 3, 30_000)).toBe(60_000);
	});
});

describe('createSharedPoller', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(0);
	});
	afterEach(() => vi.useRealTimers());

	it('보는 곳이 여럿이어도 요청은 하나다. 모두 반납하면 멈추고, 하나라도 다시 보면 이어서 조회한다', async () => {
		const { calls, run } = deferredRun();
		const shared = createSharedPoller({ intervalMs: 60_000, run });
		const changes = vi.fn();
		shared.subscribe(changes);
		const releaseA = shared.acquire();
		const releaseB = shared.acquire();
		expect(calls).toHaveLength(1);
		calls[0].resolve();
		await vi.advanceTimersByTimeAsync(0);
		expect(changes).toHaveBeenCalled();
		expect(shared.getState().updatedAt).toBe(0);

		releaseA();
		// 같은 함수를 두 번 불러도 한 번만 반납한다
		releaseA();
		await vi.advanceTimersByTimeAsync(60_000);
		expect(calls).toHaveLength(2);
		calls[1].resolve();
		await vi.advanceTimersByTimeAsync(0);

		releaseB();
		await vi.advanceTimersByTimeAsync(10 * 60_000);
		expect(calls).toHaveLength(2);
		shared.acquire();
		expect(calls).toHaveLength(3);
	});
});

describe('keepIfSame', () => {
	it('값이 같으면 앞의 객체를 그대로 돌려준다 (화면을 다시 그리지 않게)', () => {
		const previous = [{ id: 'a', text: '안녕' }];
		expect(keepIfSame(previous, [{ id: 'a', text: '안녕' }])).toBe(previous);
		const changed = [{ id: 'a', text: '안녕하세요' }];
		expect(keepIfSame(previous, changed)).toBe(changed);
	});
});
