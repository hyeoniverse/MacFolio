import React, { useEffect, useMemo, useRef, useState } from 'react';
import AppWindow from '@/desktop/window/Window';
import { useAppState } from '@/desktop/AppStateContext';
import { useAppMenus } from '@/desktop/status-bar/appMenus';
import { useLaunchApp } from '@/desktop/useLaunchApp';
import { APP_MANIFEST } from '@/apps/manifest';
import { WINDOW_APPS } from '@/apps/registry';
import { getPostRepository } from '@/apps/memo/repository';
import { PROJECTS } from '@/shared/profile';
import { requestOpen } from '@/shared/lib/openRequest';
import { useSettings } from '@/shared/settings/settingsStore';
import { resolveTheme } from '@/shared/settings/settings';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import IconButton from '@/shared/ui/button/IconButton';
import MobileNavigation from '@/desktop/window/MobileNavigation';
import {
	buildLocations,
	countLabel,
	find,
	KIND_LABELS,
	pathTo,
	search,
	type FinderItem,
	type FolderItem,
} from './files';
import { DOC_PATHS, DOC_SOURCES } from './docsBundle';
import { docTitle } from './repoDocs';
import { finderDocRequest } from './openDoc';
import DocView from './DocView';
import FinderIcon from './FinderIcon';
import '@/apps/finder/Finder.css';

type View = 'icons' | 'list';

/** 지나온 곳 하나: 폴더, 또는 Finder 안에서 읽는 문서 */
type Place = { folder: string } | { doc: string };

const LOCATION_ICONS: Record<string, string> = {
	docs: 'fa-regular fa-file-lines',
	projects: 'fa-regular fa-folder',
	blog: 'fa-regular fa-pen-to-square',
	apps: 'fa-solid fa-table-cells-large',
};

const formatDate = (date?: string) => {
	if (!date) return '—';
	const [y, m, d] = date.split('-').map(Number);
	return `${y}. ${m}. ${d}.`;
};

/** 목록 보기 '수정일' 칸: 글·폴더는 날짜, 프로젝트는 진행 기간 */
const dateCell = (item: FinderItem) => (item.kind === 'project' ? (item.period ?? '—') : formatDate(item.modified));

/**
 * Finder: 사이트에 있는 것들을 파일처럼 둘러본다 (이슈 #20).
 * 왼쪽 즐겨찾기(문서, 프로젝트, 블로그, 응용 프로그램), 아이콘·목록 보기, 이름 찾기, 뒤로·앞으로.
 * 한 번 누르면 고르고, 두 번 누르거나 Enter를 누르면 연다. 문서는 Finder 안에서 읽고,
 * 프로젝트는 Safari, 글은 메모, 앱은 그 앱을 연다.
 */
