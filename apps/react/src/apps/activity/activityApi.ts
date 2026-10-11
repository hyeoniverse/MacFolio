// '활동 상태 보기'가 읽는 분석 API (apps/api/src/analytics): 응답 모양과 요청. 화면에 맞게 바꾸는 순수 함수는 model.ts
import { ApiError, api } from '@/shared/api/client';
import type { Breakdown, LiveVisit, Summary, SummaryRow, Totals } from '@macfolio/contracts';

/** 응답 모양은 서버와 같은 스키마(contracts). 화면에서 쓰던 이름 그대로 다시 내보낸다 */
export type { Breakdown, LiveVisit, Summary, Totals };
export type Row = SummaryRow;

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
