import { useEffect, useState } from 'react';
import AppWindow from '@/desktop/window/Window';
import MobileNavigation from '@/desktop/window/MobileNavigation';
import { useAppMenus } from '@/desktop/status-bar/appMenus';
import { useAppWindowShown } from '@/desktop/useAppWindowShown';
import { usePolling } from '@/shared/hooks/usePolling';
import { signIn, useAdmin } from '@/shared/auth/adminStore';
import { env } from '@/shared/config/env';
import { fetchViews } from '@/shared/analytics/analytics';
import { getPostRepository } from '@/apps/memo/repository';
import LineChart from './LineChart';
import StatTable from './StatTable';
import Server from './Server';
import { UtmBuilder, UtmTables } from './Utm';
import SearchKeywordsPanel from './SearchKeywords';
import { requestedTab } from './useServerResources';
import {
	ActivityError,
	fetchLive,
	fetchSummary,
	fetchResources,
	type LiveVisit,
	type ResourceStatus,
	type Row,
	type Summary,
	type Totals,
} from './activityApi';
import {
	change,
	eventLabel,
	formatDuration,
	kstToday,
	labelOf,
	LIVE_RANGES,
	PERIODS,
	periodRange,
	visitsByIp,
	type LiveMinutes,
	type Period,
} from './model';
import '@/apps/activity/Activity.css';
import Button from '@/shared/ui/button/Button';
import IconButton from '@/shared/ui/button/IconButton';
import TabList from '@/shared/ui/tabs/TabList';
import EmptyState from '@/shared/ui/empty-state/EmptyState';

const TABS = [
	{ id: 'overview', label: '개요' },
	{ id: 'referrers', label: '유입 경로' },
	{ id: 'search', label: '검색어' },
	{ id: 'content', label: '앱·글' },
	{ id: 'audience', label: '지역·기기' },
	{ id: 'live', label: '실시간' },
	{ id: 'server', label: '서버' },
] as const;
type Tab = (typeof TABS)[number]['id'];

/** 실시간 목록을 다시 묻는 간격. 30분보다 길게 보면 드물게 */
const LIVE_POLL_MS = 10_000;
const LIVE_SLOW_POLL_MS = 60_000;
/** 요약·조회수를 다시 묻는 간격. 서버가 방문자에게 1분 동안 같은 값을 주므로 더 자주 물어도 값이 같다 */
const SUMMARY_POLL_MS = 60_000;
/** 서버 자원을 다시 묻는 간격. 서버가 1분마다 잰다 */
const SERVER_POLL_MS = 60_000;
/** 요약(/analytics/summary)을 쓰는 탭 */
const SUMMARY_TABS = new Set<Tab>(['overview', 'referrers', 'search', 'content', 'audience']);

const time = (iso: string) =>
	new Date(iso).toLocaleTimeString('ko-KR', {
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hourCycle: 'h23',
	});

/** 오늘이 아니면 날짜도 (24시간·7일을 볼 때) */
const when = (iso: string) => {
	const date = new Date(iso);
	if (date.toDateString() === new Date().toDateString()) return time(iso);
	return `${date.getMonth() + 1}/${date.getDate()} ${time(iso)}`;
};

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

/** 실시간: 가린 IP마다 방문 수(누르면 그 IP의 방문만)와 방문 목록(누르면 흐름) */
const Live = ({ visits, range }: { visits: LiveVisit[] | null; range: string }) => {
	const [open, setOpen] = useState<string | null>(null);
	const [ip, setIp] = useState<string | null>(null);
	if (!visits) return <EmptyState className="activity-empty">불러오는 중…</EmptyState>;
	if (!visits.length) return <EmptyState className="activity-empty">최근 {range} 동안 방문이 없습니다</EmptyState>;
	const shown = ip === null ? visits : visits.filter((visit) => (visit.ip ?? '') === ip);
	return (
		<>
			<StatTable
				title="IP"
				rows={visitsByIp(visits)}
				note="마지막 자리를 가린 IP마다 방문 수. 누르면 그 IP의 방문만 아래에 보입니다. 가린 IP는 7일 동안만 둡니다."
				onSelect={setIp}
				selected={ip}
			/>
			<section className="activity-live">
				<h3>
					{ip === null ? `최근 ${range}` : `${ip || '알 수 없음'}`} · {shown.length}개 방문
				</h3>
				<ul>
					{shown.map((visit) => (
						<li key={visit.visitId} className={open === visit.visitId ? 'open' : undefined}>
							<button
								type="button"
								aria-expanded={open === visit.visitId}
								onClick={() => setOpen(open === visit.visitId ? null : visit.visitId)}
							>
								<span className="when">{when(visit.lastAt)}</span>
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
											<span className="when">{when(event.at)}</span> {eventLabel(event)}
										</li>
									))}
								</ol>
							)}
						</li>
					))}
				</ul>
			</section>
		</>
	);
};

