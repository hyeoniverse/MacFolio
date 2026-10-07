import { useEffect, useState } from 'react';
import AppWindow from '@/desktop/window/Window';
import { useAppMenus } from '@/desktop/status-bar/appMenus';
import { signIn, useAdmin } from '@/shared/auth/adminStore';
import { env } from '@/shared/config/env';
import LineChart from './LineChart';
import StatTable from './StatTable';
import {
	ActivityError,
	change,
	eventLabel,
	fetchLive,
	fetchSummary,
	formatDuration,
	groupRows,
	kstToday,
	labelOf,
	PERIODS,
	periodRange,
	referrerGroup,
	type LiveVisit,
	type Period,
	type Summary,
	type Totals,
} from './data';
import '@/apps/activity/Activity.css';

const TABS = [
	{ id: 'overview', label: '개요' },
	{ id: 'referrers', label: '유입 경로' },
	{ id: 'content', label: '앱·글' },
	{ id: 'audience', label: '지역·기기' },
	{ id: 'live', label: '실시간' },
] as const;
type Tab = (typeof TABS)[number]['id'];

/** 실시간 목록을 다시 묻는 간격 */
const LIVE_POLL_MS = 10_000;

const time = (iso: string) =>
	new Date(iso).toLocaleTimeString('ko-KR', {
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hourCycle: 'h23',
	});

/** 개요의 숫자 칸: 값과 앞 기간 대비 변화 */
const Stat = ({
	label,
	value,
	current,
	previous,
	hint,
}: {
	label: string;
	value: string;
	current: number | null;
	previous: number | null;
	hint?: string;
}) => {
	const diff = change(current, previous);
	return (
		<div className="activity-stat" title={hint}>
			<span className="label">{label}</span>
			<strong>{value}</strong>
			{diff && (
				<span className={`change ${diff.direction}`}>
					{diff.direction === 'up' ? '▲' : diff.direction === 'down' ? '▼' : ''} {diff.text}
				</span>
			)}
		</div>
	);
};

const Overview = ({ summary }: { summary: Summary }) => {
	const { totals, previous }: { totals: Totals; previous: Totals } = summary;
	return (
		<>
			<div className="activity-stats">
				<Stat label="방문" value={totals.visits.toLocaleString()} current={totals.visits} previous={previous.visits} />
				<Stat
					label="순방문자"
					value={totals.visitors.toLocaleString()}
					current={totals.visitors}
					previous={previous.visitors}
					hint="날마다 센 순방문자의 합 (쿠키 없이 하루 단위로만 센다)"
				/>
				<Stat
					label="앱 열기"
					value={totals.appOpens.toLocaleString()}
					current={totals.appOpens}
					previous={previous.appOpens}
				/>
				<Stat
					label="평균 머문 시간"
					value={formatDuration(totals.avgDurationSec)}
					current={totals.avgDurationSec}
					previous={previous.avgDurationSec}
				/>
			</div>
			<LineChart days={summary.days} />
			<div className="activity-columns">
				<StatTable title="가장 많이 연 앱" rows={summary.breakdown.app} metric="app" valueLabel="열기" limit={5} />
				<StatTable title="가장 많이 들어온 곳" rows={summary.breakdown.referrer} metric="referrer" limit={5} />
			</div>
		</>
	);
};

const Live = ({ visits }: { visits: LiveVisit[] | null }) => {
	const [open, setOpen] = useState<string | null>(null);
	if (!visits) return <p className="activity-empty">불러오는 중…</p>;
	if (!visits.length) return <p className="activity-empty">최근 30분 동안 방문이 없습니다</p>;
	return (
		<section className="activity-live">
			<h3>최근 30분 · {visits.length}개 방문</h3>
			<ul>
				{visits.map((visit) => (
					<li key={visit.visitId} className={open === visit.visitId ? 'open' : undefined}>
						<button
							type="button"
							aria-expanded={open === visit.visitId}
							onClick={() => setOpen(open === visit.visitId ? null : visit.visitId)}
						>
							<span className="when">{time(visit.lastAt)}</span>
							<span>{visit.country ? labelOf('country', visit.country) : '나라 모름'}</span>
							<span>{visit.device ? labelOf('device', visit.device) : ''}</span>
							<span>{visit.browser ?? ''}</span>
							<span>{visit.referrer ?? '직접 들어옴'}</span>
							<span className="muted">
								{visit.ip ?? ''} · #{visit.visitor}
							</span>
							<span className="count">{visit.events.length}</span>
						</button>
						{open === visit.visitId && (
							<ol aria-label="방문 흐름">
								{visit.events.map((event, index) => (
									<li key={index}>
										<span className="when">{time(event.at)}</span> {eventLabel(event)}
									</li>
								))}
							</ol>
						)}
					</li>
				))}
			</ul>
		</section>
	);
};

/**
 * 활동 상태 보기 (#102): 관리자가 사이트의 방문을 본다. macOS의 활동 상태 보기처럼 위에 탭, 가운데 정렬되는 표, 작은 그래프.
 * 숫자는 분석 API(관리자만)에서 온다. 방문자가 열면 잠긴 화면만 보인다
 */
