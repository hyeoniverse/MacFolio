import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchRepoLanguages, forgetRepoLanguages, percentText, toRepoLanguages } from './languages';
import { languageColor, LANGUAGE_COLORS } from './repo';

afterEach(forgetRepoLanguages);

const QRU = 'https://github.com/hyeoniverse/QRU';
const API = 'https://api.example.com';
const ok = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));

describe('toRepoLanguages·percentText', () => {
	it('서버가 준 목록을 받고, 모양이 틀린 항목은 버린다. 비었으면 null', () => {
		expect(
			toRepoLanguages([
				{ name: 'TypeScript', bytes: 10, percent: 72.4, extra: 1 },
				{ name: '', bytes: 1, percent: 1 },
				{ name: 'CSS', bytes: '1', percent: 1 },
				null,
			])
		).toEqual([{ name: 'TypeScript', bytes: 10, percent: 72.4 }]);
		expect(toRepoLanguages([])).toBeNull();
		expect(toRepoLanguages({ TypeScript: 1 })).toBeNull();
	});

	it('비율은 GitHub처럼 소수 첫째 자리까지 쓴다', () => {
		expect(percentText(72.4)).toBe('72.4%');
		expect(percentText(100)).toBe('100.0%');
	});
});

describe('fetchRepoLanguages', () => {
	it('GitHub 저장소이고 API 주소가 있을 때만 사이트의 API에 묻고, 같은 저장소는 한 번만 묻는다', async () => {
		const fetchImpl = vi.fn(() => ok([{ name: 'TypeScript', bytes: 10, percent: 100 }]));
		expect(await fetchRepoLanguages('https://gitlab.com/a/b', API, fetchImpl)).toBeNull();
		expect(await fetchRepoLanguages(QRU, '', fetchImpl)).toBeNull();
		expect(fetchImpl).not.toHaveBeenCalled();

		expect(await fetchRepoLanguages(`${QRU}.git`, API, fetchImpl)).toHaveLength(1);
		await fetchRepoLanguages(QRU, API, fetchImpl);
		expect(fetchImpl).toHaveBeenCalledTimes(1);
		expect(fetchImpl).toHaveBeenCalledWith(`${API}/github/languages/hyeoniverse/QRU`);
	});

	it('404는 다시 묻지 않고, 서버나 GitHub에 닿지 못했으면(502·네트워크) 다음에 다시 묻는다', async () => {
		const missing = vi.fn(() => Promise.resolve(new Response('', { status: 404 })));
		expect(await fetchRepoLanguages(QRU, API, missing)).toBeNull();
		expect(await fetchRepoLanguages(QRU, API, missing)).toBeNull();
		expect(missing).toHaveBeenCalledTimes(1);
		forgetRepoLanguages();

		const down = vi.fn(() => Promise.resolve(new Response('', { status: 502 })));
		await fetchRepoLanguages(QRU, API, down);
		await fetchRepoLanguages(QRU, API, down);
		expect(down).toHaveBeenCalledTimes(2);

		const offline = vi.fn(() => Promise.reject(new TypeError('Failed to fetch')));
		expect(await fetchRepoLanguages('https://github.com/a/b', API, offline)).toBeNull();
		await fetchRepoLanguages('https://github.com/a/b', API, offline);
		expect(offline).toHaveBeenCalledTimes(2);
	});
});

describe('languageColor', () => {
	it('표에 있는 언어는 GitHub 색을 쓴다', () => {
		expect(languageColor('TypeScript')).toBe('#3178c6');
		expect(languageColor('Prisma')).toBe(LANGUAGE_COLORS.Prisma);
	});

	it('표에 없는 언어는 이름마다 늘 같은 채도 낮은 색이고, Other는 테마를 따르는 회색이다', () => {
		const color = languageColor('Zig Zag');
		expect(color).toMatch(/^hsl\(\d+ 12% 52%\)$/);
		expect(languageColor('Zig Zag')).toBe(color);
		expect(languageColor('Other')).toBe('var(--rp-lang-other)');
	});
});