/**
 * 도구 막대 오른쪽: 마지막으로 갱신한 시각과 새로 고침 버튼. 값은 창이 보이는 동안 저절로 다시 묻는다.
 * 시각만 바뀌는 글자라 aria-live를 달지 않는다 (10초마다 읽히지 않게). 실패만 role="status"로 알린다
 */
const RefreshStatus = ({
	loading,
	updatedAt,
	failed,
	intervalMs,
	onRefresh,
}: {
	loading: boolean;
	updatedAt: number | null;
	failed: boolean;
	intervalMs: number;
	onRefresh: () => void;
}) => {
	const at = updatedAt === null ? null : time(new Date(updatedAt).toISOString());
	return (
		<div className="activity-refresh">
			{failed ? (
				<span className="activity-updated failed" role="status">
					갱신 실패{at && ` · ${at} 기준`}
				</span>
			) : (
				<span className="activity-updated" title={`창이 보이는 동안 ${intervalMs / 1000}초마다 저절로 갱신합니다`}>
					{at ? `${at} 갱신` : loading ? '불러오는 중…' : ''}
				</span>
			)}
			<IconButton
				label="새로 고침"
				icon={`fa-solid fa-rotate-right${loading ? ' fa-spin' : ''}`}
				className="activity-refresh-button"
				aria-busy={loading}
				onClick={onRefresh}
			/>
		</div>
	);
};

/** 관리자만 볼 수 있는 자리: 왜 비었는지와 로그인 버튼 */
const AdminOnly = ({ what }: { what: string }) => (
	<div className="activity-locked">
		<i className="fa-solid fa-lock" aria-hidden="true" />
		<h2>관리자만 볼 수 있습니다</h2>
		<p>{what}</p>
		<Button onClick={signIn}>관리자 로그인…</Button>
	</div>
);

/**
 * 활동 상태 보기 (#102): 사이트의 방문을 본다. macOS의 활동 상태 보기처럼 위에 탭, 가운데 정렬되는 표, 작은 그래프.
 * 누구나 연다. 방문자에게는 서버가 공개용 숫자만 주고(scope: public), 들어온 곳의 주소·캠페인과 실시간은 관리자만 본다
 */
