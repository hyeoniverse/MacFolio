import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BROWSER_DATA, clearBrowserData, readBrowserData } from './siteStorage';

const fakeStorage = () => {
	const map = new Map<string, string>();
	return {
		getItem: (key: string) => map.get(key) ?? null,
		setItem: (key: string, value: string) => void map.set(key, value),
		removeItem: (key: string) => void map.delete(key),
	};
};

describe('내 브라우저 데이터', () => {
	beforeEach(() => {
		vi.stubGlobal('window', { localStorage: fakeStorage(), sessionStorage: fakeStorage() });
	});
	afterEach(() => vi.unstubAllGlobals());

	it('남아 있는 것만 보여 주고, 지우면 사라진다', () => {
		expect(readBrowserData()).toEqual([]);
		window.localStorage.setItem('macfolio:memo:recent-finds', '["a","b","c"]');
		window.sessionStorage.setItem('macfolio:apps-before-leaving', '{}');
		const stored = readBrowserData();
		expect(stored.map((entry) => entry.item.id)).toEqual(['memo-finds', 'apps-before-leaving']);
		expect(stored[0].summary).toBe('검색어 3개');
		expect(stored[0].bytes).toBe(('macfolio:memo:recent-finds'.length + '["a","b","c"]'.length) * 2);

		clearBrowserData(stored[0].item);
		expect(readBrowserData().map((entry) => entry.item.id)).toEqual(['apps-before-leaving']);
	});
});

it('코드가 쓰는 macfolio: 저장 키를 모두 다룬다 (새 키를 쓰면 BROWSER_DATA에도 더한다)', () => {
	const src = fileURLToPath(new URL('../..', import.meta.url));
	const files: string[] = [];
	const walk = (dir: string) => {
		for (const name of readdirSync(dir)) {
			const path = join(dir, name);
			if (statSync(path).isDirectory()) {
				if (name !== 'content') walk(path);
			} else if (/\.tsx?$/.test(name) && !name.endsWith('.test.ts')) files.push(path);
		}
	};
	walk(src);
	const keys = new Set<string>();
	for (const file of files) {
		const text = readFileSync(file, 'utf8');
		if (!/localStorage|sessionStorage|STORAGE_KEY|_KEY =/.test(text)) continue;
		for (const match of text.matchAll(/'(macfolio:[a-z0-9:-]+)'/g)) keys.add(match[1]);
	}
	// postMessage 종류 이름이지 저장 키가 아니다
	keys.delete('macfolio:bar-color');
	const covered = new Set(BROWSER_DATA.flatMap((item) => item.keys));
	expect([...keys].filter((key) => !covered.has(key))).toEqual([]);
});