const Activity = () => {
	const admin = useAdmin().status === 'signed-in';
	const [tab, setTab] = useState<Tab>('overview');
	const [period, setPeriod] = useState<Period>('7d');
	const [summary, setSummary] = useState<Summary | null>(null);
	const [live, setLive] = useState<LiveVisit[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [reloads, setReloads] = useState(0);
	const reload = () => setReloads((count) => count + 1);

	useEffect(() => {
		if (!admin || !env.apiUrl) return;
		let alive = true;
		const { from, to } = periodRange(period, kstToday());
		fetchSummary(from, to)
			.then((next) => {
				if (!alive) return;
				setSummary(next);
				setError(null);
			})
			.catch((caught: unknown) => alive && setError(caught instanceof ActivityError ? caught.message : String(caught)));
		return () => {
			alive = false;
		};
	}, [admin, period, reloads]);

	useEffect(() => {
		if (!admin || !env.apiUrl || tab !== 'live') return;
		let alive = true;
		const load = () =>
			fetchLive()
				.then((next) => alive && setLive(next))
				.catch(
					(caught: unknown) => alive && setError(caught instanceof ActivityError ? caught.message : String(caught))
				);
		void load();
		const timer = window.setInterval(load, LIVE_POLL_MS);
		return () => {
			alive = false;
			window.clearInterval(timer);
		};
	}, [admin, tab, reloads]);

	useAppMenus('activity', [
		{
			title: '보기',
			items: [
				...TABS.map(({ id, label }) => ({ label, checked: tab === id, onSelect: () => setTab(id) })),
				'separator' as const,
				...PERIODS.map(({ id, label }) => ({
					label: `기간: ${label}`,
					checked: period === id,
					onSelect: () => setPeriod(id),
				})),
				'separator' as const,
				{ label: '새로 고침', icon: 'fa-solid fa-rotate-right', onSelect: reload },
			],
		},
	]);

	const body = () => {
		if (!env.apiUrl) return <p className="activity-empty">연결된 서버가 없습니다 (VITE_API_URL)</p>;
		if (!admin)
			return (
				<div className="activity-locked">
					<i className="fa-solid fa-lock" aria-hidden="true" />
					<h2>관리자만 볼 수 있습니다</h2>
					<p>사이트의 방문 통계는 관리자에게만 보입니다. 방문자에게는 Apple 메뉴의 오늘 방문자 수만 보입니다.</p>
					<button type="button" onClick={signIn}>
						관리자 로그인…
					</button>
				</div>
			);
		if (error) return <p className="activity-empty error">{error}</p>;
		if (tab === 'live') return <Live visits={live} />;
		if (!summary) return <p className="activity-empty">불러오는 중…</p>;
		const { breakdown } = summary;
		switch (tab) {
			case 'overview':
				return <Overview summary={summary} />;
			case 'referrers':
				return (
					<div className="activity-columns">
						<StatTable title="묶어 보기" rows={groupRows(breakdown.referrer, referrerGroup)} />
						<StatTable title="들어온 곳" rows={breakdown.referrer} metric="referrer" />
						<StatTable title="캠페인 (utm_campaign)" rows={breakdown.campaign} metric="campaign" />
						<StatTable title="출처 (utm_source)" rows={breakdown.source} metric="source" />
					</div>
				);
			case 'content':
				return (
					<div className="activity-columns">
						<StatTable title="앱" rows={breakdown.app} metric="app" valueLabel="열기" />
						<StatTable title="글·프로젝트" rows={breakdown.item} metric="item" valueLabel="보기" />
						<StatTable title="바깥 링크" rows={breakdown.link} metric="link" valueLabel="누름" />
					</div>
				);
			case 'audience':
				return (
					<div className="activity-columns">
						<StatTable title="나라" rows={breakdown.country} metric="country" />
						<StatTable title="기기" rows={breakdown.device} metric="device" />
						<StatTable title="브라우저" rows={breakdown.browser} metric="browser" />
						<StatTable title="OS" rows={breakdown.os} metric="os" />
						<StatTable title="언어" rows={breakdown.language} metric="language" />
					</div>
				);
		}
	};

	return (
		<AppWindow title="활동 상태 보기" appName="activity">
			<div className="activity">
				{admin && env.apiUrl && (
					<div className="activity-toolbar">
						<div className="activity-tabs" role="tablist" aria-label="보기">
							{TABS.map(({ id, label }) => (
								<button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
									{label}
								</button>
							))}
						</div>
						{tab !== 'live' && (
							<label className="activity-period">
								기간
								<select value={period} onChange={(event) => setPeriod(event.target.value as Period)}>
									{PERIODS.map(({ id, label }) => (
										<option key={id} value={id}>
											{label}
										</option>
									))}
								</select>
							</label>
						)}
					</div>
				)}
				<div className="activity-body" role={admin ? 'tabpanel' : undefined}>
					{body()}
				</div>
			</div>
		</AppWindow>
	);
};

export default Activity;
