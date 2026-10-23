import { describe, expect, it } from 'vitest';
import {
	DEFAULT_MOBILE_WIDGETS,
	fillOptions,
	parseWidgets,
	upgradeMobileDefault,
	withOptions,
	type PageWidget,
	type PlacedWidget,
} from './catalog';
import { otherQuoteIndex, QUOTES, quoteOf } from './quotes';

const desktop: PlacedWidget[] = [
	{ id: 'photos', kind: 'photos', size: 'small', col: 0, row: 0, album: 'pictures' },
	{ id: 'posts', kind: 'posts', size: 'medium', col: 1, row: 0 },
];
const mobile: PageWidget[] = [
	{ id: 'photos', kind: 'photos', size: 'small' },
	{ id: 'posts', kind: 'posts', size: 'medium', posts: 'popular' },
	{ id: 'photos-2', kind: 'photos', size: 'small', album: 'qru' },
];

describe('바탕화면·휴대폰이 함께 쓰는 고른 값', () => {
	it('같은 위젯(같은 id·종류)에 고른 값을 적는다. 바뀐 것이 없으면 같은 배열', () => {
		const next = withOptions(mobile, 'photos', 'photos', { album: 'pictures' });
		expect(next[0]).toMatchObject({ album: 'pictures' });
		expect(next[2]).toMatchObject({ album: 'qru' });
		// 모든 앨범으로 되돌리기 (undefined)
		expect(withOptions(next, 'photos', 'photos', { album: undefined })[0].album).toBeUndefined();
		expect(withOptions(mobile, 'photos-2', 'photos', { album: 'qru' })).toBe(mobile);
		// id가 같아도 종류가 다르면 적지 않는다
		expect(withOptions(mobile, 'photos', 'posts', { posts: 'random' })).toBe(mobile);
	});

	it('고르지 않은 값은 다른 화면의 같은 위젯이 고른 값으로 (이미 고른 값은 그대로)', () => {
		const filled = fillOptions(mobile, desktop);
		expect(filled[0]).toMatchObject({ album: 'pictures' });
		expect(filled[1]).toMatchObject({ posts: 'popular' });
		expect(filled[2]).toMatchObject({ album: 'qru' });
		expect(fillOptions(desktop, mobile)[1]).toMatchObject({ posts: 'popular' });
	});
});

describe('명언 위젯', () => {
	it('날마다 다음 말로 넘어가고, 누른 만큼 더 넘긴다. 끝나면 처음으로', () => {
		const today = quoteOf('2026-10-22');
		const index = QUOTES.indexOf(today);
		expect(quoteOf('2026-10-23')).toBe(QUOTES[(index + 1) % QUOTES.length]);
		expect(quoteOf('2026-10-22', 1)).toBe(QUOTES[(index + 1) % QUOTES.length]);
		expect(quoteOf('2026-10-22', QUOTES.length)).toBe(today);
		expect(quoteOf('날짜 아님')).toBe(QUOTES[0]);
	});

	it('누르면 지금 말이 아닌 다른 말을 무작위로 고른다', () => {
		for (const random of [0, 0.3, 0.5, 0.999]) {
			const next = otherQuoteIndex(5, QUOTES.length, () => random);
			expect(next).not.toBe(5);
			expect(next).toBeGreaterThanOrEqual(0);
			expect(next).toBeLessThan(QUOTES.length);
		}
		// 무작위 값이 고르게 나오면 지금 말을 뺀 모든 말이 나온다
		const seen = new Set(Array.from({ length: 9 }, (_, i) => otherQuoteIndex(3, 10, () => i / 9)));
		expect([...seen].sort((a, b) => a - b)).toEqual([0, 1, 2, 4, 5, 6, 7, 8, 9]);
		expect(otherQuoteIndex(0, 1)).toBe(0);
	});

	it('말이 365개이고(한 해 동안 겹치지 않는다) 같은 말이 없으며, 작은 위젯에 들어갈 만큼 짧다', () => {
		// 하루에 하나씩, 한 해 동안 같은 말이 나오지 않는다
		expect(QUOTES).toHaveLength(365);
		expect(new Set(QUOTES.map((quote) => quote.text)).size).toBe(QUOTES.length);
		for (const quote of QUOTES) expect(quote.text.length, quote.text).toBeLessThanOrEqual(120);
	});

	it('말마다 원문·우리말·말한 사람이 있다', () => {
		for (const quote of QUOTES) {
			expect(quote.text.length).toBeGreaterThan(0);
			expect(quote.ko.length).toBeGreaterThan(0);
			expect(quote.author.length).toBeGreaterThan(0);
		}
	});

	it('저장한 명언 위젯을 불러온다', () => {
		expect(parseWidgets([{ id: 'quote', kind: 'quote', size: 'small', col: 0, row: 0 }])).toEqual([
			{ id: 'quote', kind: 'quote', size: 'small', col: 0, row: 0 },
		]);
	});
});

describe('휴대폰 처음 위젯', () => {
	const w = (id: string, size: 'small' | 'medium', extra: Partial<PageWidget> = {}): PageWidget => ({
		id,
		kind: id as PageWidget['kind'],
		size,
		...extra,
	});
	const ids = (pages: PageWidget[][]) => pages.map((page) => page.map((widget) => widget.id));

	it('1쪽에 소개·음악, 2쪽에 날씨·캘린더·GitHub 잔디', () => {
		expect(ids(DEFAULT_MOBILE_WIDGETS)).toEqual([
			['profile', 'music'],
			['weather', 'calendar', 'github'],
			['posts', 'photos', 'clock'],
		]);
	});

	it('예전 처음 구성 그대로 저장되어 있으면 지금 처음 구성으로 바꾸고, 고른 값은 같은 위젯에 옮긴다', () => {
		const saved = [
			[w('profile', 'medium'), w('github', 'medium')],
			[w('weather', 'small'), w('calendar', 'small'), w('music', 'medium')],
			[w('posts', 'medium', { posts: 'popular' }), w('photos', 'small', { album: 'qru' }), w('clock', 'small')],
		];
		const upgraded = upgradeMobileDefault(saved);
		expect(ids(upgraded)).toEqual(ids(DEFAULT_MOBILE_WIDGETS));
		expect(upgraded[2][0]).toMatchObject({ posts: 'popular' });
		expect(upgraded[2][1]).toMatchObject({ album: 'qru' });
		// 처음 편집을 만든 시각의 구성 (2쪽 메모, 3쪽 GitHub)도 바꾼다
		const older = [
			[w('profile', 'medium'), w('music', 'medium')],
			[w('weather', 'small'), w('calendar', 'small'), w('posts', 'medium')],
			[w('github', 'medium'), w('photos', 'small'), w('clock', 'small')],
		];
		expect(ids(upgradeMobileDefault(older))).toEqual(ids(DEFAULT_MOBILE_WIDGETS));
	});

	it('방문자가 바꾼 구성(빼거나 더하거나 크기가 다르면)은 그대로 둔다', () => {
		const removed = [
			[w('profile', 'medium'), w('github', 'medium')],
			[w('weather', 'small'), w('music', 'medium')],
			[],
		];
		expect(upgradeMobileDefault(removed)).toBe(removed);
		const resized = [
			[w('profile', 'medium'), w('github', 'small')],
			[w('weather', 'small'), w('calendar', 'small'), w('music', 'medium')],
			[w('posts', 'medium'), w('photos', 'small'), w('clock', 'small')],
		];
		expect(upgradeMobileDefault(resized)).toBe(resized);
	});
});
