// '활동 상태 보기' 검색어 탭 (관리자): Google Search Console의 검색어·페이지와, 검색엔진이 넘겨준 방문의 검색어
import { useEffect, useState } from 'react';
import Button from '@/shared/ui/button/Button';
import IconButton from '@/shared/ui/button/IconButton';
import { useAppState } from '@/desktop/useAppState';
import { parseAppPath, type AppLink } from '@/shared/lib/appLink';
import { requestOpen } from '@/shared/lib/openRequest';
import EmptyState from '@/shared/ui/empty-state/EmptyState';
import StatTable from './StatTable';
import { ActivityError, fetchSearch, syncSearch, type Row, type SearchKeywords } from './activityApi';
import { groupSearchRows, memoSlugOf, searchPageLabel, type SearchStat } from './model';

type SortKey = 'name' | 'clicks' | 'impressions' | 'position';

const COLUMNS: { key: Exclude<SortKey, 'name'>; label: string; hint: string }[] = [
	{ key: 'clicks', label: '클릭', hint: '검색 결과에서 눌러 들어온 수' },
	{ key: 'impressions', label: '노출', hint: '검색 결과에 보인 수' },
	{ key: 'position', label: '순위', hint: '노출마다의 평균 순위 (1이 맨 위)' },
];

/**
 * 검색어·페이지 표: 클릭·노출·평균 순위. 머리를 눌러 정렬한다 (순위는 작은 것부터).
 * onSelect가 있으면 이름을 눌러 줄 하나를 고른다 (다시 누르면 푼다).
 * onOpen이 줄의 열기 동작을 주면 이름 옆에 여는 버튼을 둔다
 */
