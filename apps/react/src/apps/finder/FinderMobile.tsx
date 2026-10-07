import React, { useEffect, useRef, useState } from 'react';
import MobileNavigation from '@/desktop/window/MobileNavigation';
import Menu from '@/shared/ui/menu/Menu';
import { find, KIND_LABELS, recentItems, search, sortItems, type FinderItem, type SortKey } from './files';
import { DOC_SOURCES } from './docsBundle';
import { finderDocRequest } from './openDoc';
import DocView from './DocView';
import FinderIcon from './FinderIcon';
import '@/apps/finder/FinderMobile.css';

type Tab = 'recents' | 'browse';
type View = 'icons' | 'list';
/** 들어간 곳: 폴더, 또는 앱 안에서 읽는 문서 */
type Screen = { folder: string } | { doc: string };

const TAB_TITLES: Record<Tab, string> = { recents: '최근 항목', browse: '둘러보기' };

/** 둘러보기의 위치 아이콘 (iOS 파일의 iCloud Drive·나의 iPhone처럼 파란 선 아이콘) */
const LOCATION_ICONS: Record<string, string> = {
	docs: 'fa-regular fa-file-lines',
	projects: 'fa-regular fa-folder',
	blog: 'fa-regular fa-pen-to-square',
	apps: 'fa-solid fa-table-cells-large',
};

const formatDate = (date: string) => {
	const [y, m, d] = date.split('-').map(Number);
	return `${y}. ${m}. ${d}.`;
};

/** 이름 아래 한 줄: 폴더는 항목 수, 파일은 날짜(없으면 종류) */
const summary = (item: FinderItem) =>
	item.kind === 'folder'
		? `${item.children.length}개의 항목`
		: item.modified
			? formatDate(item.modified)
			: item.kind === 'project'
				? (item.period ?? KIND_LABELS.project)
				: KIND_LABELS[item.kind];

interface Props {
	locations: FinderItem[];
	/** 글·프로젝트·앱을 그 앱에서 연다 (Finder와 같다) */
	onOpenElsewhere: (item: FinderItem) => void;
	dark: boolean;
}

/**
 * 파일 (휴대폰): iOS 파일 앱처럼 아래 떠 있는 탭(최근 항목·둘러보기)으로 오가고, 폴더는 한 화면씩 들어간다.
 * 첫 화면은 뒤로 가기(홈)와 같은 줄의 큰 제목과 검색, 폴더 안은 가운데 작은 제목. ••• 에서 아이콘·목록 보기와 정렬을 고른다
 */
