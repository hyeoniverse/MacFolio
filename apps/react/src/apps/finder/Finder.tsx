import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import AppWindow from '@/desktop/window/Window';
import { useAppState } from '@/desktop/useAppState';
import { useAppMenus } from '@/desktop/status-bar/appMenus';
import { useLocations } from './useLocations';
import { useLaunchApp } from '@/desktop/useLaunchApp';
import { APP_MANIFEST } from '@/apps/manifest';
import { requestOpen } from '@/shared/lib/openRequest';
import { useResolvedTheme } from '@/shared/settings/settingsStore';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import IconButton from '@/shared/ui/button/IconButton';
import { countLabel, find, KIND_LABELS, pathTo, search, type FinderItem, type FolderItem } from './files';
import { FINDER_DRAG_TYPE, finderDrag, finderRenaming, stemLength, useFinderEdit } from './useFinderEdit';
import { canCreateIn, canMove, canRename, canTrash } from './edit';
import InlineName from './InlineName';
import Menu, { type MenuItem } from '@/shared/ui/menu/Menu';
import { useDocumentDrop } from './useDocumentDrop';
import { DOC_SOURCES } from './docsBundle';
import { docTitle } from './repoDocs';
import { finderDocRequest, finderFolderRequest } from './openDoc';
import DocView from './DocView';
import FinderIcon from './FinderIcon';
import AppsGlyph from './AppsGlyph';
import { openInPreview } from '@/apps/preview/previewStore';
import FinderMobile from './FinderMobile';
import '@/apps/finder/Finder.css';
import { useMoveDirection } from '@/shared/ui/motion/useMoveDirection';
import SearchField from '@/shared/ui/search-field/SearchField';

type View = 'icons' | 'list';

/** 지나온 곳 하나: 폴더, 또는 Finder 안에서 읽는 문서 */
type Place = { folder: string } | { doc: string };

const LOCATION_ICONS: Record<string, string> = {
	desktop: 'fa-solid fa-display',
	docs: 'fa-regular fa-file-lines',
	blog: 'fa-regular fa-pen-to-square',
};

/** 즐겨찾기에 함께 두는 문서 폴더 (macOS에서 자주 쓰는 폴더를 사이드바에 끌어 둔 것처럼, 문서 바로 아래) */
const FAVORITE_FOLDERS = ['docs:이력서', 'docs:포트폴리오', 'docs:자격증'];

const formatDate = (date?: string) => {
	if (!date) return '—';
	const [y, m, d] = date.split('-').map(Number);
	return `${y}. ${m}. ${d}.`;
};

/** 목록 보기 '수정일' 칸: 글·폴더는 날짜, 프로젝트는 진행 기간 */
const dateCell = (item: FinderItem) => (item.kind === 'project' ? (item.period ?? '—') : formatDate(item.modified));

/**
 * Finder: 사이트에 있는 것들을 파일처럼 둘러본다 (이슈 #20).
 * 왼쪽 즐겨찾기(데스크탑, 문서, 블로그, 응용 프로그램. 프로젝트 폴더는 문서 › 포트폴리오 안), 아이콘·목록 보기, 이름 찾기, 뒤로·앞으로.
 * 한 번 누르면 고르고, 두 번 누르거나 Enter를 누르면 연다. 문서는 Finder 안에서 읽고, PDF·그림은 미리보기 앱,
 * 프로젝트는 Safari, 글은 메모, 앱은 그 앱을 연다.
 */
