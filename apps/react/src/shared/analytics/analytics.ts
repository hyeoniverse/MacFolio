// 트래픽 분석 수집 (#102). 페이지 열기, 앱 열기, 글·프로젝트 보기, 바깥 링크, 머문 시간을 모아 API로 보낸다.
// 쿠키를 쓰지 않는다: 같은 방문은 페이지를 열 때마다 새로 만드는 visitId로 묶고, 같은 사람은 서버가 하루 해시로 센다.
// 무엇을 모으는지는 docs/privacy.md. 서버 쪽은 apps/api/src/analytics.
import { env } from '@/shared/config/env';

declare global {
	/** E2E 테스트가 수집을 켜고 끄는 자리 (로컬 주소에서는 기본으로 보내지 않는다) */
	var __MACFOLIO_ANALYTICS__: boolean | undefined;
}

export type AnalyticsEvent =
	| {
			type: 'visit';
			path: string;
			referrer?: string;
			utmSource?: string;
			utmMedium?: string;
			utmCampaign?: string;
			device: 'desktop' | 'mobile';
			language?: string;
	  }
	| { type: 'app'; app: string }
	| { type: 'item'; app: string; item: string }
	| { type: 'link'; item: string }
	| { type: 'leave'; duration: number };

/** 모아 두었다가 보내는 간격 */
export const FLUSH_MS = 5000;
/** 한 번에 보내는 수 (서버의 상한과 같다) */
const MAX_BATCH = 30;
/** 사이트의 휴대폰 화면 기준과 같다 */
const MOBILE_WIDTH = 768;

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

/** 주소의 utm_source·utm_medium·utm_campaign (100자까지) */
export function utmOf(search: string) {
	const params = new URLSearchParams(search);
	const value = (name: string) => params.get(name)?.slice(0, 100) || undefined;
	return { utmSource: value('utm_source'), utmMedium: value('utm_medium'), utmCampaign: value('utm_campaign') };
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
		referrer: referrerHost(document.referrer, window.location.hostname),
		...utmOf(window.location.search),
		device: window.innerWidth < MOBILE_WIDTH ? 'mobile' : 'desktop',
		language: navigator.language || undefined,
	});
	window.setInterval(flush, FLUSH_MS);
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState !== 'hidden') return;
		track({ type: 'leave', duration: Math.min(Date.now() - startedAt, 24 * 60 * 60 * 1000) });
		flush();
	});
	// 이 사이트 밖으로 가는 <a> 링크 (글 안의 링크, 프로젝트 페이지의 단추)
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
	if (!env.apiUrl) return null;
	try {
		const response = await fetch(`${env.apiUrl}/analytics/today`, { signal: AbortSignal.timeout(5000) });
		if (!response.ok) return null;
		const { visitors } = (await response.json()) as { visitors?: unknown };
		return typeof visitors === 'number' ? visitors : null;
	} catch {
		return null;
	}
}

/** 앱 항목(메모의 글, Safari의 프로젝트)마다 전체 기간 조회수 (누구나 본다). 서버가 없거나 닿지 않으면 null */
export async function fetchViews(app: string): Promise<Record<string, number> | null> {
	if (!env.apiUrl) return null;
	try {
		const response = await fetch(`${env.apiUrl}/analytics/views?app=${encodeURIComponent(app)}`, {
			signal: AbortSignal.timeout(5000),
		});
		if (!response.ok) return null;
		const { views } = (await response.json()) as { views?: unknown };
		return views && typeof views === 'object' ? (views as Record<string, number>) : null;
	} catch {
		return null;
	}
}
