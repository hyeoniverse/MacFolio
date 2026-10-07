import { describe, expect, it } from 'vitest';
import {
	aggregate,
	countryOf,
	dayHash,
	isBot,
	referrerGroup,
	kstDay,
	maskIp,
	MAX_EVENTS,
	parseBatch,
	parseUserAgent,
	shiftDay,
	type StoredEvent,
} from './rules.js';

const CHROME_MAC =
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const SAFARI_IPHONE =
	'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

describe('이벤트 묶음 검사', () => {
	const batch = { visitId: 'v-1a2b3c4d', events: [{ type: 'visit', referrer: 'GitHub.com', device: 'desktop' }] };

	it('sendBeacon의 text/plain(JSON 글자)과 JSON 객체를 모두 받는다. 호스트는 소문자로', () => {
		for (const input of [batch, JSON.stringify(batch)]) {
			const parsed = parseBatch(input);
			expect(parsed).toEqual({
				value: { visitId: 'v-1a2b3c4d', events: [expect.objectContaining({ type: 'visit', referrer: 'github.com' })] },
			});
		}
	});

	it('하나라도 틀리면 전부 거절한다', () => {
		const wrong = (events: unknown[], visitId = 'v-1a2b3c4d') => 'errors' in parseBatch({ visitId, events });
		expect('errors' in parseBatch('not json')).toBe(true);
		expect(wrong([{ type: 'visit' }], 'short')).toBe(true);
		expect(wrong([])).toBe(true);
		expect(wrong(Array.from({ length: MAX_EVENTS + 1 }, () => ({ type: 'visit' })))).toBe(true);
		expect(wrong([{ type: 'visit' }, { type: 'hack' }])).toBe(true);
		expect(wrong([{ type: 'app', app: 'Memo App' }])).toBe(true);
		// 들어온 곳은 호스트만: 경로·검색어를 받지 않는다
		expect(wrong([{ type: 'visit', referrer: 'https://google.com/search?q=me' }])).toBe(true);
		expect(wrong([{ type: 'visit', device: 'tablet' }])).toBe(true);
		expect(wrong([{ type: 'leave', duration: -1 }])).toBe(true);
		expect(wrong([{ type: 'leave', duration: 1.5 }])).toBe(true);
		expect(wrong([{ type: 'item', app: 'memo', item: 'x'.repeat(201) }])).toBe(true);
	});
});

describe('요청에서 줄여 남기는 값', () => {
	it('User-Agent는 브라우저·OS 종류로', () => {
		expect(parseUserAgent(CHROME_MAC)).toEqual({ browser: 'Chrome', os: 'macOS' });
		expect(parseUserAgent(SAFARI_IPHONE)).toEqual({ browser: 'Safari', os: 'iOS' });
		expect(parseUserAgent(`${CHROME_MAC} Edg/140.0`)).toEqual({ browser: 'Edge', os: 'macOS' });
		expect(parseUserAgent('Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0')).toEqual({
			browser: 'Firefox',
			os: 'Linux',
		});
		expect(parseUserAgent('something')).toEqual({ browser: '기타', os: '기타' });
	});

	it('로봇과 도구, 빈 User-Agent는 세지 않는다', () => {
		expect(isBot(CHROME_MAC)).toBe(false);
		expect(isBot('Mozilla/5.0 (compatible; Googlebot/2.1)')).toBe(true);
		expect(isBot(`${CHROME_MAC} HeadlessChrome`)).toBe(true);
		expect(isBot('curl/8.7.1')).toBe(true);
		expect(isBot(undefined)).toBe(true);
	});

	it('IP는 마지막 자리를 가린다', () => {
		expect(maskIp('203.0.113.42')).toBe('203.0.113.x');
		expect(maskIp('::ffff:203.0.113.42')).toBe('203.0.113.x');
		expect(maskIp('2001:db8:1:2:3:4:5:6')).toBe('2001:db8:1::');
		expect(maskIp('')).toBeNull();
	});

	it('나라는 두 글자만. 모름(XX)과 Tor(T1)는 버린다', () => {
		expect(countryOf('KR')).toBe('KR');
		expect(countryOf(['US'])).toBe('US');
		expect(countryOf('XX')).toBeNull();
		expect(countryOf('T1')).toBeNull();
		expect(countryOf('korea')).toBeNull();
		expect(countryOf(undefined)).toBeNull();
	});

	it('하루 해시: 같은 날 같은 사람이면 같고, 날이 바뀌거나 키가 다르면 다르다', () => {
		const a = dayHash('2026-10-07', '203.0.113.42', CHROME_MAC, 'secret');
		expect(dayHash('2026-10-07', '203.0.113.42', CHROME_MAC, 'secret')).toBe(a);
		expect(dayHash('2026-10-08', '203.0.113.42', CHROME_MAC, 'secret')).not.toBe(a);
		expect(dayHash('2026-10-07', '203.0.113.43', CHROME_MAC, 'secret')).not.toBe(a);
		expect(dayHash('2026-10-07', '203.0.113.42', CHROME_MAC, 'other')).not.toBe(a);
		expect(a).not.toContain('203.0.113');
	});

	it('날짜는 한국 시간', () => {
		expect(kstDay(new Date('2026-10-06T14:59:59Z'))).toBe('2026-10-06');
		expect(kstDay(new Date('2026-10-06T15:00:00Z'))).toBe('2026-10-07');
		expect(shiftDay('2026-10-01', -1)).toBe('2026-09-30');
		expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01');
	});
});

