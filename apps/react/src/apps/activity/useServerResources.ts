// 메뉴 막대의 배터리 자리에 보이는 서버 자원 (관리자만). '활동 상태 보기'의 서버 탭과 같은 GET /resources를 읽는다.
import { useCallback, useEffect, useState } from 'react';
import { createStore } from '@macfolio/desktop-core';
import { useAdmin } from '@/shared/auth/adminStore';
import { env } from '@/shared/config/env';
import { ActivityError, fetchResources, type ResourceStatus } from './activityApi';

/** 다른 곳(메뉴 막대의 배터리)에서 '활동 상태 보기'를 열 때 보일 탭. 앱이 읽고 비운다 */
export const requestedTab = createStore<{ tab: string | null }>({ tab: null });

/** 서버는 1분마다 재지만, 메뉴 막대는 5분마다 다시 묻는다 (메뉴를 열 때도) */
const POLL_MS = 5 * 60_000;

export interface Battery {
	/** 배터리가 찬 정도 (%) */
	fill: number;
	tone: 'danger' | 'warning' | null;
	/** 한 줄 요약 (단추 이름·툴팁) */
	summary: string;
}

const percent = (value: number) => `${Math.round(value * 10) / 10}%`;

/** 지금 사용률 한 줄: CPU 3.2% · 메모리 41% · 네트워크 0.6% (네트워크는 대역폭에 견준 비율) */
export function usageLine(status: ResourceStatus): string | null {
	const latest = status.latest;
	if (!latest) return null;
	const network = (latest.network / (status.networkMbps ?? 50)) * 100;
	return `CPU ${percent(latest.cpu)} · 메모리 ${percent(latest.memory)} · 네트워크 ${percent(network)}`;
}

export const RISK_LABEL = { danger: '위험', warning: '주의', safe: '안전', unknown: '모름' } as const;

/**
 * 배터리 모양: Always Free면 유휴 회수에서 얼마나 먼지 (안전 = 가득, 회수 위험 = 비어 있음).
 * 종량제·꺼짐·아직 모름은 평소 모양 그대로
 */
export function batteryOf(status: ResourceStatus | null): Battery {
	const plain = { fill: 75, tone: null };
	if (!status) return { ...plain, summary: '불러오는 중' };
	if (status.mode === 'off') return { ...plain, summary: '감시 꺼짐' };
	const usage = usageLine(status) ?? '아직 잰 값 없음';
	if (status.mode === 'payg' || !status.risk) return { ...plain, summary: usage };
	const summary = `${usage} · 유휴 회수 ${RISK_LABEL[status.risk.level]}`;
	switch (status.risk.level) {
		case 'danger':
			return { fill: 10, tone: 'danger', summary };
		case 'warning':
			return { fill: 25, tone: 'warning', summary };
		case 'safe':
			return { fill: 100, tone: null, summary };
		default:
			return { fill: 50, tone: null, summary };
	}
}

/** 관리자일 때만 서버 자원을 묻는다. 방문자이거나 서버 주소가 없으면 늘 null */
export function useServerResources() {
	const admin = useAdmin().status === 'signed-in';
	const [status, setStatus] = useState<ResourceStatus | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [asks, setAsks] = useState(0);
	const refresh = useCallback(() => setAsks((count) => count + 1), []);
	const enabled = admin && Boolean(env.apiUrl);

	useEffect(() => {
		if (!enabled) return;
		let alive = true;
		const ask = () =>
			fetchResources().then(
				(next) => {
					if (!alive) return;
					setStatus(next);
					setError(null);
				},
				(caught: unknown) => alive && setError(caught instanceof ActivityError ? caught.message : String(caught))
			);
		void ask();
		const timer = window.setInterval(() => void ask(), POLL_MS);
		return () => {
			alive = false;
			window.clearInterval(timer);
		};
	}, [enabled, asks]);

	// 로그아웃하면 남은 값은 보이지 않는다 (다시 로그인하면 새로 묻는다)
	return { enabled, status: enabled ? status : null, error: enabled ? error : null, refresh };
}
