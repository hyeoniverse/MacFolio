import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/config/env', () => ({ env: { apiUrl: 'https://api.example' } }));

const { analyticsEnabled, linkLabel, referrerHost, utmOf } = await import('./analytics');
const { newlyOpened } = await import('./usage');

describe('수집을 켜는 때', () => {
	afterEach(() => {
		globalThis.__MACFOLIO_ANALYTICS__ = undefined;
	});

	it('배포 주소에서 켜고, 로컬 주소와 Global Privacy Control에서는 끈다', () => {
		expect(analyticsEnabled({ hostname: 'macfolio.hyeoniverse.com' }, {})).toBe(true);
		expect(analyticsEnabled({ hostname: 'feat-x-macfolio.hyeoniverse.workers.dev' }, {})).toBe(true);
		expect(analyticsEnabled({ hostname: 'localhost' }, {})).toBe(false);
		expect(analyticsEnabled({ hostname: '127.0.0.1' }, {})).toBe(false);
		expect(analyticsEnabled({ hostname: 'macfolio.hyeoniverse.com' }, { globalPrivacyControl: true })).toBe(false);
	});

	it('테스트는 로컬에서도 켤 수 있지만, Global Privacy Control은 이긴다', () => {
		globalThis.__MACFOLIO_ANALYTICS__ = true;
		expect(analyticsEnabled({ hostname: 'localhost' }, {})).toBe(true);
		expect(analyticsEnabled({ hostname: 'localhost' }, { globalPrivacyControl: true })).toBe(false);
	});
});

describe('보내는 값 줄이기', () => {
	it('들어온 곳은 호스트만. 사이트 안과 직접 들어온 것은 없다', () => {
		expect(referrerHost('https://www.google.com/search?q=hyeoniverse', 'macfolio.hyeoniverse.com')).toBe(
			'www.google.com'
		);
		expect(referrerHost('https://GitHub.com/hyeoniverse', 'macfolio.hyeoniverse.com')).toBe('github.com');
		expect(referrerHost('https://macfolio.hyeoniverse.com/memo/a', 'macfolio.hyeoniverse.com')).toBeUndefined();
		expect(referrerHost('', 'macfolio.hyeoniverse.com')).toBeUndefined();
		expect(referrerHost('not a url', 'macfolio.hyeoniverse.com')).toBeUndefined();
	});

	it('utm 세 가지만 (100자까지)', () => {
		expect(utmOf('?utm_source=resume&utm_campaign=kakao-2026&other=1')).toEqual({
			utmSource: 'resume',
			utmMedium: undefined,
			utmCampaign: 'kakao-2026',
		});
		expect(utmOf(`?utm_source=${'x'.repeat(150)}`).utmSource).toHaveLength(100);
	});

	it('바깥 링크는 호스트와 경로만. 사이트 안 링크와 http가 아닌 주소는 남기지 않는다', () => {
		const origin = 'https://macfolio.hyeoniverse.com';
		expect(linkLabel('https://github.com/hyeoniverse/?tab=repositories#top', origin)).toBe('github.com/hyeoniverse');
		expect(linkLabel('/memo/hello', origin)).toBeNull();
		expect(linkLabel(`${origin}/safari/x`, origin)).toBeNull();
		expect(linkLabel('mailto:me@example.com', origin)).toBeNull();
	});

	it('새로 연 앱: 실행 중이 아니었다가 실행 중이 된 앱만', () => {
		const before = { memo: { isRunning: false }, safari: { isRunning: true }, music: { isRunning: false } };
		const now = { memo: { isRunning: true }, safari: { isRunning: true }, music: { isRunning: false } };
		expect(newlyOpened(before, now)).toEqual(['memo']);
		expect(newlyOpened(now, now)).toEqual([]);
	});
});
