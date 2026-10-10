import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readJson, readString, removeKey, storageOf, takeJson, writeJson, writeString } from './storage';

const fakeStorage = () => {
	const map = new Map<string, string>();
	return {
		getItem: (key: string) => map.get(key) ?? null,
		setItem: (key: string, value: string) => void map.set(key, value),
		removeItem: (key: string) => void map.delete(key),
	};
};

describe('storage', () => {
	beforeEach(() => {
		vi.stubGlobal('localStorage', fakeStorage());
		vi.stubGlobal('sessionStorage', fakeStorage());
	});
	afterEach(() => vi.unstubAllGlobals());

	it('JSON으로 쓰고 읽는다. 없으면 null', () => {
		expect(readJson('k')).toBeNull();
		expect(writeJson('k', { a: 1 })).toBe(true);
		expect(readJson('k')).toEqual({ a: 1 });
		expect(readString('k')).toBe('{"a":1}');
	});

	it('JSON이 아니면 null', () => {
		writeString('k', 'not json');
		expect(readJson('k')).toBeNull();
		expect(readString('k')).toBe('not json');
	});

	it('local과 session을 가른다', () => {
		writeString('k', 'a', 'local');
		writeString('k', 'b', 'session');
		expect(readString('k', 'local')).toBe('a');
		expect(readString('k', 'session')).toBe('b');
	});

	it('takeJson은 읽고 지운다', () => {
		writeJson('k', [1], 'session');
		expect(takeJson('k', 'session')).toEqual([1]);
		expect(readJson('k', 'session')).toBeNull();
	});

	it('저장소가 던지면 조용히 실패한다', () => {
		const broken = {
			getItem: () => {
				throw new Error('blocked');
			},
			setItem: () => {
				throw new Error('full');
			},
			removeItem: () => {
				throw new Error('blocked');
			},
		};
		vi.stubGlobal('localStorage', broken);
		expect(readJson('k')).toBeNull();
		expect(writeJson('k', 1)).toBe(false);
		expect(() => removeKey('k')).not.toThrow();
	});

	it('저장소 접근 자체가 막히면 null', () => {
		Object.defineProperty(globalThis, 'localStorage', {
			configurable: true,
			get() {
				throw new DOMException('denied', 'SecurityError');
			},
		});
		expect(storageOf('local')).toBeNull();
		expect(readString('k')).toBeNull();
		expect(writeString('k', 'v')).toBe(false);
	});
});
