import { afterEach, describe, expect, it, vi } from 'vitest';
import { mergeSuggestions, NPM_SEARCH, searchPackages } from './packageSearch';

afterEach(() => vi.unstubAllGlobals());

describe('npm 패키지 찾기', () => {
	it('두 글자부터 레지스트리에 묻고 이름만 돌려준다', async () => {
		const fetch = vi.fn(async () => Response.json({ objects: [{ package: { name: 'zod' } }, { package: {} }] }));
		vi.stubGlobal('fetch', fetch);
		expect(await searchPackages('z')).toEqual([]);
		expect(fetch).not.toHaveBeenCalled();
		expect(await searchPackages('zo d')).toEqual(['zod']);
		expect(fetch).toHaveBeenCalledWith(`${NPM_SEARCH}?text=zo%20d&size=20`, { signal: undefined });
	});

	it('실패하면 빈 목록', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response('', { status: 500 }))
		);
		expect(await searchPackages('react')).toEqual([]);
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => Promise.reject(new Error('offline')))
		);
		expect(await searchPackages('react')).toEqual([]);
	});

	it('코드의 후보 뒤에 붙이고, 겹치거나 고른 것은 뺀다 (대소문자 무시)', () => {
		expect(mergeSuggestions(['React', 'Vite'], ['react', 'vitest', 'zod', 'Zod'], ['Zod'], 3)).toEqual({
			local: ['React', 'Vite'],
			remote: ['vitest'],
		});
	});
});
