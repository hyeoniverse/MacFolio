import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown, { type Components, type Options } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { rehypeHighlightCode } from './highlight';
import AppWindow from '@/desktop/window/Window';
import MobileNavigation from '@/desktop/window/MobileNavigation';
import {
	adjacentPosts,
	ALL_CATEGORY,
	buildFolderTree,
	filterPosts,
	firstImage,
	folderName,
	formatPostDate,
	resolveImageSrc,
	type FolderNode,
	type Post,
} from './posts';
import {
	addFolder,
	canMoveFolder,
	discardVisitorOrganization,
	EMPTY_ORGANIZATION,
	loadOrganization,
	moveFolder,
	movePost,
	organizePosts,
	removeFolder,
	renameFolder,
	saveOrganization,
	setPinned,
	splitPinned,
	type Organization,
} from './organize';
import FolderSidebar, { type DragItem } from './components/FolderSidebar';
import { SortMenu, ToolbarLead, ViewSwitch, type View } from './components/MemoToolbar';
import { groupPosts, loadArrangement, saveArrangement, sortBy, type Arrangement } from './arrange';
import ContextMenu from './components/ContextMenu';
import { CONTENT_IMAGES } from './contentImages';
import { useCanEditMemo } from './admin';
import { getPostRepository } from './repository';
import MarkdownImage from './components/MarkdownImage';
import '@/apps/memo/Memo.css';

/** 코드 블록 문법 강조 (highlight.ts) */
const REHYPE_PLUGINS: Options['rehypePlugins'] = [rehypeHighlightCode];

/**
 * 본문 요소 바꾸기. 컴포넌트 밖의 상수여야 한다: 렌더링마다 새 함수를 넘기면
 * react-markdown이 요소를 매번 다시 마운트해서 이미지 크게 보기 같은 상태가 사라진다.
 */
const MARKDOWN_COMPONENTS: Components = {
	// 외부 링크는 새 탭에서 연다
	a: ({ href, children }) => (
		<a href={href} target="_blank" rel="noopener noreferrer">
			{children}
		</a>
	),
	img: ({ src, alt, title }) => (
		<MarkdownImage src={typeof src === 'string' ? src : undefined} alt={alt} title={title} />
	),
};

type Pane = 'folders' | 'list' | 'reader';

/** 이 폭 이하면 한 칸씩 보인다 (Memo.css의 @container (max-width: 600px)와 같아야 한다) */
const COMPACT_WIDTH = 600;

/** 메모가 한 칸씩 보이는지 (컨테이너 폭으로 판단) */
function useCompact(ref: React.RefObject<HTMLElement | null>) {
	const [compact, setCompact] = useState(false);
	useEffect(() => {
		const element = ref.current;
		if (!element) return;
		const observer = new ResizeObserver(([entry]) => setCompact(entry.contentRect.width <= COMPACT_WIDTH));
		observer.observe(element);
		return () => observer.disconnect();
	}, [ref]);
	return compact;
}
const PANES: Pane[] = ['folders', 'list', 'reader'];

/** 폴더 경로를 "개발기 › MacFolio"처럼 */
const folderLabel = (path: string) => path.split('/').join(' › ');

/** 갤러리 카드의 미리보기: 첫 이미지, 없으면 본문 앞부분 */
const CardPreview: React.FC<{ post: Post }> = ({ post }) => {
	const image = resolveImageSrc(firstImage(post.body) ?? undefined, CONTENT_IMAGES);
	return (
		<span className="memo-card-preview" aria-hidden="true">
			{image ? (
				<img src={image} alt="" loading="lazy" />
			) : (
				<span className="memo-card-text">
					<strong>{post.title}</strong>
					{post.summary}
				</span>
			)}
		</span>
	);
};

/**
 * 메모: 블로그 글을 읽는 공간. macOS 메모처럼 떠 있는 폴더 사이드바 · 글 목록 · 본문,
 * 또는 갤러리(카드)로 보여준다. 폴더는 글의 category('/'로 하위 폴더)에서 만들고, 방문자도 폴더를 만들 수 있다.
 * 방문자는 읽기만 하고, 글쓰기는 관리자 로그인(#9) 이후에 붙인다.
 */
