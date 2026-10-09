// '활동 상태 보기'가 읽는 분석 API (apps/api/src/analytics)와, 화면에 맞게 바꾸는 순수 함수.
import { env } from '@/shared/config/env';
import { APP_MANIFEST, type AppName } from '@/apps/manifest';

export interface Totals {
	visits: number;
	visitors: number;
	appOpens: number;
	avgDurationSec: number | null;
}

export type Breakdown =
	| 'referrerGroup'
	| 'referrer'
	| 'source'
	| 'campaign'
	| 'app'
	| 'item'
	| 'link'
	| 'country'
	| 'device'
	| 'browser'
	| 'os'
	| 'language';

export interface Row {
	key: string;
	value: number;
}

export interface Summary {
	/** admin: 모든 표, public: 방문자에게 공개하는 표만 (들어온 곳의 호스트·utm은 빈 목록) */
	scope: 'admin' | 'public';
	from: string;
	to: string;
	days: { day: string; visits: number; visitors: number }[];
	totals: Totals;
	previous: Totals;
	breakdown: Record<Breakdown, Row[]>;
}

export interface LiveVisit {
	visitId: string;
	startedAt: string;
	lastAt: string;
	visitor: string;
	country: string | null;
	device: string | null;
	browser: string | null;
	os: string | null;
	referrer: string | null;
	path: string | null;
	ip: string | null;
	events: { type: string; app: string | null; item: string | null; at: string }[];
}

/** 서버 응답의 실패 (401이면 관리자 로그인이 풀렸다) */
export class ActivityError extends Error {
	constructor(readonly status: number) {
		super(status === 401 ? '관리자 로그인이 필요합니다.' : '분석 서버에 연결할 수 없습니다.');
	}
}

async function get<T>(path: string): Promise<T> {
	let response: Response;
	try {
		response = await fetch(`${env.apiUrl}${path}`, { credentials: 'include', signal: AbortSignal.timeout(10_000) });
	} catch {
		throw new ActivityError(0);
	}
	if (!response.ok) throw new ActivityError(response.status);
	return (await response.json()) as T;
}

export const fetchSummary = (from: string, to: string) => get<Summary>(`/analytics/summary?from=${from}&to=${to}`);
export const fetchLive = (minutes = 30) => get<LiveVisit[]>(`/analytics/live?minutes=${minutes}`);

/** 서버 자원 (관리자). 서버의 RESOURCE_MONITOR가 off면 mode만 온다 */
export interface ResourceStatus {
	mode: 'off' | 'free' | 'payg';
	shape?: string;
	networkMbps?: number;
	latest?: { at: string; cpu: number; memory: number; network: number } | null;
	series?: { at: string; cpu: number; memory: number; network: number }[];
	risk?: {
		level: 'danger' | 'warning' | 'safe' | 'unknown';
		conditions: {
			metric: 'cpu' | 'network' | 'memory';
			measure: string;
			value: number;
			threshold: number;
			below: boolean;
		}[];
		days: number;
	};
	alert?: { mailReady: boolean; lastSentAt: string | null };
	/** 종량제: 요금과 예산. configured가 false면 서버에 OCI API 키가 없다 */
	billing?: {
		configured: boolean;
		error: string | null;
		data: {
			monthToDate: number;
			currency: string | null;
			updatedAt: string;
			budgets: {
				displayName: string;
				amount: number;
				actualSpend: number | null;
				forecastedSpend: number | null;
				resetPeriod: string;
			}[];
		} | null;
	};
}

export const fetchResources = () => get<ResourceStatus>('/resources');

export const PERIODS = [
	{ id: 'today', label: '오늘', days: 1 },
	{ id: '7d', label: '7일', days: 7 },
	{ id: '30d', label: '30일', days: 30 },
	{ id: '90d', label: '90일', days: 90 },
] as const;
export type Period = (typeof PERIODS)[number]['id'];

/** 한국 시간의 오늘 (서버의 날짜와 같은 기준) */
export const kstToday = (now = new Date()) => new Date(now.getTime() + 9 * 3_600_000).toISOString().slice(0, 10);

/** 기간의 첫날과 끝날 (끝날은 오늘) */
export function periodRange(period: Period, today: string): { from: string; to: string } {
	const days = PERIODS.find((entry) => entry.id === period)!.days;
	const from = new Date(Date.parse(`${today}T00:00:00Z`) - (days - 1) * 86_400_000).toISOString().slice(0, 10);
	return { from, to: today };
}

/** 앞 기간과 비교: +12% ▲, -5% ▼. 앞 기간이 0이면 비교하지 않는다 */
export function change(
	current: number | null,
	previous: number | null
): { text: string; direction: 'up' | 'down' | 'same' } | null {
	if (current === null || previous === null || previous === 0) return null;
	const percent = Math.round(((current - previous) / previous) * 100);
	if (percent === 0) return { text: '0%', direction: 'same' };
	return { text: `${percent > 0 ? '+' : ''}${percent}%`, direction: percent > 0 ? 'up' : 'down' };
}

/** 2분 41초 */
export function formatDuration(seconds: number | null): string {
	if (seconds === null) return '–';
	const minutes = Math.floor(seconds / 60);
	return minutes ? `${minutes}분 ${seconds % 60}초` : `${seconds}초`;
}

const regionNames = typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames(['ko'], { type: 'region' }) : null;

/** 표에 보이는 이름 */
export function labelOf(metric: Breakdown, key: string): string {
	if (key === '') return metric === 'referrer' ? '직접 들어옴' : '알 수 없음';
	if (metric === 'country') {
		try {
			return `${regionNames?.of(key) ?? key} (${key})`;
		} catch {
			return key;
		}
	}
	if (metric === 'app') return APP_MANIFEST[key as AppName]?.label ?? key;
	if (metric === 'device') return key === 'mobile' ? '모바일' : key === 'desktop' ? '데스크톱' : key;
	if (metric === 'item') {
		const [app, ...rest] = key.split('/');
		return `${APP_MANIFEST[app as AppName]?.label ?? app} › ${rest.join('/')}`;
	}
	return key;
}

/** 실시간 흐름의 한 줄: "메모 열기", "메모 › hello 보기" */
export function eventLabel(event: LiveVisit['events'][number]): string {
	const app = event.app ? (APP_MANIFEST[event.app as AppName]?.label ?? event.app) : '';
	switch (event.type) {
		case 'visit':
			return '들어옴';
		case 'app':
			return `${app} 열기`;
		case 'item':
			return `${app} › ${event.item} 보기`;
		case 'link':
			return `${event.item} 누름`;
		default:
			return event.type;
	}
}