const Finder: React.FC = () => {
	const { openApp, bringAppToFront } = useAppState();
	const { launch } = useLaunchApp();
	const { theme } = useSettings();
	const dark = resolveTheme(theme, window.matchMedia('(prefers-color-scheme: dark)').matches) === 'dark';
	// 휴대폰에서는 홈 화면 이름처럼 '파일' (manifest.ts의 mobile)
	const appTitle = useIsMobile() ? APP_MANIFEST.finder.mobile!.label : APP_MANIFEST.finder.label;

	const [posts, setPosts] = useState<{ slug: string; title: string; date: string; category: string }[]>([]);
	useEffect(() => {
		let alive = true;
		getPostRepository()
			.list()
			.then((list) => alive && setPosts(list))
			.catch(() => undefined);
		return () => {
			alive = false;
		};
	}, []);

	const locations = useMemo(
		() =>
			buildLocations({
				docs: DOC_PATHS,
				posts,
				projects: PROJECTS.map(({ id, name, icon, period }) => ({ id, name, icon, period })),
				apps: WINDOW_APPS.filter(({ name }) => name !== 'finder').map(({ name }) => ({
					app: name,
					label: APP_MANIFEST[name].label,
					icon: APP_MANIFEST[name].icon,
				})),
			}),
		[posts]
	);

	const [history, setHistory] = useState<{ places: Place[]; at: number }>({ places: [{ folder: 'docs' }], at: 0 });
	const place = history.places[history.at];
	const [view, setView] = useState<View>('icons');
	const [selected, setSelected] = useState<string | null>(null);
	const [query, setQuery] = useState('');
	const content = useRef<HTMLDivElement>(null);

	const go = (next: Place) => {
		setHistory(({ places, at }) => ({ places: [...places.slice(0, at + 1), next], at: at + 1 }));
		setSelected(null);
		setQuery('');
	};
	const step = (delta: number) => {
		setHistory((current) => ({ ...current, at: Math.min(current.places.length - 1, Math.max(0, current.at + delta)) }));
		setSelected(null);
	};

	// 바깥에서 온 문서 열기 요청 (openDoc.ts). 묶어 둔 문서만 연다
	useEffect(() => {
		const take = () => {
			const { path } = finderDocRequest.getState();
			if (!path) return;
			finderDocRequest.setState({ path: null });
			if (DOC_SOURCES[path] !== undefined) go({ doc: path });
		};
		take();
		return finderDocRequest.subscribe(take);
	}, []);

	const folder = 'folder' in place ? (find(locations, place.folder) as FolderItem | null) : null;
	const searching = query.trim() !== '';
	const items: FinderItem[] = searching ? search(locations, query) : (folder?.children ?? []);
	const title = searching
		? `‘${query.trim()}’ 찾기`
		: 'doc' in place
			? place.doc.split('/').at(-1)!
			: (folder?.name ?? 'Finder');
	const crumbs = 'folder' in place ? pathTo(locations, place.folder) : pathTo(locations, `docs:${place.doc}`);
	const location = crumbs[0]?.id ?? null;

	// 메뉴 막대의 Finder 메뉴 (#96). 바탕화면을 눌러 Finder가 되었을 때도 보이므로, 고르면 Finder 창을 연다
	const inFinder = (action: () => void) => () => {
		openApp('finder');
		action();
	};
	const parent = crumbs.length > 1 ? crumbs[crumbs.length - 2] : null;
	useAppMenus('finder', [
		{
			title: '파일',
			items: [
				{ label: '새로운 Finder 윈도우', shortcut: { code: 'KeyN', alt: true }, onSelect: () => openApp('finder') },
			],
		},
		{
			title: '보기',
			items: [
				{
					label: '아이콘으로 보기',
					checked: view === 'icons',
					shortcut: { code: 'Digit1', alt: true },
					onSelect: inFinder(() => setView('icons')),
				},
				{
					label: '목록으로 보기',
					checked: view === 'list',
					shortcut: { code: 'Digit2', alt: true },
					onSelect: inFinder(() => setView('list')),
				},
			],
		},
		{
			title: '이동',
			items: [
				{
					label: '뒤로',
					disabled: history.at === 0,
					shortcut: { code: 'BracketLeft', alt: true },
					onSelect: inFinder(() => step(-1)),
				},
				{
					label: '앞으로',
					disabled: history.at === history.places.length - 1,
					shortcut: { code: 'BracketRight', alt: true },
					onSelect: inFinder(() => step(1)),
				},
				{
					label: '상위 폴더',
					disabled: !parent,
					shortcut: { code: 'ArrowUp', alt: true },
					onSelect: inFinder(() => parent && go({ folder: parent.id })),
				},
				'separator',
				...locations.map((item) => ({
					label: item.name,
					checked: location === item.id && !searching,
					onSelect: inFinder(() => go({ folder: item.id })),
				})),
			],
		},
	]);

	const open = (item: FinderItem) => {
		switch (item.kind) {
			case 'folder':
				go({ folder: item.id });
				return;
			case 'doc':
				go({ doc: item.path });
				return;
			case 'post':
				openApp('memo');
				bringAppToFront('memo');
				requestOpen('memo', item.slug);
				return;
			case 'project':
				openApp('safari');
				bringAppToFront('safari');
				requestOpen('safari', item.projectId);
				return;
			case 'app':
				launch(item.app);
		}
	};

	/** 방향키로 고르기. 아이콘 보기에서는 위아래가 한 줄(칸 수)씩 */
	const onKeyDown = (event: React.KeyboardEvent) => {
		if (event.target instanceof HTMLInputElement) return;
		const index = items.findIndex((item) => item.id === selected);
		const current = index >= 0 ? items[index] : null;
		if ((event.metaKey || event.ctrlKey) && event.key === 'ArrowUp' && crumbs.length > 1) {
			event.preventDefault();
			go({ folder: crumbs.at(-2)!.id });
			return;
		}
		if (event.key === 'Enter' || ((event.metaKey || event.ctrlKey) && event.key === 'ArrowDown')) {
			if (current) {
				event.preventDefault();
				open(current);
			}
			return;
		}
		const grid = content.current?.querySelector<HTMLElement>('.finder-grid');
		const columns =
			view === 'icons' && grid ? Math.max(1, getComputedStyle(grid).gridTemplateColumns.split(' ').length) : 1;
		const delta =
			{
				ArrowRight: view === 'icons' ? 1 : 0,
				ArrowLeft: view === 'icons' ? -1 : 0,
				ArrowDown: columns,
				ArrowUp: -columns,
			}[event.key] ?? 0;
		if (!delta || !items.length) return;
		event.preventDefault();
		const next = index < 0 ? 0 : Math.min(items.length - 1, Math.max(0, index + delta));
		setSelected(items[next].id);
		content.current
			?.querySelector<HTMLElement>(`[data-id="${CSS.escape(items[next].id)}"]`)
			?.scrollIntoView({ block: 'nearest' });
	};

	const itemProps = (item: FinderItem) => ({
		'data-id': item.id,
		className: `finder-item ${item.kind}${selected === item.id ? ' selected' : ''}`,
		'aria-selected': selected === item.id,
		role: 'option' as const,
		onClick: (event: React.MouseEvent) => {
			event.stopPropagation();
			setSelected(item.id);
		},
		onDoubleClick: () => open(item),
	});

	const empty = !searching && folder && items.length === 0;

	return (
		<AppWindow title={appTitle} appName="finder" chrome="unified">
			<div className="finder">
				<nav className="finder-sidebar" aria-label="즐겨찾기">
					<div className="finder-lights-space" />
					<h2>즐겨찾기</h2>
					{locations.map((item) => (
						<button
							key={item.id}
							type="button"
							className={`finder-location${location === item.id && !searching ? ' active' : ''}`}
							aria-current={location === item.id && !searching ? 'page' : undefined}
							onClick={() => go({ folder: item.id })}
						>
							<i className={LOCATION_ICONS[item.id]} aria-hidden="true" />
							{item.name}
						</button>
					))}
				</nav>

				<div className="finder-main">
					{/* 휴대폰: 떠 있는 뒤로 가기가 Finder의 뒤로 (iOS 파일처럼 단추 하나). 처음 화면이면 홈으로 */}
					<MobileNavigation {...(history.at > 0 ? { backLabel: '뒤로', onBack: () => step(-1) } : {})} />
					<div className="finder-toolbar">
						<div className="finder-nav">
							<IconButton
								icon="fa-solid fa-chevron-left"
								label="뒤로"
								disabled={history.at === 0}
								onClick={() => step(-1)}
							/>
							<IconButton
								icon="fa-solid fa-chevron-right"
								label="앞으로"
								disabled={history.at === history.places.length - 1}
								onClick={() => step(1)}
							/>
						</div>
						<h1 className="finder-title">{title}</h1>
						{'folder' in place && (
							<div className="finder-views" role="group" aria-label="보기">
								<IconButton
									icon="fa-solid fa-table-cells-large"
									label="아이콘으로 보기"
									on={view === 'icons'}
									aria-pressed={view === 'icons'}
									onClick={() => setView('icons')}
								/>
								<IconButton
									icon="fa-solid fa-list"
									label="목록으로 보기"
									on={view === 'list'}
									aria-pressed={view === 'list'}
									onClick={() => setView('list')}
								/>
							</div>
						)}
						<label className="finder-search">
							<i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
							<input
								type="search"
								placeholder="이름으로 찾기"
								aria-label="이름으로 찾기"
								value={query}
								onChange={(event) => {
									setQuery(event.target.value);
									setSelected(null);
									if ('doc' in place && event.target.value) go({ folder: location ?? 'docs' });
								}}
							/>
						</label>
					</div>

					{/* 좁은 창: 사이드바 대신 위치를 한 줄로 */}
					<div className="finder-chips" role="group" aria-label="위치">
						{locations.map((item) => (
							<button
								key={item.id}
								type="button"
								className={location === item.id && !searching ? 'active' : undefined}
								onClick={() => go({ folder: item.id })}
							>
								{item.name}
							</button>
						))}
					</div>

					<div
						ref={content}
						className="finder-content"
						tabIndex={0}
						onKeyDown={onKeyDown}
						onClick={() => setSelected(null)}
					>
						{'doc' in place ? (
							<DocView path={place.doc} dark={dark} onOpenDoc={(path) => go({ doc: path })} />
						) : empty ? (
							<p className="finder-empty">{folder.emptyNote ?? '비어 있음'}</p>
						) : searching && items.length === 0 ? (
							<p className="finder-empty">찾는 이름이 없습니다.</p>
						) : view === 'icons' ? (
							<div className="finder-grid" role="listbox" aria-label={title}>
								{items.map((item) => (
									<div key={item.id} {...itemProps(item)}>
										<span className="finder-icon">
											<FinderIcon item={item} />
										</span>
										<span className="finder-name" title={item.name}>
											{item.name}
										</span>
									</div>
								))}
							</div>
						) : (
							<div className="finder-list" role="listbox" aria-label={title}>
								<div className="finder-list-head" aria-hidden="true">
									<span>이름</span>
									<span>수정일</span>
									<span>종류</span>
								</div>
								{items.map((item) => (
									<div key={item.id} {...itemProps(item)}>
										<span className="finder-list-name">
											<span className="finder-icon small">
												<FinderIcon item={item} />
											</span>
											<span className="finder-name" title={item.name}>
												{item.name}
											</span>
										</span>
										<span className="finder-list-date">{dateCell(item)}</span>
										<span className="finder-list-kind">{KIND_LABELS[item.kind]}</span>
									</div>
								))}
							</div>
						)}
					</div>

					{/* 경로 막대: 눌러서 위 폴더로 */}
					<div className="finder-pathbar">
						<nav aria-label="경로">
							{crumbs.map((crumb, i) => (
								<React.Fragment key={crumb.id}>
									{i > 0 && <i className="fa-solid fa-chevron-right" aria-hidden="true" />}
									{crumb.kind === 'folder' && i < crumbs.length - 1 ? (
										<button type="button" onClick={() => go({ folder: crumb.id })}>
											{crumb.name}
										</button>
									) : (
										<span>
											{crumb.kind === 'doc' ? docTitle(crumb.path, DOC_SOURCES[crumb.path] ?? '') : crumb.name}
										</span>
									)}
								</React.Fragment>
							))}
						</nav>
						{'folder' in place && <span className="finder-count">{countLabel(items.length)}</span>}
					</div>
				</div>
			</div>
		</AppWindow>
	);
};

export default Finder;