const SearchTable = ({
	title,
	rows,
	labelFor = (key) => key,
	note,
	empty,
	onSelect,
	selected,
	onOpen,
}: {
	title: string;
	rows: SearchStat[];
	labelFor?: (key: string) => string;
	note?: string;
	empty: string;
	onSelect?: (key: string | null) => void;
	selected?: string | null;
	onOpen?: (key: string) => (() => void) | null;
}) => {
	const [sort, setSort] = useState<{ key: SortKey; descending: boolean }>({ key: 'impressions', descending: true });
	const named = rows.map((row) => ({ ...row, name: labelFor(row.key) }));
	const sorted = [...named].sort((a, b) => {
		const order = sort.key === 'name' ? a.name.localeCompare(b.name, 'ko') : a[sort.key] - b[sort.key];
		return sort.descending ? -order : order;
	});

	const header = (key: SortKey, label: string, hint?: string) => (
		<th
			scope="col"
			className={key === 'name' ? 'name' : 'value'}
			title={hint}
			aria-sort={sort.key === key ? (sort.descending ? 'descending' : 'ascending') : 'none'}
		>
			<button
				type="button"
				onClick={() =>
					setSort((current) =>
						current.key === key
							? { key, descending: !current.descending }
							: { key, descending: key === 'clicks' || key === 'impressions' }
					)
				}
			>
				{label}
				{sort.key === key && (
					<i className={`fa-solid fa-chevron-${sort.descending ? 'down' : 'up'}`} aria-hidden="true" />
				)}
			</button>
		</th>
	);

	return (
		<section className="activity-table search-table">
			<h3>{title}</h3>
			{note && <p className="activity-table-note">{note}</p>}
			{rows.length === 0 ? (
				<EmptyState className="activity-empty">{empty}</EmptyState>
			) : (
				<table aria-label={title}>
					<thead>
						<tr>
							{header('name', '이름')}
							{COLUMNS.map(({ key, label, hint }) => header(key, label, hint))}
						</tr>
					</thead>
					<tbody key={`${sort.key}-${sort.descending}`} className="motion-swap">
						{sorted.map((row) => {
							const open = onOpen?.(row.key);
							return (
								<tr key={row.key} className={selected === row.key ? 'selected' : undefined}>
									<td className="name" title={row.name}>
										<span className="search-name">
											{onSelect ? (
												<button
													type="button"
													aria-pressed={selected === row.key}
													onClick={() => onSelect(selected === row.key ? null : row.key)}
												>
													{row.name}
												</button>
											) : (
												row.name
											)}
											{open && (
												<IconButton
													className="search-open"
													icon="fa-solid fa-arrow-up-right-from-square"
													label={`${row.name} 열기`}
													onClick={open}
												/>
											)}
										</span>
									</td>
									<td className="value">{row.clicks.toLocaleString()}</td>
									<td className="value">{row.impressions.toLocaleString()}</td>
									<td className="value">{row.position.toFixed(1)}</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			)}
		</section>
	);
};

const dateLabel = (day: string) => {
	const [, month, date] = day.split('-');
	return `${Number(month)}월 ${Number(date)}일`;
};

const timeLabel = (iso: string) =>
	new Date(iso).toLocaleString('ko-KR', {
		month: 'long',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23',
		// 날짜와 같이 한국 시간으로 (서버의 날짜 기준)
		timeZone: 'Asia/Seoul',
	});

/**
 * 검색어 탭. 구글·빙은 검색어를 사이트에 넘기지 않아서 Search Console에서 가져온 것(서버가 6시간마다)을 보고,
 * 검색어를 넘겨주는 검색엔진으로 들어온 방문은 그 검색어를 따로 센다 (visitTerms, 요약의 searchTerm 표)
 */
const SearchKeywordsPanel = ({
	from,
	to,
	visitTerms,
	postTitle,
	reloads,
}: {
	from: string;
	to: string;
	visitTerms: Row[];
	postTitle: (slug: string) => string;
	reloads: number;
}) => {
	const [data, setData] = useState<SearchKeywords | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [syncing, setSyncing] = useState(false);
	const [page, setPage] = useState<string | null>(null);

	useEffect(() => {
		let alive = true;
		fetchSearch(from, to)
			.then((next) => {
				if (!alive) return;
				setData(next);
				setError(null);
			})
			.catch((caught: unknown) => alive && setError(caught instanceof ActivityError ? caught.message : String(caught)));
		return () => {
			alive = false;
		};
	}, [from, to, reloads]);

	const sync = () => {
		setSyncing(true);
		syncSearch(from, to)
			.then((next) => {
				setData(next);
				setError(null);
			})
			.catch((caught: unknown) => setError(caught instanceof ActivityError ? caught.message : String(caught)))
			.finally(() => setSyncing(false));
	};

	// 이 사이트의 글·프로젝트 페이지는 사이트 안의 그 앱에서 연다 (글 본문의 링크와 같은 길, openRequest).
	// Search Console의 주소는 배포 주소라, 지금 연 주소(개발 서버 등)와 출처가 달라도 경로로 판단한다
	const { openApp } = useAppState();
	const openPage = (url: string) => {
		let link: AppLink | null;
		try {
			link = parseAppPath(new URL(url).pathname);
		} catch {
			return null;
		}
		if (!link) return null;
		const { app, id } = link;
		return () => {
			openApp(app);
			requestOpen(app, id);
		};
	};

	const pageName = (url: string) => {
		const slug = memoSlugOf(url);
		return slug ? `메모 › ${postTitle(slug)}` : searchPageLabel(url);
	};

	const status = () => {
		if (!data) return '불러오는 중…';
		if (!data.configured) return '서버에 Search Console 서비스 계정이 없습니다.';
		const parts = [
			data.latestDay
				? `${dateLabel(data.latestDay)}까지의 자료 (Search Console은 2~3일 늦습니다)`
				: '아직 가져온 자료가 없습니다',
			data.syncedAt ? `${timeLabel(data.syncedAt)}에 가져옴` : '서버가 6시간마다 가져옵니다',
		];
		return parts.join(' · ');
	};

	return (
		<>
			<div className="search-console-bar">
				<p>
					<strong>Google Search Console</strong>
					<span>{status()}</span>
				</p>
				{data?.configured && (
					<Button icon="fa-solid fa-rotate-right" onClick={sync} disabled={syncing}>
						{syncing ? '가져오는 중…' : '지금 가져오기'}
					</Button>
				)}
			</div>
			{(error ?? data?.error) && <p className="search-console-error">{error ?? data?.error}</p>}
			{data && !data.configured ? (
				<EmptyState className="activity-empty">
					구글은 검색어를 사이트에 넘기지 않아 Search Console에서 가져옵니다. 서버에
					GSC_SITE_URL·GSC_CLIENT_EMAIL·GSC_PRIVATE_KEY를 넣으면 켜집니다 (docs/deployment.md).
				</EmptyState>
			) : (
				<div className="activity-columns">
					<SearchTable
						title={page ? `검색어 · ${pageName(page)}` : '검색어'}
						rows={groupSearchRows(data?.rows ?? [], 'query', page)}
						note="구글 검색 결과에 이 사이트가 나온 검색어. 드문 검색어는 Search Console이 빼고 줍니다."
						empty={data ? '이 기간에는 없습니다' : '불러오는 중…'}
					/>
					<SearchTable
						title="페이지"
						rows={groupSearchRows(data?.rows ?? [], 'page')}
						labelFor={pageName}
						note="이름을 누르면 검색어 표에 그 페이지로 들어온 검색어만 보입니다. 글·프로젝트는 ↗로 엽니다."
						empty={data ? '이 기간에는 없습니다' : '불러오는 중…'}
						onSelect={setPage}
						selected={page}
						onOpen={openPage}
					/>
				</div>
			)}
			<StatTable
				title="검색엔진이 넘겨준 검색어"
				rows={visitTerms}
				metric="searchTerm"
				note="네이버처럼 들어온 주소에 검색어를 실어 보내는 검색엔진으로 들어온 방문. 구글·빙은 넘기지 않아 여기에 없습니다."
			/>
		</>
	);
};

export default SearchKeywordsPanel;
