import React, { useEffect, useMemo, useState } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import AppWindow from '@/desktop/window/Window';
import {
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
import { CONTENT_IMAGES } from './contentImages';
import { getPostRepository } from './repository';
import MarkdownImage from './components/MarkdownImage';
import '@/apps/memo/Memo.css';

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
type View = 'list' | 'gallery';

/** 폴더 경로를 "개발기 › MacFolio"처럼 */
const folderLabel = (path: string) => path.split('/').join(' › ');

/** 폴더 트리. 하위 폴더가 있으면 펼침 단추로 여닫는다 */
const FolderTree: React.FC<{
	nodes: FolderNode[];
	depth: number;
	current: string;
	collapsed: Set<string>;
	onToggle: (path: string) => void;
	onSelect: (path: string) => void;
}> = ({ nodes, depth, current, collapsed, onToggle, onSelect }) => (
	<>
		{nodes.map((node) => {
			const open = !collapsed.has(node.path);
			return (
				<li key={node.path}>
					<div className="memo-folder-row" style={{ paddingLeft: depth * 14 }}>
						{node.children.length > 0 ? (
							<button
								type="button"
								className={`memo-disclosure ${open ? 'open' : ''}`}
								aria-label={`하위 폴더 ${open ? '접기' : '펼치기'} (${node.name})`}
								aria-expanded={open}
								onClick={() => onToggle(node.path)}
							>
								<i className="fa-solid fa-chevron-right" aria-hidden="true" />
							</button>
						) : (
							<span className="memo-disclosure" aria-hidden="true" />
						)}
						<button
							type="button"
							className={`memo-folder ${current === node.path ? 'active' : ''}`}
							aria-current={current === node.path || undefined}
							onClick={() => onSelect(node.path)}
						>
							<i className="fa-regular fa-folder" aria-hidden="true" />
							<span>{node.name}</span>
							<span className="memo-count">{node.count}</span>
						</button>
					</div>
					{open && node.children.length > 0 && (
						<ul>
							<FolderTree
								nodes={node.children}
								depth={depth + 1}
								current={current}
								collapsed={collapsed}
								onToggle={onToggle}
								onSelect={onSelect}
							/>
						</ul>
					)}
				</li>
			);
		})}
	</>
);

/** 목록으로 보기 / 갤러리로 보기 (macOS 메모의 도구 막대) */
const ViewSwitch: React.FC<{ view: View; onChange: (view: View) => void }> = ({ view, onChange }) => (
	<div className="memo-view-switch" role="group" aria-label="보기 방식">
		<button
			type="button"
			aria-label="목록으로 보기"
			title="목록으로 보기"
			aria-pressed={view === 'list'}
			onClick={() => onChange('list')}
		>
			<i className="fa-solid fa-list-ul" aria-hidden="true" />
		</button>
		<button
			type="button"
			aria-label="갤러리로 보기"
			title="갤러리로 보기"
			aria-pressed={view === 'gallery'}
			onClick={() => onChange('gallery')}
		>
			<i className="fa-solid fa-table-cells-large" aria-hidden="true" />
		</button>
	</div>
);

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
 * 메모: 블로그 글을 읽는 공간. macOS 메모 앱처럼 폴더 · 글 목록 · 본문 세 칸으로 보여주고,
 * 갤러리로 보기로 바꾸면 글을 카드로 늘어놓는다. 폴더는 글의 category('/'로 하위 폴더)에서 만든다.
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
	// macOS 메모처럼 폴더 사이드바를 여닫는다 (좁은 창에서는 한 칸씩 보이므로 쓰지 않는다)
	const [sidebarOpen, setSidebarOpen] = useState(true);
	const [view, setView] = useState<View>('list');
	/** 갤러리에서 카드를 눌러 글을 연 상태 */
	const [galleryNoteOpen, setGalleryNoteOpen] = useState(false);
	const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

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

	const folders = useMemo(() => buildFolderTree(posts), [posts]);
	const visible = useMemo(() => filterPosts(posts, category, query), [posts, category, query]);
	// 고른 글이 목록에 없으면(카테고리·검색으로 걸러지면) 목록의 첫 글을 보여준다
	const selected = visible.find((post) => post.slug === selectedSlug) ?? visible[0] ?? null;

	const selectFolder = (path: string) => {
		setCategory(path);
		setGalleryNoteOpen(false);
		setPane('list');
	};

	const changeView = (next: View) => {
		setView(next);
		setGalleryNoteOpen(false);
	};

	const empty = (
		<>
			{status === 'loading' && <p className="memo-empty">불러오는 중…</p>}
			{status === 'error' && <p className="memo-empty">글을 불러오지 못했습니다.</p>}
			{status === 'ready' && visible.length === 0 && (
				<p className="memo-empty">{query ? '검색 결과가 없습니다.' : '아직 글이 없습니다.'}</p>
			)}
		</>
	);

	const search = (
		<label className="memo-search">
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

	return (
		<AppWindow title="메모" appName="memo" chrome="unified">
			<div className="memo-shell">
				<div
					className={`memo pane-${pane} view-${view} ${galleryNoteOpen ? 'gallery-note' : ''} ${sidebarOpen ? '' : 'sidebar-closed'}`}
					data-nav={nav}
				>
					<button
						type="button"
						className="memo-sidebar-toggle"
						aria-label={sidebarOpen ? '사이드바 가리기' : '사이드바 보기'}
						aria-expanded={sidebarOpen}
						title={sidebarOpen ? '사이드바 가리기' : '사이드바 보기'}
						onClick={() => setSidebarOpen((open) => !open)}
					>
						{/* SF Symbols의 sidebar.left 모양 */}
						<svg viewBox="0 0 20 16" aria-hidden="true">
							<rect x="1" y="1" width="18" height="14" rx="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
							<line x1="7.5" y1="1.5" x2="7.5" y2="14.5" stroke="currentColor" strokeWidth="1.5" />
							<line x1="3.2" y1="5" x2="5.3" y2="5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
							<line x1="3.2" y1="7.5" x2="5.3" y2="7.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
						</svg>
					</button>

					<nav className="memo-folders" aria-label="카테고리" inert={!sidebarOpen}>
						<h2>
							<i className="fa-brands fa-apple" aria-hidden="true" /> 블로그
						</h2>
						<ul>
							<li>
								<div className="memo-folder-row">
									<span className="memo-disclosure" aria-hidden="true" />
									<button
										type="button"
										className={`memo-folder ${category === ALL_CATEGORY ? 'active' : ''}`}
										aria-current={category === ALL_CATEGORY || undefined}
										onClick={() => selectFolder(ALL_CATEGORY)}
									>
										<i className="fa-regular fa-folder" aria-hidden="true" />
										<span>{ALL_CATEGORY}</span>
										<span className="memo-count">{posts.length}</span>
									</button>
								</div>
							</li>
							<FolderTree
								nodes={folders}
								depth={0}
								current={category}
								collapsed={collapsed}
								onToggle={(path) =>
									setCollapsed((prev) => {
										const next = new Set(prev);
										if (next.has(path)) next.delete(path);
										else next.add(path);
										return next;
									})
								}
								onSelect={selectFolder}
							/>
						</ul>
					</nav>

					<section className="memo-list" aria-label="글 목록">
						<ViewSwitch view={view} onChange={changeView} />
						<button type="button" className="memo-back" onClick={() => setPane('folders')}>
							<i className="fa-solid fa-chevron-left" aria-hidden="true" /> 폴더
						</button>
						{search}
						<ul>
							{visible.map((post) => (
								<li key={post.slug}>
									<button
										type="button"
										className={`memo-item ${selected?.slug === post.slug ? 'active' : ''}`}
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
					</section>

					{/* 갤러리는 갤러리로 볼 때만 그린다 (목록과 검색 칸·안내 문구가 겹치지 않게) */}
					{view === 'gallery' && (
						<section className="memo-gallery" aria-label="갤러리">
							<div className="memo-gallery-bar">
								<h2>{folderName(category)}</h2>
								{search}
								<ViewSwitch view={view} onChange={changeView} />
							</div>
							<ul className="memo-cards">
								{visible.map((post) => (
									<li key={post.slug}>
										<button
											type="button"
											className="memo-card"
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
						</section>
					)}

					<article className="memo-reader" aria-label={selected ? selected.title : '글'}>
						{/* 갤러리에서 연 글은 갤러리로 돌아간다 */}
						<button type="button" className="memo-gallery-back" onClick={() => setGalleryNoteOpen(false)}>
							<i className="fa-solid fa-chevron-left" aria-hidden="true" /> {folderName(category)}
						</button>
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
									<ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
										{selected.body}
									</ReactMarkdown>
								</div>
							</div>
						)}
					</article>
				</div>
			</div>
		</AppWindow>
	);
};

export default Memo;
