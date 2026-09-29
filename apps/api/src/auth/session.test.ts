import { describe, expect, it } from 'vitest';
import { hashToken, randomToken, safeEqual } from './session.js';

describe('session', () => {
	it('토큰은 매번 다르고 URL에 쓸 수 있다', () => {
		const a = randomToken();
		expect(a).not.toBe(randomToken());
		expect(a).toMatch(/^[\w-]{43}$/);
	});

	it('해시는 같은 토큰이면 같고, 토큰을 드러내지 않는다', () => {
		expect(hashToken('abc')).toBe(hashToken('abc'));
		expect(hashToken('abc')).toMatch(/^[0-9a-f]{64}$/);
		expect(hashToken('abc')).not.toContain('abc');
	});

	it('safeEqual: 같을 때만 true, 비었으면 false', () => {
		expect(safeEqual('state', 'state')).toBe(true);
		expect(safeEqual('state', 'stat3')).toBe(false);
		expect(safeEqual('state', 'longer-state')).toBe(false);
		expect(safeEqual(undefined, 'state')).toBe(false);
		expect(safeEqual('', '')).toBe(false);
	});
});
