import { useEffect, useState } from 'react';
import AppWindow from '@/desktop/window/Window';
import { useAppMenus } from '@/desktop/status-bar/appMenus';
import { signIn, useAdmin } from '@/shared/auth/adminStore';
import { env } from '@/shared/config/env';
import { fetchViews } from '@/shared/analytics/analytics';
import { getPostRepository } from '@/apps/memo/repository';
import LineChart from './LineChart';
import StatTable from './StatTable';
import {
	ActivityError,
	change,
	eventLabel,
	fetchLive,
	fetchSummary,
	formatDuration,
	kstToday,
	labelOf,
	PERIODS,
	periodRange,
	type LiveVisit,
	type Row,
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
				{/* 방문자에게는 주소 대신 묶음 (검색·소셜·직접·링크) */}
				{summary.scope === 'admin' ? (
					<StatTable title="가장 많이 들어온 곳" rows={summary.breakdown.referrer} metric="referrer" limit={5} />
				) : (
					<StatTable title="들어온 곳" rows={summary.breakdown.referrerGroup} />
				)}
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

/** 관리자만 볼 수 있는 자리: 왜 비었는지와 로그인 단추 */
const AdminOnly = ({ what }: { what: string }) => (
	<div className="activity-locked">
		<i className="fa-solid fa-lock" aria-hidden="true" />
		<h2>관리자만 볼 수 있습니다</h2>
		<p>{what}</p>
		<button type="button" onClick={signIn}>
			관리자 로그인…
		</button>
	</div>
);

/**
 * 활동 상태 보기 (#102): 사이트의 방문을 본다. macOS의 활동 상태 보기처럼 위에 탭, 가운데 정렬되는 표, 작은 그래프.
 * 누구나 연다. 방문자에게는 서버가 공개용 숫자만 주고(scope: public), 들어온 곳의 주소·캠페인과 실시간은 관리자만 본다
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

	// 블로그 글마다 전체 기간 조회수와 그 글의 제목
	const [blogViews, setBlogViews] = useState<Row[] | null>(null);
	const [titles, setTitles] = useState<Record<string, string>>({});
	useEffect(() => {
		if (!env.apiUrl) return;
		let alive = true;
		void fetchViews('memo').then(
			(views) => alive && setBlogViews(views ? Object.entries(views).map(([key, value]) => ({ key, value })) : null)
		);
		void getPostRepository()
			.list()
			.then((posts) => alive && setTitles(Object.fromEntries(posts.map((post) => [post.slug, post.title]))))
			.catch(() => undefined);
		return () => {
			alive = false;
		};
	}, [reloads]);
	const postTitle = (slug: string) => titles[slug] ?? slug;
	const itemLabel = (key: string) =>
		key.startsWith('memo/') ? `메모 › ${postTitle(key.slice('memo/'.length))}` : labelOf('item', key);

	// 로그인하거나 로그아웃하면 다시 묻는다 (서버가 주는 표가 달라진다)
	useEffect(() => {
		if (!env.apiUrl) return;
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
		if (tab === 'live' && !admin)
			return <AdminOnly what="실시간 방문은 방문 흐름과 가린 IP가 있어서 관리자에게만 보입니다." />;
		if (error) return <p className="activity-empty error">{error}</p>;
		if (tab === 'live') return <Live visits={live} />;
		if (!summary) return <p className="activity-empty">불러오는 중…</p>;
		const { breakdown } = summary;
		switch (tab) {
			case 'overview':
				return <Overview summary={summary} />;
			case 'referrers':
				return (
					<>
						<div className="activity-columns">
							<StatTable title="묶어 보기" rows={breakdown.referrerGroup} />
							{summary.scope === 'admin' && <StatTable title="들어온 곳" rows={breakdown.referrer} metric="referrer" />}
						</div>
						{summary.scope === 'admin' ? (
							<div className="activity-columns">
								<StatTable title="캠페인 (utm_campaign)" rows={breakdown.campaign} metric="campaign" />
								<StatTable title="출처 (utm_source)" rows={breakdown.source} metric="source" />
							</div>
						) : (
							<AdminOnly what="들어온 곳의 주소와 캠페인(utm)은 관리자에게만 보입니다. 방문자에게는 검색·소셜·직접·링크 묶음만 보입니다." />
						)}
					</>
				);
			case 'content':
				return (
					<div className="activity-columns">
						<StatTable title="앱" rows={breakdown.app} metric="app" valueLabel="열기" />
						<StatTable
							title="블로그 글 조회수 (전체 기간)"
							rows={blogViews ?? []}
							labelFor={postTitle}
							valueLabel="조회"
							empty={blogViews ? '아직 없습니다' : '불러오는 중…'}
						/>
						<StatTable title="글·프로젝트 (이 기간)" rows={breakdown.item} labelFor={itemLabel} valueLabel="보기" />
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
				{env.apiUrl && (
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
				{/* 탭마다 새로 그린다: 같은 자리의 표가 앞 탭의 정렬을 물려받지 않게 */}
				<div key={tab} className="activity-body" role="tabpanel">
					{body()}
				</div>
			</div>
		</AppWindow>
	);
};

export default Activity;