const FinderMobile: React.FC<Props> = ({ locations, onOpenElsewhere, dark }) => {
	const [tab, setTab] = useState<Tab>('recents');
	const [stack, setStack] = useState<Screen[]>([]);
	const [query, setQuery] = useState('');
	const [view, setView] = useState<View>('icons');
	const [sort, setSort] = useState<SortKey>('date');
	const [placesOpen, setPlacesOpen] = useState(true);
	const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
	const moreButton = useRef<HTMLButtonElement>(null);

	// 화면이 바뀐 방식: 들어가면 오른쪽에서, 돌아오면 왼쪽에서, 탭을 바꾸면 서서히 (처음에는 움직이지 않는다)
	const [motion, setMotion] = useState<'forward' | 'back' | 'fade' | null>(null);

	const screen = stack.at(-1);
	const push = (next: Screen) => {
		setMotion('forward');
		setStack((current) => [...current, next]);
		setQuery('');
	};
	const pop = () => {
		setMotion('back');
		setStack((current) => current.slice(0, -1));
	};
	const screenKey = screen ? ('doc' in screen ? `doc:${screen.doc}` : `folder:${screen.folder}`) : `tab:${tab}`;

	// 바깥에서 온 문서 열기 요청 (Apple 메뉴의 개인정보 처리 방침 등). 묶어 둔 문서만 연다
	useEffect(() => {
		const take = () => {
			const { path } = finderDocRequest.getState();
			if (!path) return;
			finderDocRequest.setState({ path: null });
			if (DOC_SOURCES[path] !== undefined) setStack((current) => [...current, { doc: path }]);
		};
		take();
		return finderDocRequest.subscribe(take);
	}, []);

	const open = (item: FinderItem) => {
		if (item.kind === 'folder') push({ folder: item.id });
		else if (item.kind === 'doc') push({ doc: item.path });
		else onOpenElsewhere(item);
	};

	const titleOf = (target: Screen | undefined): string =>
		!target
			? TAB_TITLES[tab]
			: 'doc' in target
				? target.doc.split('/').at(-1)!
				: (find(locations, target.folder)?.name ?? TAB_TITLES[tab]);
	const title = titleOf(screen);
	const searching = query.trim() !== '';
	const folder = screen && 'folder' in screen ? find(locations, screen.folder) : null;

	const switchTab = (next: Tab) => {
		setMotion('fade');
		setTab(next);
		setStack([]);
		setQuery('');
	};

	const navigation = screen ? (
		<MobileNavigation backLabel={titleOf(stack.at(-2))} onBack={pop} />
	) : (
		<MobileNavigation />
	);

	if (screen && 'doc' in screen)
		return (
			<div className="files-phone doc">
				{navigation}
				<h2 key={`title:${screenKey}`} className="files-phone-bar-title">
					{title}
				</h2>
				<div key={screenKey} className="files-phone-scroll" data-motion={motion ?? undefined}>
					<DocView path={screen.doc} dark={dark} onOpenDoc={(path) => push({ doc: path })} />
				</div>
			</div>
		);

	const items = searching
		? search(locations, query)
		: folder?.kind === 'folder'
			? sortItems(folder.children, sort)
			: tab === 'recents'
				? sort === 'date'
					? recentItems(locations)
					: sortItems(recentItems(locations), sort)
				: [];

	const grid = (
		<ul
			key={`${view}:${sort}`}
			className={`files-phone-items ${view}`}
			aria-label={searching ? `‘${query.trim()}’ 찾기` : title}
		>
			{items.map((item) => (
				<li key={item.id}>
					<button type="button" className="files-phone-item" onClick={() => open(item)}>
						<span className="files-phone-icon" aria-hidden="true">
							<FinderIcon item={item} />
						</span>
						<span className="files-phone-text">
							<span className="files-phone-name">{item.name}</span>
							<span className="files-phone-summary">{summary(item)}</span>
						</span>
						{view === 'list' && item.kind === 'folder' && (
							<i className="fa-solid fa-chevron-right files-phone-chevron" aria-hidden="true" />
						)}
					</button>
				</li>
			))}
		</ul>
	);

	return (
		<div className="files-phone">
			{navigation}
			{/* 오른쪽 위: 보기와 정렬 (iOS 파일의 •••) */}
			<button
				ref={moreButton}
				type="button"
				className="files-phone-more"
				aria-label="보기 옵션"
				aria-haspopup="menu"
				aria-expanded={menu !== null}
				onClick={(event) => {
					const rect = event.currentTarget.getBoundingClientRect();
					setMenu(menu ? null : { x: rect.right - 250, y: rect.bottom + 8 });
				}}
			>
				<i className="fa-solid fa-ellipsis" aria-hidden="true" />
			</button>
			{screen && (
				<h2 key={`title:${screenKey}`} className="files-phone-bar-title">
					{title}
				</h2>
			)}

			<div key={screenKey} className={`files-phone-scroll ${screen ? 'inside' : ''}`} data-motion={motion ?? undefined}>
				{/* 첫 화면의 큰 제목: 뒤로 가기와 같은 줄 (다른 앱과 같은 phone-title) */}
				{!screen && <h2 className="phone-title">{title}</h2>}
				<label className="files-phone-search">
					<i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
					<input
						type="search"
						placeholder="검색"
						aria-label="검색"
						value={query}
						onChange={(event) => setQuery(event.target.value)}
					/>
				</label>

				{searching || screen || tab === 'recents' ? (
					items.length > 0 ? (
						grid
					) : (
						<p className="files-phone-empty">
							{searching
								? '찾는 이름이 없습니다.'
								: folder?.kind === 'folder'
									? (folder.emptyNote ?? '비어 있음')
									: '최근 항목이 없습니다.'}
						</p>
					)
				) : (
					<section className="files-phone-section" aria-label="위치">
						<h3>
							<button type="button" aria-expanded={placesOpen} onClick={() => setPlacesOpen(!placesOpen)}>
								위치
								<i className={`fa-solid fa-chevron-${placesOpen ? 'down' : 'right'}`} aria-hidden="true" />
							</button>
						</h3>
						{placesOpen && (
							<ul className="files-phone-places">
								{locations.map((place) => (
									<li key={place.id}>
										<button type="button" onClick={() => open(place)}>
											<i className={LOCATION_ICONS[place.id]} aria-hidden="true" />
											<span>{place.name}</span>
											<i className="fa-solid fa-chevron-right files-phone-chevron" aria-hidden="true" />
										</button>
									</li>
								))}
							</ul>
						)}
					</section>
				)}
			</div>

			{/* 아래에 떠 있는 탭 (iOS 파일): 고른 탭은 회색 알약 위에 파랗게 */}
			<nav className="files-phone-tabs" aria-label="파일 탭">
				{(['recents', 'browse'] as const).map((key) => (
					<button key={key} type="button" aria-current={tab === key || undefined} onClick={() => switchTab(key)}>
						<i className={key === 'recents' ? 'fa-solid fa-clock' : 'fa-solid fa-folder'} aria-hidden="true" />
						{TAB_TITLES[key]}
					</button>
				))}
			</nav>

			{menu && (
				<Menu
					label="보기 옵션"
					className="touch"
					anchor={menu}
					trigger={moreButton}
					onClose={() => setMenu(null)}
					items={[
						{
							label: '아이콘',
							icon: 'fa-solid fa-table-cells-large',
							checked: view === 'icons',
							onSelect: () => setView('icons'),
						},
						{ label: '목록', icon: 'fa-solid fa-list', checked: view === 'list', onSelect: () => setView('list') },
						'separator',
						{ label: '이름', checked: sort === 'name', onSelect: () => setSort('name') },
						{ label: '종류', checked: sort === 'kind', onSelect: () => setSort('kind') },
						{ label: '날짜', hint: '최신 항목 순으로', checked: sort === 'date', onSelect: () => setSort('date') },
					]}
				/>
			)}
		</div>
	);
};

export default FinderMobile;
