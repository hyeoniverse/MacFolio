import { describe, expect, it, vi } from 'vitest';
import { barsOf, checkServer, STATE_LABEL, classify, serverStore } from './serverStatus';

const result = (patch: Partial<Parameters<typeof classify>[0]> = {}) => ({
	network: true,
	status: 200,
	databaseDown: false,
	latency: 120,
	...patch,
});

describe('서버 상태', () => {
	it('응답 코드·시간·DB로 나눈다', () => {
		expect(classify(result())).toBe('online');
		expect(classify(result({ latency: 1500 }))).toBe('slow');
		expect(classify(result({ status: 503, databaseDown: true }))).toBe('database');
		// 터널이 서버에 닿지 못하면 502·530 같은 응답이 온다
		expect(classify(result({ status: 502 }))).toBe('offline');
		expect(classify(result({ status: 503 }))).toBe('offline');
		expect(classify(result({ status: null }))).toBe('offline');
		expect(classify(result({ network: false, status: null }))).toBe('no-network');
	});

	it('막대 수: 빠르면 셋, 보통 둘, 느리거나 DB가 안 되면 하나, 닿지 않으면 0', () => {
		expect(barsOf({ state: 'online', latency: 80 })).toBe(3);
		expect(barsOf({ state: 'online', latency: 600 })).toBe(2);
		expect(barsOf({ state: 'slow', latency: 1500 })).toBe(1);
		expect(barsOf({ state: 'database', latency: 90 })).toBe(1);
		expect(barsOf({ state: 'offline', latency: null })).toBe(0);
		expect(barsOf({ state: 'disabled', latency: null })).toBe(0);
	});

	it('checkServer: /health 응답을 상태로 남긴다', async () => {
		const ok = vi.fn(async () => new Response('{"status":"ok"}', { status: 200 })) as unknown as typeof fetch;
		await checkServer('http://api', ok);
		expect(ok).toHaveBeenCalledWith('http://api/health', expect.objectContaining({ cache: 'no-store' }));
		expect(serverStore.getState()).toMatchObject({ state: 'online', checkedAt: expect.any(Number) });

		const dbDown = vi.fn(
			async () => new Response('{"message":"DB에 연결할 수 없습니다."}', { status: 503 })
		) as unknown as typeof fetch;
		await checkServer('http://api', dbDown);
		expect(serverStore.getState().state).toBe('database');

		const down = vi.fn(async () => {
			throw new TypeError('Failed to fetch');
		}) as unknown as typeof fetch;
		await checkServer('http://api', down);
		expect(serverStore.getState()).toMatchObject({ state: 'offline', latency: null });

		// CORS로 막힌 주소(PR 미리보기 등): 보통 요청은 실패하지만 응답을 읽지 않는 요청(no-cors)은 닿는다
		const blocked = vi.fn(async (_url: string, init?: RequestInit) => {
			if (init?.mode === 'no-cors') return new Response(null, { status: 200 });
			throw new TypeError('Failed to fetch');
		}) as unknown as typeof fetch;
		await checkServer('http://api', blocked);
		expect(serverStore.getState()).toMatchObject({ state: 'blocked', latency: null });
		expect(STATE_LABEL.blocked).toBe('이 주소에서는 쓸 수 없음');

		await checkServer('');
		expect(serverStore.getState().state).toBe('disabled');
	});
});
