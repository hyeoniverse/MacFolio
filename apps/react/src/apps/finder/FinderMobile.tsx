import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import MobileNavigation from '@/desktop/window/MobileNavigation';
import Menu, { type MenuItem } from '@/shared/ui/menu/Menu';
import {
	find,
	KIND_LABELS,
	previewFolder,
	FAVORITE_IDS,
	foldersOf,
	mediaKind,
	recentItems,
	search,
	sortItems,
	type FinderItem,
	type FolderItem,
	type SortKey,
} from './files';
import FileView from './FileView';
import { downloadFile, openFileInNewTab, PICTURES_DOCUMENT_FOLDER } from './documents';
import { DOC_SOURCES } from './docsBundle';
import { finderDocRequest } from './openDoc';
import DocView from './DocView';
import FinderIcon from './FinderIcon';
import AppsGlyph from './AppsGlyph';
import '@/apps/finder/FinderMobile.css';
import SearchField from '@/shared/ui/search-field/SearchField';
import IconButton from '@/shared/ui/button/IconButton';
import EmptyState from '@/shared/ui/empty-state/EmptyState';
import { finderRenaming, stemLength, useFinderEdit } from './useFinderEdit';
import { ADMIN_ONLY_NOTE, canCreateIn, canRename, canTrash, uploadPlan } from './edit';
import { uploadInto } from './useDocumentDrop';
import InlineName from './InlineName';

type Tab = 'recents' | 'browse';
type View = 'icons' | 'list';
/** 들어간 곳: 폴더, 앱 안에서 읽는 문서, 또는 미리 보는 파일(PDF·그림, 항목 id) */
type Screen = { folder: string } | { doc: string } | { file: string };

const TAB_TITLES: Record<Tab, string> = { recents: '최근 항목', browse: '둘러보기' };

/** 둘러보기의 위치 아이콘 (iOS 파일의 iCloud Drive·나의 iPhone처럼 파란 선 아이콘) */
const LOCATION_ICONS: Record<string, string> = {
	preview: 'fa-solid fa-cloud',
	desktop: 'fa-solid fa-display',
	docs: 'fa-regular fa-file-lines',
	blog: 'fa-regular fa-pen-to-square',
	pictures: 'fa-regular fa-image',
};

/** 둘러보기의 즐겨찾기: 데스크톱 사이드바의 즐겨찾기에 그림을 더한다 (휴대폰에는 홈 폴더로 가는 길이 없어서. 사진 위젯의 그림 폴더) */
const PHONE_FAVORITE_IDS = [...FAVORITE_IDS.slice(0, 3), 'pictures', ...FAVORITE_IDS.slice(3)];

const formatDate = (date: string) => {
	const [y, m, d] = date.split('-').map(Number);
	return `${y}. ${m}. ${d}.`;
};

/** 길게 누르면 항목 메뉴 (iOS 파일의 길게 누르기) */
const LONG_PRESS_MS = 500;

/** 이름 아래 한 줄: 폴더는 항목 수, 파일은 날짜(없으면 종류) */
const summary = (item: FinderItem) =>
	item.kind === 'alias'
		? KIND_LABELS.alias
		: item.kind === 'folder'
			? `${item.children.length}개의 항목`
			: item.modified
				? formatDate(item.modified)
				: item.kind === 'project'
					? (item.period ?? KIND_LABELS.project)
					: KIND_LABELS[item.kind];

interface Props {
	locations: FolderItem[];
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
	// 둘러보기의 묶음(위치·즐겨찾기)마다 펼침
	const [closed, setClosed] = useState<Record<string, boolean>>({});
	const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
	const moreButton = useRef<HTMLButtonElement>(null);
	// 관리자의 편집 (데스크톱 Finder와 같은 useFinderEdit): 길게 누른 항목의 메뉴, 이름을 고치는 항목, 올릴 파일을 고르는 칸
	const edit = useFinderEdit(locations, 'screen');
	const [itemMenu, setItemMenu] = useState<{ item: FinderItem; x: number; y: number } | null>(null);
	const renaming = useSyncExternalStore(finderRenaming.subscribe, () => finderRenaming.getState().id);
	const picker = useRef<HTMLInputElement>(null);
	const press = useRef<{ timer: number; x: number; y: number; fired: boolean } | null>(null);

