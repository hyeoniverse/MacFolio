import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasCoarsePointer, mediaMatches, onMediaChange, prefersDarkScheme, prefersReducedMotion } from './media';

const fakeMatchMedia = (matching: string[]) => {
	const listeners = new Map<string, Set<() => void>>();
	const matchMedia = (query: string) => ({
		matches: matching.includes(query),
		addEventListener: (_: 'change', cb: () => void) =>
			void listeners.set(query, (listeners.get(query) ?? new Set()).add(cb)),
		removeEventListener: (_: 'change', cb: () => void) => void listeners.get(query)?.delete(cb),
	});
	return { matchMedia, fire: (query: string) => listeners.get(query)?.forEach((cb) => cb()), listeners };
};

describe('media', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('matchMedia가 없으면 모두 false', () => {
		vi.stubGlobal('window', {});
		expect(prefersReducedMotion()).toBe(false);
		expect(prefersDarkScheme()).toBe(false);
		expect(hasCoarsePointer()).toBe(false);
		expect(onMediaChange('(x)', () => {})).toBeTypeOf('function');
	});

	it('질문마다 지금 값을 돌려준다', () => {
		const fake = fakeMatchMedia(['(prefers-reduced-motion: reduce)', '(pointer: coarse)']);
		vi.stubGlobal('window', { matchMedia: fake.matchMedia });
		expect(prefersReducedMotion()).toBe(true);
		expect(prefersDarkScheme()).toBe(false);
		expect(hasCoarsePointer()).toBe(true);
		expect(mediaMatches('(min-width: 1px)')).toBe(false);
	});

	it('바뀌면 알리고, 돌려준 함수로 그만둔다', () => {
		const fake = fakeMatchMedia([]);
		vi.stubGlobal('window', { matchMedia: fake.matchMedia });
		const onChange = vi.fn();
		const off = onMediaChange('(prefers-color-scheme: dark)', onChange);
		fake.fire('(prefers-color-scheme: dark)');
		expect(onChange).toHaveBeenCalledTimes(1);
		off();
		fake.fire('(prefers-color-scheme: dark)');
		expect(onChange).toHaveBeenCalledTimes(1);
	});
});
