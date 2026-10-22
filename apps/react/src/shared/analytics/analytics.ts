// 트래픽 분석 수집 (#102). 페이지 열기, 앱 열기, 글·프로젝트 보기, 바깥 링크, 머문 시간을 모아 API로 보낸다.
// 쿠키를 쓰지 않는다: 같은 방문은 페이지를 열 때마다 새로 만드는 visitId로 묶고, 같은 사람은 서버가 하루 해시로 센다.
// 무엇을 모으는지는 docs/privacy.md. 서버 쪽은 apps/api/src/analytics.
import { env } from '@/shared/config/env';
import { api } from '@/shared/api/client';
import { isMobileViewport } from '@/desktop/layout';
import { getViewport } from '@/shared/hooks/useViewport';
import { cleanSearchTerm, cleanUtm, MAX_EVENTS, type AppViews, type TodayVisitors } from '@macfolio/contracts';

declare global {
	/** E2E 테스트가 수집을 켜고 끄는 자리 (로컬 주소에서는 기본으로 보내지 않는다) */
	var __MACFOLIO_ANALYTICS__: boolean | undefined;
}

export type AnalyticsEvent =
	| {
			type: 'visit';
			path: string;
			referrer?: string;
			searchTerm?: string;
			utmSource?: string;
			utmMedium?: string;
			utmCampaign?: string;
			utmTerm?: string;
			utmContent?: string;
			device: 'desktop' | 'mobile';
			language?: string;
	  }
	| { type: 'app'; app: string }
	| { type: 'item'; app: string; item: string }
	| { type: 'link'; item: string }
	| { type: 'leave'; duration: number };

/** 모아 두었다가 보내는 간격 */
export const FLUSH_MS = 5000;
/** 한 번에 보내는 수 (서버의 상한, contracts) */
const MAX_BATCH = MAX_EVENTS;
/** 사이트의 휴대폰 화면 기준과 같다 */

/** 보낼지: 서버가 있고, Global Privacy Control을 켜지 않았고, 로컬 주소가 아니다 (테스트는 따로 켠다) */
export function analyticsEnabled(
	location: Pick<Location, 'hostname'> = window.location,
	navigatorLike: { globalPrivacyControl?: boolean } = navigator as Navigator & { globalPrivacyControl?: boolean }
): boolean {
	if (!env.apiUrl || navigatorLike.globalPrivacyControl) return false;
	if (globalThis.__MACFOLIO_ANALYTICS__ !== undefined) return globalThis.__MACFOLIO_ANALYTICS__;
	return !/^(localhost|127\.0\.0\.1|\[::1\])$|\.local$/.test(location.hostname);
}

/** 들어온 곳의 호스트만 (경로·검색어는 버린다). 사이트 안에서 온 것과 직접 들어온 것은 undefined */
export function referrerHost(referrer: string, ownHost: string): string | undefined {
	if (!referrer) return undefined;
	try {
		const host = new URL(referrer).hostname.toLowerCase();
		return host && host !== ownHost.toLowerCase() ? host : undefined;
	} catch {
		return undefined;
	}
}

/** 검색엔진마다 결과 주소에서 검색어를 싣는 이름 */
const SEARCH_PARAMS: [RegExp, string][] = [
	[/(^|\.)naver\.com$/, 'query'],
	[/(^|\.)daum\.net$/, 'q'],
	[/(^|\.)google\.[a-z.]+$/, 'q'],
	[/(^|\.)bing\.com$/, 'q'],
	[/(^|\.)yahoo\.(com|co\.jp)$/, 'p'],
	[/(^|\.)duckduckgo\.com$/, 'q'],
	[/(^|\.)baidu\.com$/, 'wd'],
	[/(^|\.)yandex\.[a-z.]+$/, 'text'],
	[/(^|\.)ecosia\.org$/, 'q'],
];

/**
 * 검색엔진이 들어온 주소에 실어 보낸 검색어 (cleanSearchTerm으로 다듬는다). 검색엔진이 아니거나 싣지 않았으면 undefined.
 * 요즘 브라우저는 다른 사이트로 갈 때 주소의 호스트만 넘기고, 구글·빙은 늘 그렇다. 검색엔진이 전체 주소를 넘기도록 정한 경우에만 남는다
 */
export function searchTermOf(referrer: string): string | undefined {
	try {
		const url = new URL(referrer);
		const host = url.hostname.toLowerCase();
		const param = SEARCH_PARAMS.find(([pattern]) => pattern.test(host))?.[1];
		return param ? cleanSearchTerm(url.searchParams.get(param)) : undefined;
	} catch {
		return undefined;
	}
}

/**
 * 주소의 utm_source·utm_medium·utm_campaign·utm_term·utm_content.
 * 링크 생성기와 서버와 같은 규칙(cleanUtm: 소문자, 공백은 '-', 100자까지)으로 다듬는다
 */
export function utmOf(search: string) {
	const params = new URLSearchParams(search);
	const value = (name: string) => cleanUtm(params.get(name));
	return {
		utmSource: value('utm_source'),
		utmMedium: value('utm_medium'),
		utmCampaign: value('utm_campaign'),
		utmTerm: value('utm_term'),
		utmContent: value('utm_content'),
	};
}

/**
 * 주소에서 utm_*만 뺀 경로·쿼리·조각 (다른 쿼리는 쓴 그대로 둔다). 뺄 것이 없으면 null.
 * 읽은 뒤 주소창에서 지워, 주소를 복사해 나누거나 새로 고쳐도 같은 캠페인 방문이 다시 세지지 않게 한다 (#211)
 */
