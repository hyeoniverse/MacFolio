import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/config/env', () => ({ env: { apiUrl: 'https://api.example' } }));

const { analyticsEnabled, entryOf, linkLabel, referrerHost, searchTermOf, utmOf, withoutUtm } =
	await import('./analytics');
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

	it('utm 다섯 가지만 (100자까지, 소문자로, 공백은 -)', () => {
		expect(utmOf('?utm_source=resume&utm_campaign=kakao-2026&other=1')).toEqual({
			utmSource: 'resume',
			utmMedium: undefined,
			utmCampaign: 'kakao-2026',
			utmTerm: undefined,
			utmContent: undefined,
		});
		expect(utmOf('?utm_source=LinkedIn&utm_medium=Social&utm_term=Front+End&utm_content=top%20bar')).toMatchObject({
			utmSource: 'linkedin',
			utmMedium: 'social',
			utmTerm: 'front-end',
			utmContent: 'top-bar',
		});
		expect(utmOf(`?utm_source=${'x'.repeat(150)}`).utmSource).toHaveLength(100);
	});

	it('읽은 utm_*는 주소에서 뺀다. 다른 쿼리(쓴 그대로)와 조각은 둔다 (#211)', () => {
		const origin = 'https://macfolio.hyeoniverse.com';
		expect(withoutUtm(`${origin}/?utm_source=linkedin&utm_medium=social&utm_campaign=resume-2026`)).toBe('/');
		expect(withoutUtm(`${origin}/memo/branded-ids?q=a+b&utm_source=velog&tag=%ED%95%9C&UTM_Term=x#h2`)).toBe(
			'/memo/branded-ids?q=a+b&tag=%ED%95%9C#h2'
		);
		expect(withoutUtm(`${origin}/memo/branded-ids?q=1`)).toBeNull();
		expect(withoutUtm(`${origin}/`)).toBeNull();
	});

	it("사이트 안에서 온 referrer는 '직접'(비움)으로 두고, utm이 있으면 utm을 보낸다 (#211)", () => {
		const href = 'https://macfolio.hyeoniverse.com/?utm_source=linkedin&utm_medium=social&utm_campaign=resume-2026';
		expect(entryOf(href, 'https://macfolio.hyeoniverse.com/memo/a')).toEqual({
			referrer: undefined,
			searchTerm: undefined,
			utmSource: 'linkedin',
			utmMedium: 'social',
			utmCampaign: 'resume-2026',
			utmTerm: undefined,
			utmContent: undefined,
		});
		// 바깥에서 왔으면 호스트와 utm을 함께 보낸다 (집계는 utm 조합으로)
		expect(entryOf(href, 'https://www.linkedin.com/feed')).toMatchObject({
			referrer: 'www.linkedin.com',
			utmSource: 'linkedin',
		});
		expect(entryOf('https://macfolio.hyeoniverse.com/', 'https://macfolio.hyeoniverse.com/')).toMatchObject({
			referrer: undefined,
			utmSource: undefined,
		});
	});

	it('검색엔진이 주소에 검색어를 실어 보냈으면 그 검색어를 다듬어 보낸다', () => {
		expect(
			searchTermOf(
				'https://search.naver.com/search.naver?where=nexearch&query=MacFolio++%ED%8F%AC%ED%8A%B8%ED%8F%B4%EB%A6%AC%EC%98%A4'
			)
		).toBe('macfolio 포트폴리오');
		expect(searchTermOf('https://m.search.naver.com/search.naver?query=%EA%B9%80%EC%A0%95%ED%98%84')).toBe('김정현');
		expect(searchTermOf('https://search.daum.net/search?w=tot&q=macfolio')).toBe('macfolio');
		expect(searchTermOf('https://www.google.co.kr/search?q=macfolio')).toBe('macfolio');
		expect(searchTermOf('https://search.yahoo.co.jp/search?p=macfolio')).toBe('macfolio');
		// 요즘 브라우저가 넘기는 호스트만 있는 주소, 검색엔진이 아닌 곳, 비었거나 틀린 주소
		expect(searchTermOf('https://www.google.com/')).toBeUndefined();
		expect(searchTermOf('https://github.com/search?q=macfolio')).toBeUndefined();
		expect(searchTermOf('https://www.bing.com/search?q=+')).toBeUndefined();
		expect(searchTermOf('')).toBeUndefined();
		expect(searchTermOf('not a url')).toBeUndefined();
	});

	it('들어온 곳이 검색엔진이면 호스트와 함께 검색어를 보낸다 (사이트 안에서 온 것은 보내지 않는다)', () => {
		expect(
			entryOf('https://macfolio.hyeoniverse.com/', 'https://search.naver.com/search.naver?query=macfolio')
		).toMatchObject({
			referrer: 'search.naver.com',
			searchTerm: 'macfolio',
		});
		expect(entryOf('https://macfolio.hyeoniverse.com/', 'https://www.google.com/')).toMatchObject({
			referrer: 'www.google.com',
			searchTerm: undefined,
		});
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