const Memo: React.FC = () => {
	const [posts, setPosts] = useState<Post[]>([]);
	const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
	const [category, setCategory] = useState(ALL_CATEGORY);
	const [query, setQuery] = useState('');
	const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
	// 좁은 창에서는 한 칸씩 보여준다 (iOS 메모처럼 폴더 → 목록 → 본문). 넓은 창에서는 쓰지 않는다.
	const [pane, setPaneState] = useState<Pane>('list');
	// 넘어간 방향. 앞으로 가면 오른쪽에서, 뒤로 가면 왼쪽에서 들어온다 (처음에는 애니메이션 없음)
	const [nav, setNav] = useState<'forward' | 'back' | undefined>();
	const [sidebarOpen, setSidebarOpen] = useState(true);
	const [view, setView] = useState<View>('list');
	/** 정렬과 날짜별 묶기. 보기 설정이라 방문자도 바꾸고, 이 브라우저에 저장한다 (arrange.ts) */
	const [arrangement, setArrangementState] = useState<Arrangement>(loadArrangement);
	const setArrangement = (next: Arrangement) => {
		setArrangementState(next);
		saveArrangement(next);
	};
	// 날짜 묶음(오늘, 어제 …)의 기준. 창을 연 날로 고정한다
	const today = useMemo(() => new Date(), []);
	/** 갤러리에서 카드를 눌러 글을 연 상태 */
	const [galleryNoteOpen, setGalleryNoteOpen] = useState(false);
	/** 방문자가 정리한 내용 (만든 폴더, 옮긴 글·폴더). 이 브라우저에 저장한다 */
	// 편집(폴더·옮기기·고정)은 관리자만. 방문자에게는 편집 단추를 보이지 않는다 (admin.ts)
	const canEdit = useCanEditMemo();
	const shellRef = useRef<HTMLDivElement>(null);
	const compact = useCompact(shellRef);
	const [organization, setOrganization] = useState<Organization>(() =>
		canEdit ? loadOrganization() : EMPTY_ORGANIZATION
	);
	/** 메모 우클릭 메뉴 */
	const [noteMenu, setNoteMenu] = useState<{ slug: string; x: number; y: number } | null>(null);
	/** 끌고 있는 글이나 폴더 */
	const [dragging, setDragging] = useState<DragItem | null>(null);

	const setPane = (next: Pane) => {
		setNav(PANES.indexOf(next) > PANES.indexOf(pane) ? 'forward' : 'back');
		setPaneState(next);
	};

	useEffect(() => {
		getPostRepository()
			.list()
			.then((list) => {
				setPosts(list);
				setStatus('ready');
			})
			.catch(() => setStatus('error'));
	}, []);

	useEffect(() => {
		if (canEdit) saveOrganization(organization);
		else discardVisitorOrganization();
	}, [canEdit, organization]);

	// 정리 내용을 겹친 글 (category가 지금 있는 폴더)
	const organized = useMemo(() => organizePosts(posts, organization), [posts, organization]);
	const folders = useMemo(() => buildFolderTree(organized, organization.folders), [organized, organization.folders]);
	const visible = useMemo(
		() => sortBy(filterPosts(organized, category, query), arrangement),
		[organized, category, query, arrangement]
	);
	// 모든 폴더 경로 (폴더를 옮길 때 하위 폴더까지 3단을 넘지 않는지 잰다)
	const folderPaths = useMemo(() => {
		const paths: string[] = [];
		const walk = (nodes: FolderNode[]) =>
			nodes.forEach((node) => {
				paths.push(node.path);
				walk(node.children);
			});
		walk(folders);
		return paths;
	}, [folders]);
	const { pinned: pinnedPosts, others: otherPosts } = splitPinned(visible);
	// 고른 글이 목록에 없으면(카테고리·검색으로 걸러지면) 목록 맨 위의 글(고정된 글 먼저)을 보여준다
	const selected = visible.find((post) => post.slug === selectedSlug) ?? pinnedPosts[0] ?? otherPosts[0] ?? null;
	// 본문 아래의 이전 글·다음 글: 지금 폴더 안에서 날짜 순으로 옆 글 (검색어와 상관없이)
	const { older, newer } = selected
		? adjacentPosts(filterPosts(organized, category, ''), selected.slug)
		: { older: null, newer: null };
	const readerScroll = useRef<HTMLDivElement>(null);
	// 다른 글을 열면 본문 맨 위부터
	useEffect(() => {
		readerScroll.current?.scrollTo?.({ top: 0 });
	}, [selected?.slug]);
	const openAdjacent = (post: Post) => {
		setQuery('');
		setSelectedSlug(post.slug);
	};
	const toggleSidebar = () => setSidebarOpen((open) => !open);

	const selectFolder = (path: string) => {
		setCategory(path);
		setGalleryNoteOpen(false);
		setPane('list');
	};

	// 끌어 놓기: 글은 다른 폴더로, 폴더는 다른 폴더 안(모든 글이면 맨 위)으로
	const canDrop = (target: string) => {
		if (!dragging) return false;
		if (dragging.type === 'post') {
			return target !== ALL_CATEGORY && organized.find((post) => post.slug === dragging.id)?.category !== target;
		}
		return canMoveFolder(dragging.id, target === ALL_CATEGORY ? '' : target, folderPaths);
	};

	const drop = (target: string) => {
		if (!dragging) return;
		if (dragging.type === 'post') setOrganization((prev) => movePost(prev, dragging.id, target));
		else {
			const parent = target === ALL_CATEGORY ? '' : target;
			setOrganization((prev) => moveFolder(prev, dragging.id, parent, folderPaths));
			// 고른 폴더를 옮겼으면 새 경로를 따라간다
			const moved = `${parent ? `${parent}/` : ''}${dragging.id.split('/').at(-1)}`;
			if (category === dragging.id || category.startsWith(`${dragging.id}/`)) {
				setCategory(moved + category.slice(dragging.id.length));
			}
		}
		setDragging(null);
	};

	/** 글 목록·갤러리 카드를 끌 때 */
	const dragPost = (slug: string) =>
		canEdit
			? {
					draggable: true,
					onDragStart: (event: React.DragEvent) => {
						event.dataTransfer.effectAllowed = 'move';
						event.dataTransfer.setData('text/plain', slug);
						setDragging({ type: 'post', id: slug });
					},
					onDragEnd: () => setDragging(null),
				}
			: {};

	const changeView = (next: View) => {
		setView(next);
		setGalleryNoteOpen(false);
	};

	const togglePin = (post: Post) => setOrganization((prev) => setPinned(prev, post.slug, !post.pinned));
	const openNoteMenu = (slug: string) =>
		canEdit
			? (event: React.MouseEvent) => {
					event.preventDefault();
					setNoteMenu({ slug, x: event.clientX, y: event.clientY });
				}
			: undefined;
	const menuPost = noteMenu ? organized.find((post) => post.slug === noteMenu.slug) : undefined;

	/**
	 * 고정된 메모를 먼저, 그다음 나머지. 날짜별로 묶으면 나머지를 오늘·어제·지난 7일… 묶음으로 나눈다.
	 * 묶지 않을 때는 고정된 메모가 있을 때만 '메모' 묶음 이름을 단다.
	 */
	const sections = (render: (post: Post) => React.ReactNode, pinnedTitle: string, className: string) => {
		const groups = groupPosts(otherPosts, arrangement, today);
		const grouped = groups.some((group) => group.title !== null);
		return (
			<>
				{pinnedPosts.length > 0 && (
					<>
						<h3 className="memo-section-title">
							<i className="fa-solid fa-thumbtack" aria-hidden="true" /> {pinnedTitle}
						</h3>
						<ul className={className} aria-label={pinnedTitle}>
							{pinnedPosts.map(render)}
						</ul>
					</>
				)}
				{grouped ? (
					groups.map((group) => (
						<React.Fragment key={group.title}>
							<h3 className="memo-section-title">{group.title}</h3>
							<ul className={className} aria-label={group.title ?? undefined}>
								{group.posts.map(render)}
							</ul>
						</React.Fragment>
					))
				) : (
					<>
						{pinnedPosts.length > 0 && otherPosts.length > 0 && <h3 className="memo-section-title">메모</h3>}
						{(pinnedPosts.length === 0 || otherPosts.length > 0) && (
							<ul className={className}>{otherPosts.map(render)}</ul>
						)}
					</>
				)}
			</>
		);
	};

	const listItem = (post: Post) => (
		<li key={post.slug}>
			<button
				type="button"
				className={`memo-item ${selected?.slug === post.slug ? 'active' : ''} ${dragging?.id === post.slug ? 'dragging' : ''}`}
				{...dragPost(post.slug)}
				aria-current={selected?.slug === post.slug || undefined}
				onContextMenu={openNoteMenu(post.slug)}
				onClick={() => {
					setSelectedSlug(post.slug);
					setPane('reader');
				}}
			>
				<strong>{post.title}</strong>
				<span className="memo-item-meta">
					<time dateTime={post.date}>{formatPostDate(post.date)}</time> {post.summary}
				</span>
				<span className="memo-item-folder">
					<i className="fa-regular fa-folder" aria-hidden="true" /> {folderName(post.category)}
				</span>
			</button>
		</li>
	);

	const card = (post: Post) => (
		<li key={post.slug}>
			<button
				type="button"
				className={`memo-card ${dragging?.id === post.slug ? 'dragging' : ''}`}
				{...dragPost(post.slug)}
				onContextMenu={openNoteMenu(post.slug)}
				onClick={() => {
					setSelectedSlug(post.slug);
					setGalleryNoteOpen(true);
				}}
			>
				<span className="memo-card-frame">
					<CardPreview post={post} />
					{post.pinned && (
						<span className="memo-card-pin" aria-label="고정됨">
							<i className="fa-solid fa-thumbtack" aria-hidden="true" />
						</span>
					)}
				</span>
				<strong>{post.title}</strong>
				<time dateTime={post.date}>{formatPostDate(post.date)}</time>
			</button>
		</li>
	);

	/** 본문의 고정 단추 */
	const pinButton = (className: string) =>
		canEdit &&
		selected && (
			<button
				type="button"
				className={`memo-tool memo-pin ${selected.pinned ? 'on' : ''} ${className}`}
				aria-label={selected.pinned ? '메모 고정 해제' : '메모 고정'}
				aria-pressed={Boolean(selected.pinned)}
				title={selected.pinned ? '메모 고정 해제' : '메모 고정'}
				onClick={() => togglePin(selected)}
			>
				<i className="fa-solid fa-thumbtack" aria-hidden="true" />
			</button>
		);

	const empty = (
		<>
			{status === 'loading' && <p className="memo-empty">불러오는 중…</p>}
			{status === 'error' && <p className="memo-empty">글을 불러오지 못했습니다.</p>}
			{status === 'ready' && visible.length === 0 && (
				<p className="memo-empty">{query ? '검색 결과가 없습니다.' : '메모 없음'}</p>
			)}
		</>
	);

	const searchBox = (className = '') => (
		<label className={`memo-search ${className}`}>
			<i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
			<input
				type="search"
				placeholder="검색"
				aria-label="글 검색"
				value={query}
				onChange={(event) => setQuery(event.target.value)}
			/>
		</label>
	);
	const sortMenu = () => <SortMenu arrangement={arrangement} onChange={setArrangement} />;
	// 검색 칸은 늘 창 오른쪽 위(도구 막대 끝)에 있다. 좁은 창에서는 도구 막대가 없으므로 목록 위에 정렬 단추와 함께 둔다
	const search = searchBox();
	const compactTools = (
		<div className="memo-compact-tools compact-only">
			{searchBox()}
			{sortMenu()}
		</div>
	);

	return (
		<AppWindow title="메모" appName="memo" chrome="unified">
			{/* 모바일 제목 막대의 뒤로 가기를 메모 안의 이동에도 쓴다 (한 칸씩 보일 때만: 본문 → 목록 → 폴더 → 홈) */}
			<MobileNavigation
				{...(compact && pane === 'reader'
					? { backLabel: folderName(category), onBack: () => setPane('list') }
					: compact && pane === 'list'
						? { backLabel: '폴더', onBack: () => setPane('folders') }
						: {})}
			/>
			<div ref={shellRef} className="memo-shell">
				<div
					className={`memo pane-${pane} view-${view} ${galleryNoteOpen ? 'gallery-note' : ''} ${sidebarOpen ? '' : 'sidebar-closed'}`}
					data-nav={nav}
				>
					<FolderSidebar
						canEdit={canEdit}
						open={sidebarOpen}
						onToggle={toggleSidebar}
						folders={folders}
						total={posts.length}
						current={category}
						onSelect={selectFolder}
						onAddFolder={(parent, name) => {
							setOrganization((prev) => addFolder(prev, parent, name));
							selectFolder(parent ? `${parent}/${name}` : name);
						}}
						onRenameFolder={(path, name) => {
							setOrganization((prev) => renameFolder(prev, path, name));
							// 고른 폴더(또는 그 안)의 이름이 바뀌면 새 경로를 따라간다
							if (category === path || category.startsWith(`${path}/`)) {
								const renamed = [...path.split('/').slice(0, -1), name].join('/');
								setCategory(renamed + category.slice(path.length));
							}
						}}
						onRemoveFolder={(path) => {
							setOrganization((prev) => removeFolder(prev, path));
							if (category === path || category.startsWith(`${path}/`)) selectFolder(ALL_CATEGORY);
						}}
						dragging={dragging}
						onDragFolder={setDragging}
						canDrop={canDrop}
						onDrop={drop}
					/>

					<section className="memo-list" aria-label="글 목록">
						<div className="memo-toolbar">
							<ToolbarLead sidebarOpen={sidebarOpen} onToggleSidebar={toggleSidebar} />
							<div className="memo-toolbar-heading">
								<h2>{folderName(category)}</h2>
								<p>{visible.length}개의 메모</p>
							</div>
						</div>
						<div className="memo-scroll">
							<button type="button" className="memo-back" onClick={() => setPane('folders')}>
								<i className="fa-solid fa-chevron-left" aria-hidden="true" /> 폴더
							</button>
							{compactTools}
							{sections(listItem, '고정됨', 'memo-items')}
							{empty}
						</div>
					</section>

					{/* 갤러리는 갤러리로 볼 때만 그린다 (목록과 검색 칸·안내 문구가 겹치지 않게) */}
					{view === 'gallery' && (
						<section className="memo-gallery" aria-label="갤러리">
							<div className="memo-toolbar">
								<ToolbarLead sidebarOpen={sidebarOpen} onToggleSidebar={toggleSidebar} />
								<div className="memo-toolbar-heading">
									<h2>{folderName(category)}</h2>
									<p>{visible.length}개의 메모</p>
								</div>
								{sortMenu()}
								<ViewSwitch view={view} onChange={changeView} />
								{search}
							</div>
							<div className="memo-scroll">
								{sections(card, '고정된 메모', 'memo-cards')}
								{empty}
							</div>
						</section>
					)}

					<article className="memo-reader" aria-label={selected ? selected.title : '글'}>
						<div className="memo-toolbar memo-reader-toolbar">
							{galleryNoteOpen && (
								<>
									<ToolbarLead sidebarOpen={sidebarOpen} onToggleSidebar={toggleSidebar} />
									{/* 갤러리에서 연 글은 갤러리로 돌아간다 */}
									<button
										type="button"
										className="memo-tool memo-gallery-back"
										onClick={() => setGalleryNoteOpen(false)}
									>
										<i className="fa-solid fa-chevron-left" aria-hidden="true" /> {folderName(category)}
									</button>
								</>
							)}
							<span className="memo-toolbar-spacer" />
							{pinButton('')}
							{/* 정렬·보기 방식은 늘 검색 칸 왼쪽 (사이드바를 여닫아도 움직이지 않는다) */}
							{sortMenu()}
							<ViewSwitch view={view} onChange={changeView} />
							{search}
						</div>
						<div ref={readerScroll} className="memo-scroll">
							<div className="memo-reader-compact-bar">
								<button type="button" className="memo-back" onClick={() => setPane('list')}>
									<i className="fa-solid fa-chevron-left" aria-hidden="true" /> {folderName(category)}
								</button>
								{pinButton('compact-only')}
							</div>
							{selected && (
								// 글이 바뀌면 새로 그려서 나타나는 애니메이션이 다시 돈다
								<div key={selected.slug} className="memo-reader-body">
									<p className="memo-reader-date">
										<time dateTime={selected.date}>{formatPostDate(selected.date)}</time> ·{' '}
										{folderLabel(selected.category)}
									</p>
									<h1>{selected.title}</h1>
									<div className="memo-markdown">
										<ReactMarkdown
											remarkPlugins={[remarkGfm]}
											rehypePlugins={REHYPE_PLUGINS}
											components={MARKDOWN_COMPONENTS}
										>
											{selected.body}
										</ReactMarkdown>
									</div>
									{(older || newer) && (
										<nav className="memo-post-nav" aria-label="이전 글, 다음 글">
											{older ? (
												<button type="button" className="older" onClick={() => openAdjacent(older)}>
													<span>
														<i className="fa-solid fa-chevron-left" aria-hidden="true" /> 이전 글
													</span>
													<strong>{older.title}</strong>
												</button>
											) : (
												<span />
											)}
											{newer && (
												<button type="button" className="newer" onClick={() => openAdjacent(newer)}>
													<span>
														다음 글 <i className="fa-solid fa-chevron-right" aria-hidden="true" />
													</span>
													<strong>{newer.title}</strong>
												</button>
											)}
										</nav>
									)}
								</div>
							)}
						</div>
					</article>

					{noteMenu && menuPost && (
						<ContextMenu
							label={`${menuPost.title} 메뉴`}
							anchor={noteMenu}
							onClose={() => setNoteMenu(null)}
							items={[
								{
									label: menuPost.pinned ? '메모 고정 해제' : '메모 고정',
									icon: 'fa-solid fa-thumbtack',
									onSelect: () => togglePin(menuPost),
								},
							]}
						/>
					)}
				</div>
			</div>
		</AppWindow>
	);
};

export default Memo;