export function withoutUtm(href: string): string | null {
	const url = new URL(href);
	const parts = url.search.slice(1).split('&').filter(Boolean);
	const kept = parts.filter((part) => {
		const name = part.split('=')[0].replace(/\+/g, ' ');
		try {
			return !/^utm_/i.test(decodeURIComponent(name));
		} catch {
			return true;
		}
	});
	if (kept.length === parts.length) return null;
	return `${url.pathname}${kept.length ? `?${kept.join('&')}` : ''}${url.hash}`;
}

/**
 * 페이지를 연 이벤트의 들어온 곳: 바깥 호스트(사이트 안에서 온 것은 비운다 = '직접'), 검색엔진이 넘겨준 검색어, utm.
 * 사이트 안에서 온 것이어도 utm이 있으면 utm을 그대로 보낸다 (조합 표는 utm으로 센다)
 */
export function entryOf(href: string, referrer: string) {
	const url = new URL(href);
	const host = referrerHost(referrer, url.hostname);
	return { referrer: host, searchTerm: host ? searchTermOf(referrer) : undefined, ...utmOf(url.search) };
}

/** 바깥 링크를 남기는 이름: 호스트와 경로만 (검색어·조각은 버린다). 바깥 주소가 아니면 null */
export function linkLabel(url: string, ownOrigin: string): string | null {
	try {
		const parsed = new URL(url, ownOrigin);
		if (parsed.origin === ownOrigin || !/^https?:$/.test(parsed.protocol)) return null;
		return `${parsed.hostname}${parsed.pathname.replace(/\/$/, '')}`.slice(0, 200);
	} catch {
		return null;
	}
}

const queue: AnalyticsEvent[] = [];
let visitId: string | null = null;
let startedAt = 0;

/** 모은 것을 보낸다. sendBeacon은 페이지를 닫는 중에도 보내고 응답을 기다리지 않는다 */
export function flush() {
	if (!visitId) return;
	while (queue.length) {
		const body = JSON.stringify({ visitId, events: queue.splice(0, MAX_BATCH) });
		const url = `${env.apiUrl}/analytics/events`;
		// 글자를 그대로 넘기면 text/plain으로 간다: CORS 사전 요청이 없다
		if (!navigator.sendBeacon?.(url, body))
			void fetch(url, { method: 'POST', body, keepalive: true, credentials: 'include' }).catch(() => undefined);
	}
}

/** 이벤트 하나를 모은다 (수집을 시작하지 않았으면 버린다) */
export function track(event: AnalyticsEvent) {
	if (!visitId) return;
	queue.push(event);
	if (queue.length >= MAX_BATCH) flush();
}

/** 바깥 링크를 누른 것을 남긴다 */
export function trackLink(url: string) {
	const item = linkLabel(url, window.location.origin);
	if (item) track({ type: 'link', item });
}

/** 바깥 주소를 새 탭으로 열고 남긴다 */
export function openExternal(url: string, features = 'noopener,noreferrer') {
	trackLink(url);
	window.open(url, '_blank', features);
}

/**
 * 수집을 시작한다 (페이지마다 한 번). 페이지를 연 것을 남기고, 5초마다 보내고,
 * 탭이 숨으면 그때까지 머문 시간을 남기고 바로 보낸다
 */
export function startAnalytics() {
	if (visitId || !analyticsEnabled()) return;
	visitId = `v-${crypto.randomUUID()}`;
	startedAt = Date.now();
	track({
		type: 'visit',
		path: window.location.pathname.slice(0, 300),
		...entryOf(window.location.href, document.referrer),
		device: isMobileViewport(getViewport()) ? 'mobile' : 'desktop',
		language: navigator.language || undefined,
	});
	// 읽은 utm은 주소창에서 지운다 (메모 글 주소의 다른 쿼리와 조각은 그대로)
	const clean = withoutUtm(window.location.href);
	if (clean) window.history.replaceState(window.history.state, '', clean);
	window.setInterval(flush, FLUSH_MS);
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState !== 'hidden') return;
		track({ type: 'leave', duration: Math.min(Date.now() - startedAt, 24 * 60 * 60 * 1000) });
		flush();
	});
	// 이 사이트 밖으로 가는 <a> 링크 (글 안의 링크, 프로젝트 페이지의 버튼)
	document.addEventListener(
		'click',
		(event) => {
			const anchor = (event.target as Element | null)?.closest?.('a[href]');
			if (anchor) trackLink((anchor as HTMLAnchorElement).href);
		},
		true
	);
}

/** 오늘(한국 시간) 순방문자 수 (누구나 본다). 서버가 없거나 닿지 않으면 null */
export async function fetchTodayVisitors(): Promise<number | null> {
	try {
		const { visitors } = await api<Partial<TodayVisitors>>('/analytics/today', { timeout: 5000 });
		return typeof visitors === 'number' ? visitors : null;
	} catch {
		return null;
	}
}

/** 앱 항목(메모의 글, Safari의 프로젝트)마다 전체 기간 조회수 (누구나 본다). 서버가 없거나 닿지 않으면 null */
export async function fetchViews(app: string): Promise<Record<string, number> | null> {
	try {
		const { views } = await api<Partial<AppViews>>(`/analytics/views?app=${encodeURIComponent(app)}`, {
			timeout: 5000,
		});
		return views && typeof views === 'object' ? (views as Record<string, number>) : null;
	} catch {
		return null;
	}
}
