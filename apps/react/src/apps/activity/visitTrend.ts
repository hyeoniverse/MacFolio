// 메뉴 막대의 배터리 자리에 방문자에게 보이는 방문 추이. '활동 상태 보기'의 개요와 같은 GET /analytics/summary를 읽는다.
import { useEffect, useState } from 'react';
import { env } from '@/shared/config/env';
import { change, fetchSummary, kstToday, periodRange, type Summary } from './data';
import type { Battery } from './serverResources';

/** 서버는 방문자에게 1분 동안 같은 값을 준다. 메뉴 막대는 10분마다 다시 묻는다 */
const POLL_MS = 10 * 60_000;

export interface VisitTrend {
	/** 최근 7일 (오늘 포함, 한국 시간) 방문 */
	visits: number;
	/** 그 앞 7일 방문 */
	previous: number;
	/** 오늘 방문 */
	today: number;
	/** 앞 7일과 비교 (+12%, -5%). 앞 7일이 0이면 null */
	change: ReturnType<typeof change>;
}

export function trendOf(summary: Summary): VisitTrend {
	const visits = summary.totals.visits;
	const previous = summary.previous.visits;
	return {
		visits,
		previous,
		today: summary.days.find((day) => day.day === summary.to)?.visits ?? 0,
		change: change(visits, previous),
	};
}

/**
 * 배터리 모양: 방문이 얼마나 늘었는지. 앞 7일과 같으면 절반, +100% 이상이면 가득, 줄면 그만큼 빈다 (-100%면 5%).
 * 앞 7일이 0이면 이번에 방문이 있을 때 가득, 없으면 절반
 */
export function visitBattery(trend: VisitTrend | null): Battery {
	if (!trend) return { fill: 75, tone: null, summary: '불러오는 중' };
	const percent =
		trend.previous > 0 ? ((trend.visits - trend.previous) / trend.previous) * 100 : trend.visits > 0 ? 100 : 0;
	const fill = Math.round(Math.min(100, Math.max(5, 50 + percent / 2)));
	const compared = trend.change ? ` (앞 7일보다 ${trend.change.text})` : '';
	return { fill, tone: null, summary: `최근 7일 ${trend.visits.toLocaleString()}회${compared}` };
}

/** 서버 주소가 있으면 최근 7일 방문을 묻는다. 묻지 못하면 null (배터리는 평소 모양) */
export function useVisitTrend() {
	const enabled = Boolean(env.apiUrl);
	const [trend, setTrend] = useState<VisitTrend | null>(null);
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		if (!enabled) return;
		let alive = true;
		const ask = () => {
			const { from, to } = periodRange('7d', kstToday());
			return fetchSummary(from, to).then(
				(summary) => {
					if (!alive) return;
					setTrend(trendOf(summary));
					setFailed(false);
				},
				() => alive && setFailed(true)
			);
		};
		void ask();
		const timer = window.setInterval(() => void ask(), POLL_MS);
		return () => {
			alive = false;
			window.clearInterval(timer);
		};
	}, [enabled]);

	return { enabled, trend, failed };
}