describe('하루치 집계', () => {
	const event = (fields: Partial<StoredEvent>): StoredEvent => ({
		type: 'visit',
		visitId: 'v1',
		dayHash: 'a',
		...fields,
	});

	it('방문은 들어온 곳·나라·기기별로, 앱·글·링크는 이벤트별로, 순방문자는 하루 해시로 센다', () => {
		const rows = aggregate([
			event({
				referrer: 'github.com',
				country: 'KR',
				device: 'desktop',
				browser: 'Chrome',
				os: 'macOS',
				language: 'ko',
			}),
			event({ type: 'app', app: 'memo' }),
			event({ type: 'item', app: 'memo', item: 'hello' }),
			event({ type: 'link', item: 'github.com/hyeoniverse' }),
			event({ type: 'leave', duration: 30_000 }),
			event({ type: 'leave', duration: 90_000 }),
			// 같은 사람의 두 번째 방문 (직접 들어옴, utm)
			event({ visitId: 'v2', utmSource: 'resume', utmCampaign: 'kakao-2026' }),
			// 다른 사람
			event({ visitId: 'v3', dayHash: 'b', referrer: 'github.com' }),
			event({ visitId: 'v3', dayHash: 'b', type: 'app', app: 'safari' }),
			event({ visitId: 'v3', dayHash: 'b', type: 'leave', duration: 10_000 }),
		]);
		const value = (metric: string, key = '') => rows.find((row) => row.metric === metric && row.key === key)?.value;
		expect(value('visits')).toBe(3);
		expect(value('visitors')).toBe(2);
		expect(value('appOpens')).toBe(2);
		expect(value('app', 'memo')).toBe(1);
		expect(value('item', 'memo/hello')).toBe(1);
		expect(value('link', 'github.com/hyeoniverse')).toBe(1);
		expect(value('referrer', 'github.com')).toBe(2);
		expect(value('referrer', '')).toBe(1);
		expect(value('source', 'resume')).toBe(1);
		expect(value('campaign', 'kakao-2026')).toBe(1);
		expect(value('country', 'KR')).toBe(1);
		// 머문 시간은 방문마다 가장 긴 값: 90초 + 10초
		expect(value('durationSec')).toBe(100);
		expect(value('durationVisits')).toBe(2);
	});

	it('글 보기는 방문마다 한 번 (같은 방문에서 같은 글을 다시 열어도 조회수 1)', () => {
		const rows = aggregate([
			event({ type: 'item', app: 'memo', item: 'hello' }),
			event({ type: 'item', app: 'memo', item: 'hello' }),
			event({ type: 'item', app: 'memo', item: 'other' }),
			event({ visitId: 'v2', type: 'item', app: 'memo', item: 'hello' }),
		]);
		expect(rows.filter((row) => row.metric === 'item')).toEqual([
			{ metric: 'item', key: 'memo/hello', value: 2 },
			{ metric: 'item', key: 'memo/other', value: 1 },
		]);
	});

	it('들어온 곳 묶음: 검색, 소셜, 직접, 링크', () => {
		expect(referrerGroup('www.google.com')).toBe('검색');
		expect(referrerGroup('search.naver.com')).toBe('검색');
		expect(referrerGroup('www.linkedin.com')).toBe('소셜');
		expect(referrerGroup('t.co')).toBe('소셜');
		expect(referrerGroup('')).toBe('직접');
		expect(referrerGroup('github.com')).toBe('링크');
	});

	it('이벤트가 없는 날도 visits 0을 남긴다 (모았다는 표시)', () => {
		expect(aggregate([])).toEqual([{ metric: 'visits', key: '', value: 0 }]);
	});
});
