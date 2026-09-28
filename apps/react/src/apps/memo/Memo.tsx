import React, { useEffect, useMemo, useState } from 'react';
import ReactMarkdown, { type Components, type Options } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { rehypeHighlightCode } from './highlight';
import AppWindow from '@/desktop/window/Window';
import {
	ALL_CATEGORY,
	buildFolderTree,
	filterPosts,
	firstImage,
	folderName,
	formatPostDate,
	resolveImageSrc,
	type Post,
} from './posts';
import {
	addFolder,
	canMoveFolder,
	loadOrganization,
	moveFolder,
	movePost,
	organizePosts,
	removeFolder,
	renameFolder,
	saveOrganization,
	type Organization,
} from './organize';
import FolderSidebar, { type DragItem } from './components/FolderSidebar';
import { ToolbarLead, ViewSwitch, type View } from './components/MemoToolbar';
import { CONTENT_IMAGES } from './contentImages';
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
	/** 갤러리에서 카드를 눌러 글을 연 상태 */
	const [galleryNoteOpen, setGalleryNoteOpen] = useState(false);
	/** 방문자가 정리한 내용 (만든 폴더, 옮긴 글·폴더). 이 브라우저에 저장한다 */
	const [organization, setOrganization] = useState<Organization>(loadOrganization);
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

	useEffect(() => saveOrganization(organization), [organization]);

	// 정리 내용을 겹친 글 (category가 지금 있는 폴더)
	const organized = useMemo(() => organizePosts(posts, organization), [posts, organization]);
	const folders = useMemo(() => buildFolderTree(organized, organization.folders), [organized, organization.folders]);
	const visible = useMemo(() => filterPosts(organized, category, query), [organized, category, query]);
	// 고른 글이 목록에 없으면(카테고리·검색으로 걸러지면) 목록의 첫 글을 보여준다
	const selected = visible.find((post) => post.slug === selectedSlug) ?? visible[0] ?? null;
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
		return canMoveFolder(dragging.id, target === ALL_CATEGORY ? '' : target);
	};

	const drop = (target: string) => {
		if (!dragging) return;
		if (dragging.type === 'post') setOrganization((prev) => movePost(prev, dragging.id, target));
		else {
			const parent = target === ALL_CATEGORY ? '' : target;
			setOrganization((prev) => moveFolder(prev, dragging.id, parent));
			// 고른 폴더를 옮겼으면 새 경로를 따라간다
			const moved = `${parent ? `${parent}/` : ''}${dragging.id.split('/').at(-1)}`;
			if (category === dragging.id || category.startsWith(`${dragging.id}/`)) {
				setCategory(moved + category.slice(dragging.id.length));
			}
		}
		setDragging(null);
	};

	/** 글 목록·갤러리 카드를 끌 때 */
	const dragPost = (slug: string) => ({
		draggable: true,
		onDragStart: (event: React.DragEvent) => {
			event.dataTransfer.effectAllowed = 'move';
			event.dataTransfer.setData('text/plain', slug);
			setDragging({ type: 'post', id: slug });
		},
		onDragEnd: () => setDragging(null),
	});

	const changeView = (next: View) => {
		setView(next);
		setGalleryNoteOpen(false);
	};

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
	// 검색 칸은 늘 창 오른쪽 위(도구 막대 끝)에 있다. 좁은 창에서는 도구 막대가 없으므로 목록 위에 둔다
	const search = searchBox();
	const compactSearch = searchBox('compact-only');

	return (
		<AppWindow title="메모" appName="memo" chrome="unified">
			<div className="memo-shell">
				<div
					className={`memo pane-${pane} view-${view} ${galleryNoteOpen ? 'gallery-note' : ''} ${sidebarOpen ? '' : 'sidebar-closed'}`}
					data-nav={nav}
				>
					<FolderSidebar
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
							<ViewSwitch view={view} onChange={changeView} />
						</div>
						<div className="memo-scroll">
							<button type="button" className="memo-back" onClick={() => setPane('folders')}>
								<i className="fa-solid fa-chevron-left" aria-hidden="true" /> 폴더
							</button>
							{compactSearch}
							<ul>
								{visible.map((post) => (
									<li key={post.slug}>
										<button
											type="button"
											className={`memo-item ${selected?.slug === post.slug ? 'active' : ''} ${dragging?.id === post.slug ? 'dragging' : ''}`}
											{...dragPost(post.slug)}
											aria-current={selected?.slug === post.slug || undefined}
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
								))}
							</ul>
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
								<ViewSwitch view={view} onChange={changeView} />
								{search}
							</div>
							<div className="memo-scroll">
								<ul className="memo-cards">
									{visible.map((post) => (
										<li key={post.slug}>
											<button
												type="button"
												className={`memo-card ${dragging?.id === post.slug ? 'dragging' : ''}`}
												{...dragPost(post.slug)}
												onClick={() => {
													setSelectedSlug(post.slug);
													setGalleryNoteOpen(true);
												}}
											>
												<CardPreview post={post} />
												<strong>{post.title}</strong>
												<time dateTime={post.date}>{formatPostDate(post.date)}</time>
											</button>
										</li>
									))}
								</ul>
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
							{search}
						</div>
						<div className="memo-scroll">
							<button type="button" className="memo-back" onClick={() => setPane('list')}>
								<i className="fa-solid fa-chevron-left" aria-hidden="true" /> {folderName(category)}
							</button>
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
								</div>
							)}
						</div>
					</article>
				</div>
			</div>
		</AppWindow>
	);
};

export default Memo;