const Activity = () => {
	const admin = useAdmin().status === 'signed-in';
	const shown = useAppWindowShown('activity');
	const online = shown && Boolean(env.apiUrl);
	const [tab, setTab] = useState<Tab>('overview');
	const [period, setPeriod] = useState<Period>('7d');
	const [summary, setSummary] = useState<Summary | null>(null);
	const [live, setLive] = useState<LiveVisit[] | null>(null);
	const [liveMinutes, setLiveMinutes] = useState<LiveMinutes>(30);
	const liveRange = LIVE_RANGES.find(({ minutes }) => minutes === liveMinutes)!;
	const [resources, setResources] = useState<ResourceStatus | null>(null);
	/** 표마다 마지막 조회의 실패 이유. 이미 보이는 값이 있으면 값을 그대로 두고 도구 막대에만 알린다 */
	const [errors, setErrors] = useState<Partial<Record<'summary' | 'live' | 'server', string>>>({});
	const setFailure = (source: 'summary' | 'live' | 'server', caught: unknown) =>
		setErrors((current) => ({
			...current,
			[source]: caught instanceof ActivityError ? caught.message : String(caught),
		}));
	const clearFailure = (source: 'summary' | 'live' | 'server') =>
		setErrors((current) => (current[source] ? { ...current, [source]: undefined } : current));
	// 수동 새로 고침 횟수: 글 제목과 검색어 탭은 자동으로 다시 묻지 않고 이것으로만 다시 묻는다
	const [reloads, setReloads] = useState(0);

	// 다른 곳(메뉴 막대의 배터리)에서 탭을 골라 열면 그 탭으로
	useEffect(() => {
		const take = ({ tab: requested }: { tab: string | null }) => {
			const match = TABS.find(({ id }) => id === requested);
			if (!match) return;
			setTab(match.id);
			requestedTab.setState({ tab: null });
		};
		take(requestedTab.getState());
		return requestedTab.subscribe(take);
	}, []);

	// 블로그 글의 제목 (조회수 표와 링크 생성기). 글이 바뀌는 일은 드물어 새로 고침할 때만 다시 읽는다
	const [titles, setTitles] = useState<Record<string, string>>({});
	useEffect(() => {
		if (!env.apiUrl) return;
		let alive = true;
		void getPostRepository()
			.list()
			.then((posts) => alive && setTitles(Object.fromEntries(posts.map((post) => [post.slug, post.title]))))
			.catch(() => undefined);
		return () => {
			alive = false;
		};
	}, [reloads]);
	const postTitle = (slug: string) => titles[slug] ?? slug;
	// 링크 생성기가 고르게 할 사이트 안 경로: 첫 화면, 앱, 블로그 글
	const sitePaths = [
		'/',
		'/memo',
		'/safari',
		...Object.keys(titles).map((slug) => `/memo/${encodeURIComponent(slug)}`),
	];
	const itemLabel = (key: string) =>
		key.startsWith('memo/') ? `메모 › ${postTitle(key.slice('memo/'.length))}` : labelOf('item', key);

	// 요약: 탭이 요약을 쓰는 동안 1분마다. 로그인하거나 로그아웃하면 다시 묻는다 (서버가 주는 표가 달라진다)
	const summaryPolling = usePolling(
		(isCurrent) => {
			const { from, to } = periodRange(period, kstToday());
			return fetchSummary(from, to).then(
				(next) => {
					if (!isCurrent()) return;
					setSummary(next);
					clearFailure('summary');
				},
				(caught: unknown) => {
					if (isCurrent()) setFailure('summary', caught);
					throw caught;
				}
			);
		},
		{ intervalMs: SUMMARY_POLL_MS, active: online && SUMMARY_TABS.has(tab), resetKey: `${admin}-${period}` }
	);

	// 블로그 글마다 전체 기간 조회수: 앱·글 탭을 보는 동안 1분마다
	const [blogViews, setBlogViews] = useState<Row[] | null>(null);
	const viewsPolling = usePolling(
		() =>
			fetchViews('memo').then((views) => {
				if (!views) throw new Error('views');
				setBlogViews(Object.entries(views).map(([key, value]) => ({ key, value })));
			}),
		{ intervalMs: SUMMARY_POLL_MS, active: online && tab === 'content' }
	);

	// 실시간 (관리자): 10초마다, 30분보다 길게 보면 1분마다
	const livePolling = usePolling(
		(isCurrent) =>
			fetchLive(liveMinutes).then(
				(next) => {
					if (!isCurrent()) return;
					setLive(next);
					clearFailure('live');
				},
				(caught: unknown) => {
					if (isCurrent()) setFailure('live', caught);
					throw caught;
				}
			),
		{
			intervalMs: liveMinutes > 30 ? LIVE_SLOW_POLL_MS : LIVE_POLL_MS,
			active: online && admin && tab === 'live',
			resetKey: String(liveMinutes),
		}
	);

	// 서버 탭 (관리자): 서버 자원 사용률과 유휴 회수 위험. 서버가 1분마다 재므로 1분마다
	const serverPolling = usePolling(
		() =>
			fetchResources().then(
				(next) => {
					setResources(next);
					clearFailure('server');
				},
				(caught: unknown) => {
					setFailure('server', caught);
					throw caught;
				}
			),
		{ intervalMs: SERVER_POLL_MS, active: online && admin && tab === 'server' }
	);

	/** 지금 탭의 값을 다시 묻는다 (보기 메뉴·도구 막대의 버튼·⌥R) */
	const reload = () => {
		setReloads((count) => count + 1);
		for (const polling of [summaryPolling, viewsPolling, livePolling, serverPolling]) polling.refresh();
	};
	/** 도구 막대에 보이는 갱신 상태: 지금 탭이 읽는 값 */
	const current = tab === 'live' ? livePolling : tab === 'server' ? serverPolling : summaryPolling;
	const currentError = errors[tab === 'live' ? 'live' : tab === 'server' ? 'server' : 'summary'];
	/** 방문자에게 잠긴 탭 (관리자만 볼 수 있다): 갱신할 값이 없다 */
	const locked = !admin && (tab === 'live' || tab === 'server' || tab === 'search');
	const hasData = tab === 'live' ? live !== null : tab === 'server' ? resources !== null : summary !== null;

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
				{
					label: '새로 고침',
					icon: 'fa-solid fa-rotate-right',
					shortcut: { code: 'KeyR', alt: true },
					onSelect: reload,
				},
			],
		},
	]);

	const body = () => {
		if (!env.apiUrl) return <EmptyState className="activity-empty">연결된 서버가 없습니다 (VITE_API_URL)</EmptyState>;
		if (tab === 'live' && !admin)
			return <AdminOnly what="실시간 방문은 방문 흐름과 가린 IP가 있어서 관리자에게만 보입니다." />;
		if (tab === 'server' && !admin)
			return <AdminOnly what="서버 자원 사용률과 Oracle 유휴 회수 위험은 관리자에게만 보입니다." />;
		if (tab === 'search' && !admin)
			return <AdminOnly what="검색어는 누가 무엇을 찾다 들어왔는지 드러날 수 있어 관리자에게만 보입니다." />;
		// 처음 불러오다 실패했을 때만 본문에 알린다. 이미 값이 있으면 그 값을 두고 도구 막대에 알린다
		if (currentError && !hasData) return <EmptyState className="activity-empty error">{currentError}</EmptyState>;
		if (tab === 'live') return <Live visits={live} range={liveRange.label} />;
		if (tab === 'server') return <Server status={resources} />;
		if (!summary) return <EmptyState className="activity-empty">불러오는 중…</EmptyState>;
		const { breakdown } = summary;
		switch (tab) {
			case 'overview':
				return <Overview summary={summary} />;
			case 'referrers':
				return (
					<>
						{/* 관리자: 캠페인 링크를 만드는 곳 (접혀 있다) */}
						{summary.scope === 'admin' && <UtmBuilder paths={sitePaths} />}
						<div className="activity-columns">
							<StatTable title="묶어 보기" rows={breakdown.referrerGroup} />
							{summary.scope === 'admin' && <StatTable title="들어온 곳" rows={breakdown.referrer} metric="referrer" />}
						</div>
						{summary.scope === 'admin' ? (
							<UtmTables summary={summary} />
						) : (
							<AdminOnly what="들어온 곳의 주소와 캠페인(utm)은 관리자에게만 보입니다. 방문자에게는 검색·소셜·직접·링크 묶음만 보입니다." />
						)}
					</>
				);
			case 'search':
				return (
					<SearchKeywordsPanel
						from={summary.from}
						to={summary.to}
						visitTerms={breakdown.searchTerm}
						postTitle={postTitle}
						reloads={reloads}
					/>
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
			{/* 휴대폰: iOS의 탭으로 나눈 앱처럼 첫 화면에 홈으로 가는 버튼이 없다 (홈 바로 나간다). 탭 줄이 폭을 다 쓴다 */}
			{/* 탭 줄이 위에 고정되어 내용이 그 밑으로 지나가지 않는다: 스크롤 가장자리 효과를 끈다 (탭이 흐려지지 않게) */}
			<MobileNavigation hideHome scrollEdge={false} />
			<div className="activity">
				{env.apiUrl && (
					<div className="activity-toolbar">
						<TabList className="activity-tabs" label="보기" items={TABS} value={tab} onChange={setTab} />
						<div className="activity-toolbar-end">
							{/* 기간이 오른쪽 끝에 오도록 갱신 상태를 먼저 */}
							{!locked && (
								<RefreshStatus
									loading={current.loading}
									updatedAt={current.updatedAt}
									failed={Boolean(currentError) && hasData}
									intervalMs={tab === 'live' ? (liveMinutes > 30 ? LIVE_SLOW_POLL_MS : LIVE_POLL_MS) : SUMMARY_POLL_MS}
									onRefresh={reload}
								/>
							)}
							{tab === 'live' && admin && (
								<label className="activity-period">
									기간
									<select
										value={liveMinutes}
										onChange={(event) => {
											// 앞 기간의 목록을 두지 않고 불러오는 중으로
											setLive(null);
											setLiveMinutes(Number(event.target.value) as LiveMinutes);
										}}
									>
										{LIVE_RANGES.map(({ minutes, label }) => (
											<option key={minutes} value={minutes}>
												{label}
											</option>
										))}
									</select>
								</label>
							)}
							{tab !== 'live' && tab !== 'server' && (
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
					</div>
				)}
				{/* 탭마다 새로 그린다: 같은 자리의 표가 앞 탭의 정렬을 물려받지 않게 */}
				<div key={`${tab}-${period}`} className="activity-body motion-swap" role="tabpanel">
					{body()}
				</div>
			</div>
		</AppWindow>
	);
};

export default Activity;