const Finder: React.FC = () => {
	const { openApp, bringAppToFront } = useAppState();
	const { launch } = useLaunchApp();
	const dark = useResolvedTheme() === 'dark';
	const mobile = useIsMobile();
	// 휴대폰에서는 홈 화면 이름처럼 '파일' (manifest.ts의 mobile)
	const appTitle = mobile ? APP_MANIFEST.finder.mobile!.label : APP_MANIFEST.finder.label;

	const locations = useLocations();

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

	// 바깥에서 온 문서 열기 요청 (openDoc.ts). 묶어 둔 문서만 연다. 휴대폰은 FinderMobile이 받는다
	useEffect(() => {
		if (mobile) return;
		const take = () => {
			const { path } = finderDocRequest.getState();
			if (!path) return;
			finderDocRequest.setState({ path: null });
			if (DOC_SOURCES[path] !== undefined) go({ doc: path });
		};
		take();
		return finderDocRequest.subscribe(take);
	}, [mobile]);

	// 바탕화면 폴더 아이콘에서 온 폴더 열기 요청 (openDoc.ts의 requestFinderFolder)
	useEffect(() => {
		if (mobile) return;
		const take = () => {
			const { id } = finderFolderRequest.getState();
			if (!id) return;
			finderFolderRequest.setState({ id: null });
			go({ folder: id });
		};
		take();
		return finderFolderRequest.subscribe(take);
	}, [mobile]);

	const folder = 'folder' in place ? (find(locations, place.folder) as FolderItem | null) : null;
	// 관리자가 컴퓨터의 파일을 놓아 올릴 수 있는 폴더 (문서·데스크탑·프로젝트·만든 폴더)
	const drop = useDocumentDrop(locations, folder?.id ?? null);
	const dropFolder = drop.canUpload(folder?.id) ? folder!.id : null;
	const searching = query.trim() !== '';
	// 다른 폴더·문서·보기로 가면 내용을 새로 그린다 (motion.css의 motion-swap). 들어가면 오른쪽에서, 뒤로 가면 왼쪽에서 들어온다
	const placeKey = `${JSON.stringify(place)}|${view}|${searching}`;
	const direction = useMoveDirection(history.at, undefined, `${view}|${searching}`);
	const items: FinderItem[] = searching ? search(locations, query) : (folder?.children ?? []);
	const title = searching
		? `‘${query.trim()}’ 찾기`
		: 'doc' in place
			? place.doc.split('/').at(-1)!
			: (folder?.name ?? 'Finder');
	const crumbs = 'folder' in place ? pathTo(locations, place.folder) : pathTo(locations, `docs:${place.doc}`);
	// 사이드바에서 칠할 곳: 경로에서 가장 안쪽의 즐겨찾기 (이력서 안이면 이력서, 그 밖의 문서면 문서)
	const location =
		[...crumbs].reverse().find((crumb) => FAVORITE_FOLDERS.includes(crumb.id))?.id ?? crumbs[0]?.id ?? null;
	const favorites = locations.flatMap((item) =>
		item.id === 'docs'
			? [item, ...FAVORITE_FOLDERS.map((id) => find(locations, id)).filter((found): found is FinderItem => !!found)]
			: [item]
	);

	// 메뉴 막대의 Finder 메뉴 (#96). 바탕화면을 눌러 Finder가 되었을 때도 보이므로, 고르면 Finder 창을 연다
	const inFinder = (action: () => void) => () => {
		openApp('finder');
		action();
	};
	const parent = crumbs.length > 1 ? crumbs[crumbs.length - 2] : null;
	const selectedItem = items.find((item) => item.id === selected);
	// 관리자의 편집 (useFinderEdit): 새 폴더, 이름 변경, 끌어서 옮기기, 휴지통으로 이동. 방문자는 메뉴가 흐리고 끌어도 아무 일이 없다
	const edit = useFinderEdit(locations);
	const renaming = useSyncExternalStore(finderRenaming.subscribe, () => finderRenaming.getState().id);
	const startRename = (item: FinderItem | undefined) => {
		if (edit.admin && item && canRename(item)) finderRenaming.setState({ id: item.id });
	};
	const newFolder = () => {
		const id = edit.newFolder(folder);
		if (id) setSelected(id);
	};
	const trashSelected = () => selectedItem && edit.trash([selectedItem], () => setSelected(null));
	const [menu, setMenu] = useState<{ anchor: { x: number; y: number }; item: FinderItem | null } | null>(null);
	const [dropId, setDropId] = useState<string | null>(null);
	useAppMenus('finder', [
		{
			title: '파일',
			items: [
				{ label: '새로운 Finder 윈도우', shortcut: { code: 'KeyN', alt: true }, onSelect: () => openApp('finder') },
				// 관리자만: 새 폴더, 고른 항목의 이름 바꾸기·휴지통으로 이동. 시스템 항목과 방문자는 흐리게
				// (⇧⌘N은 브라우저가 가져가서 macOS 단축키 글자 그대로 ⌥⇧N)
				'separator',
				{
					label: '새 폴더',
					disabled: !edit.admin || !canCreateIn(folder) || searching,
					shortcut: { code: 'KeyN', alt: true, shift: true },
					onSelect: inFinder(newFolder),
				},
				'separator',
				{
					label: '이름 변경…',
					disabled: !edit.admin || !selectedItem || !canRename(selectedItem),
					onSelect: inFinder(() => startRename(selectedItem)),
				},
				{
					label: '휴지통으로 이동',
					disabled: !edit.admin || !selectedItem || !canTrash(selectedItem),
					shortcut: { code: 'Backspace', mod: true },
					onSelect: inFinder(trashSelected),
				},
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
				// 바탕화면의 가상본은 원래 폴더로
				go({ folder: item.aliasOf ?? item.id });
				return;
			case 'doc':
				go({ doc: item.path });
				return;
			case 'pdf':
			case 'image':
				openApp('preview');
				bringAppToFront('preview');
				openInPreview({ key: item.key, name: item.name, kind: item.kind, size: item.size });
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
		// macOS처럼 Enter는 이름 변경 (관리자, 바꿀 수 있는 항목). 그 밖에는 연다
		if (event.key === 'Enter' && edit.admin && current && canRename(current)) {
			event.preventDefault();
			startRename(current);
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

	/** 이미 고른 항목의 이름을 누르면 잠시 뒤 이름 편집 (두 번 누르기와 겹치지 않게 기다린다) */
	const renameTimer = useRef<number | undefined>(undefined);
	const nameClick = (item: FinderItem) => (event: React.MouseEvent) => {
		if (selected !== item.id || !edit.admin || !canRename(item) || event.detail > 1) return;
		window.clearTimeout(renameTimer.current);
		renameTimer.current = window.setTimeout(() => startRename(item), 500);
	};
	const nameOf = (item: FinderItem) =>
		renaming === item.id ? (
			<InlineName
				name={item.name}
				select={stemLength(item, item.name)}
				onCommit={(name) =>
					void edit.rename(item, name).then((id) => {
						if (id) setSelected(id);
						content.current?.focus({ preventScroll: true });
					})
				}
				onCancel={() => {
					finderRenaming.setState({ id: null });
					content.current?.focus({ preventScroll: true });
				}}
			/>
		) : (
			<span className="finder-name" title={item.name} onClick={nameClick(item)}>
				{item.name}
			</span>
		);

	// 끌어서 옮기기 (관리자): 항목을 폴더 아이콘·사이드바 위치·경로 막대·열린 폴더(빈 곳)·바탕화면에 놓는다
	const targetAt = (event: React.DragEvent) =>
		(event.target as Element).closest?.('[data-folder-target]')?.getAttribute('data-folder-target') ?? null;
	const moveHandlers = {
		onDragOver: (event: React.DragEvent) => {
			if (!event.dataTransfer.types.includes(FINDER_DRAG_TYPE)) return;
			const id = targetAt(event);
			const ok = edit.canDrop(finderDrag.getState().ids, id ? find(locations, id) : null);
			setDropId(ok ? id : null);
			if (!ok) return;
			event.preventDefault();
			event.dataTransfer.dropEffect = 'move';
		},
		onDragLeave: (event: React.DragEvent) => {
			if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropId(null);
		},
		onDrop: (event: React.DragEvent) => {
			setDropId(null);
			if (!event.dataTransfer.types.includes(FINDER_DRAG_TYPE)) return;
			const id = targetAt(event);
			const target = id ? find(locations, id) : null;
			if (!target) return;
			event.preventDefault();
			edit.move(finderDrag.getState().ids, target);
		},
	};

	const itemProps = (item: FinderItem) => ({
		'data-id': item.id,
		'data-folder-target': item.kind === 'folder' ? item.id : undefined,
		draggable: edit.admin && canMove(item) && renaming !== item.id,
		onDragStart: (event: React.DragEvent) => {
			event.dataTransfer.setData(FINDER_DRAG_TYPE, JSON.stringify([item.id]));
			event.dataTransfer.effectAllowed = 'move';
			finderDrag.setState({ ids: [item.id] });
			setSelected(item.id);
		},
		onDragEnd: () => {
			finderDrag.setState({ ids: [] });
			setDropId(null);
		},
		onContextMenu: (event: React.MouseEvent) => {
			event.preventDefault();
			event.stopPropagation();
			setSelected(item.id);
			setMenu({ anchor: { x: event.clientX, y: event.clientY }, item });
		},
		className: `finder-item ${item.kind}${selected === item.id ? ' selected' : ''}${
			(drop.target === item.id && dropFolder !== item.id) || (dropId === item.id && dropId !== folder?.id)
				? ' drop-target'
				: ''
		}${item.kind === 'folder' && item.aliasOf ? ' alias' : ''}${renaming === item.id ? ' renaming' : ''}`,
		'aria-selected': selected === item.id,
		role: 'option' as const,
		onClick: (event: React.MouseEvent) => {
			event.stopPropagation();
			setSelected(item.id);
		},
		onDoubleClick: () => {
			window.clearTimeout(renameTimer.current);
			if (renaming !== item.id) open(item);
		},
	});

	const menuItems: MenuItem[] = menu?.item
		? [
				{ label: '열기', onSelect: () => open(menu.item!) },
				'separator',
				{
					label: '이름 변경',
					disabled: !edit.admin || !canRename(menu.item),
					onSelect: () => startRename(menu.item!),
				},
				{
					label: '휴지통으로 이동',
					disabled: !edit.admin || !canTrash(menu.item),
					onSelect: () => edit.trash([menu.item!], () => setSelected(null)),
				},
			]
		: [
				{ label: '새 폴더', disabled: !edit.admin || !canCreateIn(folder) || searching, onSelect: newFolder },
				'separator',
				{ label: '아이콘으로 보기', checked: view === 'icons', onSelect: () => setView('icons') },
				{ label: '목록으로 보기', checked: view === 'list', onSelect: () => setView('list') },
			];

	const empty = !searching && folder && items.length === 0;

	return (
		<AppWindow title={appTitle} appName="finder" chrome="unified">
			{/* 휴대폰은 iOS 파일 앱처럼 따로 짠다 (FinderMobile) */}
			{mobile ? (
				<FinderMobile locations={locations} onOpenElsewhere={open} dark={dark} />
			) : (
				<div className="finder" {...moveHandlers}>
					<nav className="finder-sidebar" aria-label="즐겨찾기" {...drop.handlers}>
						<div className="finder-lights-space" />
						<h2>즐겨찾기</h2>
						{favorites.map((item) => (
							<button
								key={item.id}
								type="button"
								data-folder-target={item.id}
								className={`finder-location${location === item.id && !searching ? ' active' : ''}${
									dropId === item.id || (drop.target === item.id && dropFolder !== item.id) ? ' drop-target' : ''
								}`}
								aria-current={location === item.id && !searching ? 'page' : undefined}
								onClick={() => go({ folder: item.id })}
							>
								{item.id === 'apps' ? (
									<AppsGlyph />
								) : (
									<i className={LOCATION_ICONS[item.id] ?? 'fa-regular fa-folder'} aria-hidden="true" />
								)}
								{item.name}
							</button>
						))}
					</nav>

					<div className="finder-main">
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
							<h1 key={title} className="finder-title motion-swap">
								{title}
							</h1>
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
							<SearchField
								className="finder-search"
								label="이름으로 찾기"
								value={query}
								onChange={(event) => {
									setQuery(event.target.value);
									setSelected(null);
									if ('doc' in place && event.target.value) go({ folder: location ?? 'docs' });
								}}
							/>
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
							data-folder-target={'folder' in place && !searching ? folder?.id : undefined}
							className={`finder-content${
								(drop.target && drop.target === dropFolder) || (dropId !== null && dropId === folder?.id)
									? ' drop-target'
									: ''
							}`}
							data-direction={direction ?? undefined}
							{...drop.handlers}
							tabIndex={0}
							onKeyDown={onKeyDown}
							onClick={() => setSelected(null)}
							onContextMenu={(event) => {
								if (!('folder' in place)) return;
								event.preventDefault();
								setSelected(null);
								setMenu({ anchor: { x: event.clientX, y: event.clientY }, item: null });
							}}
						>
							{'doc' in place ? (
								<DocView path={place.doc} dark={dark} onOpenDoc={(path) => go({ doc: path })} />
							) : empty ? (
								<p className="finder-empty">
									{drop.admin && dropFolder
										? '파일을 여기에 끌어다 놓으면 올라갑니다 (PDF·PNG·JPG·WebP, 20MB까지).'
										: (folder.emptyNote ?? '비어 있음')}
								</p>
							) : searching && items.length === 0 ? (
								<p className="finder-empty">찾는 이름이 없습니다.</p>
							) : view === 'icons' ? (
								<div key={placeKey} className="finder-grid motion-swap" role="listbox" aria-label={title}>
									{items.map((item) => (
										<div key={item.id} {...itemProps(item)}>
											<span className="finder-icon">
												<FinderIcon item={item} />
											</span>
											{nameOf(item)}
										</div>
									))}
								</div>
							) : (
								<div key={placeKey} className="finder-list motion-swap" role="listbox" aria-label={title}>
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
												{nameOf(item)}
											</span>
											<span className="finder-list-date">{dateCell(item)}</span>
											<span className="finder-list-kind">{KIND_LABELS[item.kind]}</span>
										</div>
									))}
								</div>
							)}
						</div>

						{drop.uploads.length > 0 && (
							<ul className="finder-uploads" aria-label="올리는 중">
								{drop.uploads.map((upload) => (
									<li key={upload.id}>
										<span>
											{upload.place} › {upload.name}
										</span>
										<progress value={upload.progress} max={1} aria-label={`${upload.name} 올리는 중`} />
									</li>
								))}
							</ul>
						)}

						{/* 경로 막대: 눌러서 위 폴더로 */}
						<div className="finder-pathbar">
							<nav aria-label="경로">
								{crumbs.map((crumb, i) => (
									<React.Fragment key={crumb.id}>
										{i > 0 && <i className="fa-solid fa-chevron-right" aria-hidden="true" />}
										{crumb.kind === 'folder' && i < crumbs.length - 1 ? (
											<button
												type="button"
												data-folder-target={crumb.id}
												className={dropId === crumb.id ? 'drop-target' : undefined}
												onClick={() => go({ folder: crumb.id })}
											>
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
			)}
			{menu && (
				<Menu
					label={menu.item ? '항목 메뉴' : '폴더 메뉴'}
					anchor={menu.anchor}
					items={menuItems}
					onClose={() => setMenu(null)}
				/>
			)}
			{edit.dialog}
		</AppWindow>
	);
};

export default Finder;