	// 화면이 바뀐 방식: 들어가면 오른쪽에서, 돌아오면 왼쪽에서, 탭을 바꾸면 서서히 (처음에는 움직이지 않는다)
	const [motion, setMotion] = useState<'forward' | 'back' | 'fade' | null>(null);

	// 둘러보기의 '위치'에 iCloud 미리보기 폴더를 더한 트리 (데스크톱 미리보기의 열기 창과 같은 구조). 찾기·최근 항목은 원래 트리로
	const preview = useMemo(() => previewFolder(locations), [locations]);
	const roots = useMemo(() => [preview, ...locations], [preview, locations]);

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
	const screenKey = screen
		? 'doc' in screen
			? `doc:${screen.doc}`
			: 'file' in screen
				? `file:${screen.file}`
				: `folder:${screen.folder}`
		: `tab:${tab}`;

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
		else if (item.kind === 'alias') push({ folder: item.target });
		else if (item.kind === 'doc') push({ doc: item.path });
		else if (item.kind === 'pdf' || item.kind === 'image' || (item.kind === 'file' && mediaKind(item.name)))
			push({ file: item.id });
		else if (item.kind === 'file') downloadFile(item.key, item.name);
		else onOpenElsewhere(item);
	};

	const titleOf = (target: Screen | undefined): string =>
		!target
			? TAB_TITLES[tab]
			: 'doc' in target
				? target.doc.split('/').at(-1)!
				: (find(roots, 'file' in target ? target.file : target.folder)?.name ?? TAB_TITLES[tab]);
	const title = titleOf(screen);
	const searching = query.trim() !== '';
	const folder = screen && 'folder' in screen ? find(roots, screen.folder) : null;

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

	if (screen && 'file' in screen) {
		const file = find(roots, screen.file);
		const viewable =
			file && (file.kind === 'pdf' || file.kind === 'image' || (file.kind === 'file' && mediaKind(file.name)))
				? file
				: null;
		return (
			<div className="files-phone file">
				{navigation}
				{/* 오른쪽 위: 공유 (iOS 훑어보기의 공유 버튼) */}
				{viewable && (
					<IconButton
						ref={moreButton}
						className="files-phone-more"
						label="공유"
						icon="fa-solid fa-arrow-up-from-bracket"
						aria-haspopup="menu"
						aria-expanded={menu !== null}
						onClick={(event) => {
							const rect = event.currentTarget.getBoundingClientRect();
							setMenu(menu ? null : { x: rect.right - 250, y: rect.bottom + 8 });
						}}
					/>
				)}
				{viewable && menu && (
					<Menu
						label="공유"
						variant="ios"
						anchor={menu}
						trigger={moreButton}
						onClose={() => setMenu(null)}
						items={[
							{
								label: '다운로드',
								icon: 'fa-solid fa-download',
								onSelect: () => downloadFile(viewable.key, viewable.name),
							},
							{
								label: '새 탭에서 열기',
								icon: 'fa-solid fa-arrow-up-right-from-square',
								onSelect: () => openFileInNewTab(viewable.key),
							},
						]}
					/>
				)}
				<h2 key={`title:${screenKey}`} className="files-phone-bar-title">
					{title}
				</h2>
				<div key={screenKey} className="files-phone-scroll" data-motion={motion ?? undefined}>
					{viewable ? (
						<FileView item={viewable} />
					) : (
						<EmptyState className="files-phone-empty">파일을 찾을 수 없습니다.</EmptyState>
					)}
				</div>
			</div>
		);
	}

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

	// 메뉴는 iOS처럼 누른 항목 바로 아래에 (항목을 가리지 않는다. 화면 밖으로 나가면 Menu가 안으로 옮긴다)
	const openItemMenu = (item: FinderItem, target: Element) => {
		const rect = target.getBoundingClientRect();
		setItemMenu({ item, x: rect.left + rect.width / 2 - 125, y: rect.bottom + 6 });
	};
	const startPress = (item: FinderItem, event: React.PointerEvent) => {
		if (event.pointerType === 'mouse') return;
		const { clientX: x, clientY: y, currentTarget } = event;
		const timer = window.setTimeout(() => {
			if (press.current) press.current.fired = true;
			openItemMenu(item, currentTarget);
		}, LONG_PRESS_MS);
		press.current = { timer, x, y, fired: false };
	};
	// 손가락이 움직이면(넘기기) 길게 누르기가 아니다
	const movePress = (event: React.PointerEvent) => {
		const current = press.current;
		if (current && !current.fired && Math.hypot(event.clientX - current.x, event.clientY - current.y) > 8) {
			window.clearTimeout(current.timer);
			press.current = null;
		}
	};
	const endPress = () => {
		if (press.current && !press.current.fired) {
			window.clearTimeout(press.current.timer);
			press.current = null;
		}
	};

	// 이 폴더에 새 폴더를 만들거나 파일을 올릴 수 있는지 (관리자만. 찾는 중이 아닐 때)
	const editable = folder?.kind === 'folder' && !searching ? folder : null;
	const upload = editable ? uploadPlan(locations, editable) : null;
	const itemMenuItems: MenuItem[] = itemMenu
		? [
				{ label: '열기', icon: 'fa-regular fa-folder-open', onSelect: () => open(itemMenu.item) },
				'separator',
				{
					label: '이름 변경',
					icon: 'fa-solid fa-pen',
					disabled: !edit.admin || !canRename(itemMenu.item),
					onSelect: () => finderRenaming.setState({ id: itemMenu.item.id }),
				},
				{
					label: '휴지통으로 이동',
					icon: 'fa-regular fa-trash-can',
					destructive: true,
					disabled: !edit.admin || !canTrash(itemMenu.item),
					onSelect: () => edit.trash([itemMenu.item]),
				},
				...(edit.admin ? [] : (['separator', { note: ADMIN_ONLY_NOTE }] satisfies MenuItem[])),
			]
		: [];

	const grid = (
		<ul
			key={`${view}:${sort}`}
			className={`files-phone-items ${view}`}
			aria-label={searching ? `‘${query.trim()}’ 찾기` : title}
		>
			{items.map((item) =>
				renaming === item.id ? (
					// 이름 고치기: 아이콘 아래(목록은 옆) 이름 자리에 입력 칸
					<li key={item.id}>
						<div className="files-phone-item">
							<span className="files-phone-icon" aria-hidden="true">
								<FinderIcon item={item} />
							</span>
							<span className="files-phone-text">
								<InlineName
									name={item.name}
									select={stemLength(item, item.name)}
									className="files-phone-rename"
									onCommit={(name) => void edit.rename(item, name)}
									onCancel={() => finderRenaming.setState({ id: null })}
								/>
							</span>
						</div>
					</li>
				) : (
					<li key={item.id}>
						<button
							type="button"
							className="files-phone-item"
							onClick={() => {
								// 길게 눌러 메뉴를 띄운 뒤의 누르기는 열지 않는다
								if (press.current?.fired) press.current = null;
								else open(item);
							}}
							onPointerDown={(event) => startPress(item, event)}
							onPointerMove={movePress}
							onPointerUp={endPress}
							onPointerCancel={endPress}
							onContextMenu={(event) => {
								event.preventDefault();
								openItemMenu(item, event.currentTarget);
							}}
						>
							<span className="files-phone-icon" aria-hidden="true">
								<FinderIcon item={item} />
							</span>
							<span className="files-phone-text">
								<span className="files-phone-name">{item.name}</span>
								<span className="files-phone-summary">{summary(item)}</span>
							</span>
							{view === 'list' && (item.kind === 'folder' || item.kind === 'alias') && (
								<i className="fa-solid fa-chevron-right files-phone-chevron" aria-hidden="true" />
							)}
						</button>
					</li>
				)
			)}
		</ul>
	);

	return (
		<div className="files-phone">
			{navigation}
			{/* 오른쪽 위: 보기와 정렬 (iOS 파일의 •••) */}
			<IconButton
				ref={moreButton}
				className="files-phone-more"
				label="보기 옵션"
				icon="fa-solid fa-ellipsis"
				aria-haspopup="menu"
				aria-expanded={menu !== null}
				onClick={(event) => {
					const rect = event.currentTarget.getBoundingClientRect();
					setMenu(menu ? null : { x: rect.right - 250, y: rect.bottom + 8 });
				}}
			/>
			{screen && (
				<h2 key={`title:${screenKey}`} className="files-phone-bar-title">
					{title}
				</h2>
			)}

			<div key={screenKey} className={`files-phone-scroll ${screen ? 'inside' : ''}`} data-motion={motion ?? undefined}>
				{/* 첫 화면의 큰 제목: 뒤로 가기와 같은 줄 (다른 앱과 같은 phone-title) */}
				{!screen && <h2 className="phone-title">{title}</h2>}
				<SearchField
					className="files-phone-search"
					label="검색"
					value={query}
					onChange={(event) => setQuery(event.target.value)}
				/>

				{searching || screen || tab === 'recents' ? (
					items.length > 0 ? (
						grid
					) : (
						<EmptyState className="files-phone-empty">
							{searching
								? '찾는 이름이 없습니다.'
								: folder?.kind === 'folder'
									? (folder.emptyNote ?? '비어 있음')
									: '최근 항목이 없습니다.'}
						</EmptyState>
					)
				) : (
					<>
						{(
							[
								['위치', [preview]],
								['즐겨찾기', foldersOf(locations, PHONE_FAVORITE_IDS)],
							] as [string, FolderItem[]][]
						).map(([heading, places]) => (
							<section key={heading} className="files-phone-section" aria-label={heading}>
								<h3>
									<button
										type="button"
										aria-expanded={!closed[heading]}
										onClick={() => setClosed((all) => ({ ...all, [heading]: !all[heading] }))}
									>
										{heading}
										<i className={`fa-solid fa-chevron-${closed[heading] ? 'right' : 'down'}`} aria-hidden="true" />
									</button>
								</h3>
								{!closed[heading] && (
									<ul className="files-phone-places">
										{places.map((place) => (
											<li key={place.id}>
												<button type="button" onClick={() => open(place)}>
													{place.id === 'apps' ? (
														<AppsGlyph />
													) : (
														<i className={LOCATION_ICONS[place.id]} aria-hidden="true" />
													)}
													<span>{place.name}</span>
													<i className="fa-solid fa-chevron-right files-phone-chevron" aria-hidden="true" />
												</button>
											</li>
										))}
									</ul>
								)}
							</section>
						))}
					</>
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
					variant="ios"
					anchor={menu}
					trigger={moreButton}
					onClose={() => setMenu(null)}
					items={[
						...(editable
							? ([
									{
										label: '새 폴더',
										icon: 'fa-solid fa-folder-plus',
										disabled: !edit.admin || !canCreateIn(editable),
										onSelect: () => edit.newFolder(editable),
									},
									...(upload
										? [
												{
													label: upload.folder === PICTURES_DOCUMENT_FOLDER ? '사진 올리기' : '파일 올리기',
													icon: 'fa-solid fa-arrow-up-from-bracket',
													disabled: !edit.admin,
													onSelect: () => picker.current?.click(),
												},
											]
										: []),
									...(edit.admin ? [] : (['separator', { note: ADMIN_ONLY_NOTE }] satisfies MenuItem[])),
									'separator',
								] satisfies MenuItem[])
							: []),
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

			{itemMenu && (
				<Menu
					label={itemMenu.item.name}
					variant="ios"
					anchor={{ x: itemMenu.x, y: itemMenu.y }}
					onClose={() => setItemMenu(null)}
					items={itemMenuItems}
				/>
			)}
			{/* 사진·파일 올리기 (••• › 올리기): 고른 파일을 이 폴더에 */}
			{edit.admin && editable && upload && (
				<input
					ref={picker}
					type="file"
					multiple
					hidden
					accept={upload.folder === PICTURES_DOCUMENT_FOLDER ? 'image/*' : undefined}
					aria-label="올릴 파일"
					onChange={(event) => {
						const files = [...(event.target.files ?? [])];
						event.target.value = '';
						if (files.length) void uploadInto(locations, editable.id, files);
					}}
				/>
			)}
			{edit.dialog}
		</div>
	);
};

export default FinderMobile;
