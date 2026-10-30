import { describe, expect, it, vi } from 'vitest';
import { cacheKey, FRESH_MS, withEdgeCache, type EdgeCache } from './edgeCache';

/** Cache API 흉내: 주소로 응답을 보관한다 */
function fakeCache(): EdgeCache & { stored: Map<string, Response> } {
	const stored = new Map<string, Response>();
	return {
		stored,
		match: async (request) => stored.get(request.url)?.clone(),
		put: async (request, response) => {
			stored.set(request.url, response);
		},
	};
}

/** waitUntil에 넘긴 일을 모아 두었다가 기다린다 */
function fakeTasks() {
	const pending: Promise<unknown>[] = [];
	return { waitUntil: (promise: Promise<unknown>) => pending.push(promise), settle: () => Promise.all(pending) };
}

const page = (body: string, status = 200) =>
	new Response(body, { status, headers: { 'content-type': 'text/html', 'cache-control': 'no-cache' } });
const key = cacheKey(new URL('https://macfolio.hyeoniverse.com/memo/hello?utm_source=x'), '"v1"');

describe('첫 화면 HTML의 엣지 캐시', () => {
	it('키는 주소의 경로와 배포 버전(index.html의 ETag)이다. 검색 문자열은 뺀다', () => {
		expect(key.url).toBe('https://macfolio.hyeoniverse.com/memo/hello?v=%22v1%22');
		expect(cacheKey(new URL('https://macfolio.hyeoniverse.com/memo/hello'), '"v2"').url).not.toBe(key.url);
	});

	it('없으면 만들어 주면서 보관하고, 다음 요청은 만들지 않고 보관한 것을 준다', async () => {
		const cache = fakeCache();
		const tasks = fakeTasks();
		const build = vi.fn(async () => page('첫 화면'));
		const first = await withEdgeCache(key, build, { cache, tasks, now: 1_000 });
		expect(await first.text()).toBe('첫 화면');
		await tasks.settle();

		const second = await withEdgeCache(key, build, { cache, tasks, now: 1_000 + FRESH_MS - 1 });
		expect(await second.text()).toBe('첫 화면');
		expect(build).toHaveBeenCalledTimes(1);
		// 방문자에게는 늘 다시 묻게 하고, 보관한 시각은 빼고 준다
		expect(second.headers.get('cache-control')).toBe('no-cache');
		expect(second.headers.get('x-macfolio-stored-at')).toBeNull();
	});

	it('1분이 지났으면 보관한 것을 바로 주고, 뒤에서 새로 만들어 바꿔 둔다', async () => {
		const cache = fakeCache();
		const tasks = fakeTasks();
		await withEdgeCache(key, async () => page('예전'), { cache, tasks, now: 0 });
		await tasks.settle();

		const build = vi.fn(async () => page('새것'));
		const stale = await withEdgeCache(key, build, { cache, tasks, now: FRESH_MS + 1 });
		expect(await stale.text()).toBe('예전');
		await tasks.settle();
		expect(build).toHaveBeenCalledTimes(1);
		const next = await withEdgeCache(key, build, { cache, tasks, now: FRESH_MS + 2 });
		expect(await next.text()).toBe('새것');
	});

	it('첫 화면(200)과 없는 글(404)만 보관한다', async () => {
		const cache = fakeCache();
		const tasks = fakeTasks();
		await withEdgeCache(key, async () => page('잠깐 오류', 500), { cache, tasks, now: 0 });
		await tasks.settle();
		expect(cache.stored.size).toBe(0);
		await withEdgeCache(key, async () => page('없는 글', 404), { cache, tasks, now: 0 });
		await tasks.settle();
		expect(cache.stored.get(key.url)?.status).toBe(404);
	});

	it('캐시가 없는 곳(시험, 미리보기)에서는 매번 만든다', async () => {
		const build = vi.fn(async () => page('첫 화면'));
		await withEdgeCache(key, build, {});
		await withEdgeCache(key, build, {});
		expect(build).toHaveBeenCalledTimes(2);
	});
});
