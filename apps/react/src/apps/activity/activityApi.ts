// '활동 상태 보기'가 읽는 분석 API (apps/api/src/analytics): 응답 모양과 요청. 화면에 맞게 바꾸는 순수 함수는 model.ts
import { ApiError, api } from '@/shared/api/client';

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

const get = <T>(path: string): Promise<T> =>
	api<T>(path, { timeout: 10_000 }).catch((error: unknown) => {
		throw new ActivityError(error instanceof ApiError ? error.status : 0);
	});

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
