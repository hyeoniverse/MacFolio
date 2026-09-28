import React, { useEffect, useMemo, useState } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import AppWindow from '@/desktop/window/Window';
import MobileNavigation from '@/desktop/window/MobileNavigation';
import { ALL_CATEGORY, filterPosts, formatPostDate, listCategories, type Post } from './posts';
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

/**
 * 메모: 블로그 글을 읽는 공간. macOS 메모 앱처럼 폴더(카테고리) · 글 목록 · 본문 세 칸으로 보여준다.
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

	const categories = useMemo(() => listCategories(posts), [posts]);
	const visible = useMemo(() => filterPosts(posts, category, query), [posts, category, query]);
	// 고른 글이 목록에 없으면(카테고리·검색으로 걸러지면) 목록의 첫 글을 보여준다
	const selected = visible.find((post) => post.slug === selectedSlug) ?? visible[0] ?? null;

	return (
		<AppWindow title="메모" appName="memo">
			{/* 모바일 제목 막대의 뒤로 가기 (iOS처럼 화면마다 하나) */}
			<MobileNavigation
				{...(pane === 'reader'
					? { backLabel: category, onBack: () => setPane('list') }
					: pane === 'list'
						? { backLabel: '폴더', onBack: () => setPane('folders') }
						: {})}
			/>
			<div className="memo-shell">
				<div className={`memo pane-${pane}`} data-nav={nav}>
					<nav className="memo-folders" aria-label="카테고리">
						<h2>
							<i className="fa-brands fa-apple" aria-hidden="true" /> 블로그
						</h2>
						<ul>
							{categories.map((item) => (
								<li key={item.name}>
									<button
										type="button"
										className={`memo-folder ${category === item.name ? 'active' : ''}`}
										aria-current={category === item.name || undefined}
										onClick={() => {
											setCategory(item.name);
											setPane('list');
										}}
									>
										<i className="fa-regular fa-folder" aria-hidden="true" />
										<span>{item.name}</span>
										<span className="memo-count">{item.count}</span>
									</button>
								</li>
							))}
						</ul>
					</nav>

					<section className="memo-list" aria-label="글 목록">
						<button type="button" className="memo-back" onClick={() => setPane('folders')}>
							<i className="fa-solid fa-chevron-left" aria-hidden="true" /> 폴더
						</button>
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
											<i className="fa-regular fa-folder" aria-hidden="true" /> {post.category}
										</span>
									</button>
								</li>
							))}
						</ul>
						{status === 'loading' && <p className="memo-empty">불러오는 중…</p>}
						{status === 'error' && <p className="memo-empty">글을 불러오지 못했습니다.</p>}
						{status === 'ready' && visible.length === 0 && (
							<p className="memo-empty">{query ? '검색 결과가 없습니다.' : '아직 글이 없습니다.'}</p>
						)}
					</section>

					<article className="memo-reader" aria-label={selected ? selected.title : '글'}>
						<button type="button" className="memo-back" onClick={() => setPane('list')}>
							<i className="fa-solid fa-chevron-left" aria-hidden="true" /> {category}
						</button>
						{selected && (
							// 글이 바뀌면 새로 그려서 나타나는 애니메이션이 다시 돈다
							<div key={selected.slug} className="memo-reader-body">
								<p className="memo-reader-date">
									<time dateTime={selected.date}>{formatPostDate(selected.date)}</time> · {selected.category}
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
