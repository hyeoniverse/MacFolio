import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown, { type Components, type Options } from 'react-markdown';
import { REMARK_PLUGINS } from './markdownPlugins';
import { collectTags, sameTag, tagsOf } from './tags';
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
	mergeAdminPosts,
	mergeServerPosts,
	formatPostDate,
	excerpt,
	resolveImageSrc,
	type FolderNode,
	type AdminPost,
	type Post,
	type PostFilter,
	type ServerPost,
	RECENTLY_DELETED,
	RECENTLY_DELETED_DAYS,
	daysUntilPurge,
	recentlyDeletedPosts,
	TAG_PREFIX,
	tagOfCategory,
} from './posts';
import {
	addFolder,
	canMoveFolder,
	discardVisitorOrganization,
	EMPTY_ORGANIZATION,
	moveFolder,
	movePost,
	organizePosts,
	removeFolder,
	renameFolder,
	setLocked,
	setPinned,
	splitPinned,
	type Organization,
} from './organize';
import FolderSidebar, { type DragItem } from './components/FolderSidebar';
import { SortMenu, ToolbarLead, ViewSwitch, type View } from './components/MemoToolbar';
import { sortMenuItems } from './components/sortMenuItems';
import { groupPosts, loadArrangement, saveArrangement, sortBy, type Arrangement } from './arrange';
import Menu from '@/shared/ui/menu/Menu';
import { CONTENT_IMAGES } from './contentImages';
import { useCanEditMemo } from './admin';
import { useAppState } from '@/desktop/AppStateContext';
import { foregroundApp } from '@/desktop/appStack';
import { fetchOrganization, saveOrganization } from './organizationApi';
import { env } from '@/shared/config/env';
import { notify } from '@/desktop/notifications/notificationStore';
import { getPostRepository } from './repository';
import MarkdownImage from './components/MarkdownImage';
import CodeBlock from './components/CodeBlock';
import Comments from './comments/Comments';
import PostWriter, { type PostWriterHandle } from './writer/PostWriter';
import FormatTools from './writer/FormatTools';
import RevisionsPanel from './components/RevisionsPanel';
import SearchField from './components/SearchField';
import FindBar from './components/FindBar';
import { keepFocus, usePopover } from './writer/popover';
import { deletePost, fetchAdminPosts, fetchServerPosts, purgePost, restorePost, type PostDraft } from './postsApi';
import { linkedId, setAppAddress, shareLink } from '@/shared/lib/appLink';
import ShareIcon from '@/shared/ui/ShareIcon';
import { createPortal } from 'react-dom';
import '@/apps/memo/Memo.css';
import IconButton from '@/shared/ui/button/IconButton';
import Button from '@/shared/ui/button/Button';

/** 코드 블록 문법 강조 (highlight.ts) */
const REHYPE_PLUGINS: Options['rehypePlugins'] = [rehypeHighlightCode];

/**
 * 본문 요소 바꾸기. 컴포넌트 밖의 상수여야 한다: 렌더링마다 새 함수를 넘기면
 * react-markdown이 요소를 매번 다시 마운트해서 이미지 크게 보기 같은 상태가 사라진다.
 */
const MARKDOWN_COMPONENTS: Components = {
	// 외부 링크는 새 탭에서 연다
	a: ({ href, title, children }) => (
		<a href={href} title={title} target="_blank" rel="noopener noreferrer">
			{children}
		</a>
	),
	pre: ({ node: _node, ...props }) => <CodeBlock {...props} />,
	img: ({ src, alt, title }) => (
		<MarkdownImage src={typeof src === 'string' ? src : undefined} alt={alt} title={title} />
	),
};

type Pane = 'folders' | 'list' | 'reader';

/** 새 메모 자리가 접히며 사라지는 시간 (Memo.css의 memo-new-item-out과 같다) */
const NEW_ITEM_LEAVE_MS = 240;

/**
 * 이 폭 이하면 한 칸씩 보인다 (Memo.css의 @container (max-width: 700px)와 같아야 한다).
 * 폴더·목록·본문 세 칸을 나란히 두기에 700px보다 좁으면 본문이 너무 좁아진다
 */
const COMPACT_WIDTH = 700;

/** 메모가 한 칸씩 보이는지 (컨테이너 폭으로 판단) */
/** 이 폭 이하면 폴더 사이드바를 처음에 닫아 둔다 (macOS 메모처럼). 목록과 본문에 자리를 준다 */
const NARROW_WIDTH = 860;

/** 메모 창의 폭으로 정하는 모양: 한 칸씩(compact), 사이드바를 닫아 둘 만큼 좁음(narrow) */
function useShellSize(ref: React.RefObject<HTMLElement | null>) {
	const [width, setWidth] = useState(Infinity);
	useEffect(() => {
		const element = ref.current;
		if (!element) return;
		const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
		observer.observe(element);
		return () => observer.disconnect();
	}, [ref]);
	return { compact: width <= COMPACT_WIDTH, narrow: width <= NARROW_WIDTH };
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
	/** 저장소의 Markdown 글 */
	const [repoPosts, setRepoPosts] = useState<Post[]>([]);
	/** 방문자용 서버 글 (게시한 글, 지운·예약 표시) */
	const [publicPosts, setPublicPosts] = useState<ServerPost[]>([]);
	/** 관리자용 서버 글 (게시한 내용과 임시 저장). 관리자로 로그인했을 때만 읽는다 */
	const [adminPosts, setAdminPosts] = useState<AdminPost[] | null>(null);
	const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
	const [category, setCategory] = useState(ALL_CATEGORY);
	const [query, setQuery] = useState('');
	/** 검색 조건 (체크리스트가 있는 메모 등) */
	const [filter, setFilter] = useState<PostFilter | null>(null);
	/** 찾기 막대를 연 글 (다른 글로 옮겨 가면 닫힌 것으로 본다) */
	const [findSlug, setFindSlug] = useState<string | null>(null);
	/** 검색 칸에 초점이 있는지, 도구를 모은 ••• 메뉴 (검색하는 동안 다른 도구를 접고 검색 칸을 넓힌다) */
	const [searchFocused, setSearchFocused] = useState(false);
	const [moreMenu, setMoreMenu] = useState<{ x: number; y: number } | null>(null);
	const searching = searchFocused || moreMenu !== null;
	// 글 주소(/memo/<글>)로 들어왔으면 그 글부터 (shared/lib/appLink.ts)
	const [selectedSlug, setSelectedSlug] = useState<string | null>(() => linkedId('memo'));
	// 좁은 창에서는 한 칸씩 보여준다 (iOS 메모처럼 폴더 → 목록 → 본문). 넓은 창에서는 쓰지 않는다.
	// 글 주소로 들어왔으면 본문부터
	const [pane, setPaneState] = useState<Pane>(() => (linkedId('memo') ? 'reader' : 'list'));
	// 넘어간 방향. 앞으로 가면 오른쪽에서, 뒤로 가면 왼쪽에서 들어온다 (처음에는 애니메이션 없음)
	const [nav, setNav] = useState<'forward' | 'back' | undefined>();
	/** 사용자가 사이드바를 직접 열거나 닫았으면 그 값, 아니면 창 폭으로 정한다 */
	const [sidebarChoice, setSidebarChoice] = useState<boolean | null>(null);
	const [view, setView] = useState<View>('list');
	/** 정렬과 날짜별 묶기. 보기 설정이라 방문자도 바꾸고, 이 브라우저에 저장한다 (arrange.ts) */
	const [arrangement, setArrangementState] = useState<Arrangement>(loadArrangement);
	const setArrangement = (next: Arrangement) => {
		setArrangementState(next);
		saveArrangement(next);
	};
	// 날짜 묶음(오늘, 어제 …)의 기준. 창을 연 날로 고정한다
	const today = useMemo(() => new Date(), []);
	const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
	/** 갤러리에서 카드를 눌러 글을 연 상태 */
	const [galleryNoteOpen, setGalleryNoteOpen] = useState(false);
	/** 방문자가 정리한 내용 (만든 폴더, 옮긴 글·폴더). 이 브라우저에 저장한다 */
	// 편집(폴더·옮기기·고정)은 관리자만. 방문자에게는 편집 단추를 보이지 않는다 (admin.ts)
	const canEdit = useCanEditMemo();
	const { apps } = useAppState();
	/** 관리자 목록을 읽었으면 편집기로 본다 (읽기 전에는 게시한 내용으로 읽기만) */
	const editing = canEdit && adminPosts !== null;
	// 관리자는 임시 저장까지 보이고, 방문자는 게시한 글만 본다
	const posts = useMemo(
		() => (editing ? mergeAdminPosts(repoPosts, adminPosts, todayIso) : mergeServerPosts(repoPosts, publicPosts)),
		[editing, repoPosts, adminPosts, publicPosts, todayIso]
	);
	const shellRef = useRef<HTMLDivElement>(null);
	const { compact, narrow } = useShellSize(shellRef);
	// 한 칸씩 볼 때는 폴더가 따로 한 화면이라 닫지 않는다
	const sidebarOpen = compact || (sidebarChoice ?? !narrow);
	// 관리자가 정리한 내용 (API). 방문자도 같은 정리 내용으로 본다
	const [organization, setOrganization] = useState<Organization>(EMPTY_ORGANIZATION);
	/** 관리자가 방금 바꿔서 아직 저장하지 않았는지 */
	const unsaved = useRef(false);
	/** 메모 우클릭 메뉴 */
	const [noteMenu, setNoteMenu] = useState<{ slug: string; x: number; y: number } | null>(null);
	/** 끌고 있는 글이나 폴더 */
	const [dragging, setDragging] = useState<DragItem | null>(null);

	const setPane = (next: Pane) => {
		setNav(PANES.indexOf(next) > PANES.indexOf(pane) ? 'forward' : 'back');
		setPaneState(next);
	};

	// 저장소의 Markdown 글을 먼저 보여 주고, 서버의 글(관리자가 쓰거나 고친 글)을 겹친다
	useEffect(() => {
		let cancelled = false;
		getPostRepository()
			.list()
			.then(async (list) => {
				if (cancelled) return;
				setRepoPosts(list);
				setStatus('ready');
				const server = await fetchServerPosts(env.apiUrl);
				if (!cancelled && server.length > 0) setPublicPosts(server);
			})
			.catch(() => setStatus('error'));
		return () => {
			cancelled = true;
		};
	}, []);

	// 관리자로 로그인하면 임시 저장까지 읽는다
	useEffect(() => {
		if (!canEdit) return;
		let cancelled = false;
		fetchAdminPosts(env.apiUrl).then((loaded) => {
			if (!cancelled && loaded) setAdminPosts(loaded);
		});
		return () => {
			cancelled = true;
		};
	}, [canEdit]);

	/** 새 메모에 지금 쓰고 있는 것 (목록 미리 보기) */
	const [newPreview, setNewPreview] = useState<PostDraft | null>(null);
	/** 사라지는 중인 새 메모 자리 (접히는 애니메이션이 끝나면 지운다) */
	const [leavingDraft, setLeavingDraft] = useState<{ key: number; preview: PostDraft | null } | null>(null);
	/** 새 메모를 쓰는 중이면 그 번호 (아직 한 번도 저장하지 않은 메모). 관리자가 아니면 쓰지 않는다 */
	const [newDraftState, setNewDraft] = useState<number | null>(null);
	const newDraft = canEdit ? newDraftState : null;
	/** 새 메모가 처음 저장되면 주소가 생긴다. 그 뒤에도 같은 편집기를 이어 쓰도록 주소 → 편집기 이름을 기억한다 */
	const [writerKeys, setWriterKeys] = useState<Record<string, string>>({});

	// 예전에 방문자 브라우저에 저장된 정리 내용은 지우고, 서버의 정리 내용을 읽는다
	useEffect(() => {
		discardVisitorOrganization();
		let cancelled = false;
		fetchOrganization(env.apiUrl).then((loaded) => {
			if (!cancelled && !unsaved.current) setOrganization(loaded);
		});
		return () => {
			cancelled = true;
		};
	}, []);

	// 관리자가 바꾸면 바로 서버에 저장한다 (편집은 폴더 만들기·옮기기·고정처럼 한 번씩 누르는 동작이라 모아 보낼 필요가 없다).
	// 연달아 바꾸면 요청이 뒤바뀌어 도착하지 않도록 차례로 보낸다. 실패하면 알리고 서버 내용으로 되돌린다
	const saveQueue = useRef<Promise<void>>(Promise.resolve());
	useEffect(() => {
		if (!unsaved.current || !canEdit) return;
		unsaved.current = false;
		const snapshot = organization;
		saveQueue.current = saveQueue.current.then(async () => {
			if (await saveOrganization(env.apiUrl, snapshot)) return;
			notify({ app: 'memo', title: '저장하지 못함', body: '메모 정리를 저장하지 못했습니다. 다시 로그인해 주세요.' });
			setOrganization(await fetchOrganization(env.apiUrl));
		});
	}, [canEdit, organization]);

	/** 관리자의 편집: 화면에 바로 반영하고 서버에 저장한다 */
	const edit = (update: (prev: Organization) => Organization) => {
		unsaved.current = true;
		setOrganization(update);
	};

	// 정리 내용을 겹친 글 (category가 지금 있는 폴더)
	const organized = useMemo(() => organizePosts(posts, organization), [posts, organization]);
	const folders = useMemo(() => buildFolderTree(organized, organization.folders), [organized, organization.folders]);
	/** 최근 삭제된 항목 (관리자): 30일 동안 되살리거나 영구히 지울 수 있다 */
	const inTrash = category === RECENTLY_DELETED;
	const trash = useMemo(
		() => (editing && adminPosts ? recentlyDeletedPosts(repoPosts, adminPosts, today) : []),
		[editing, adminPosts, repoPosts, today]
	);
	/** 본문의 #태그 (사이드바의 태그 묶음, 태그로 보기) */
	const tags = useMemo(() => collectTags(organized), [organized]);
	const tag = tagOfCategory(category);
	/** 태그로 볼 때는 그 태그가 있는 글, 아니면 폴더의 글 */
	const inCategory = useMemo(
		() =>
			tag
				? filterPosts(organized, ALL_CATEGORY, '').filter((post) =>
						tagsOf(post.body).some((name) => sameTag(name, tag))
					)
				: filterPosts(organized, category, ''),
		[organized, category, tag]
	);
	const visible = useMemo(
		() =>
			inTrash
				? filterPosts(trash, ALL_CATEGORY, query)
				: sortBy(
						filterPosts(
							inCategory,
							ALL_CATEGORY,
							query,
							editing ? filter : filter === 'draft' || filter === 'scheduled' ? null : filter
						),
						arrangement
					),
		[inTrash, trash, inCategory, query, filter, editing, arrangement]
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
	const { older, newer } =
		selected && !inTrash ? adjacentPosts(inCategory, selected.slug) : { older: null, newer: null };
	// 주소 막대에 지금 글의 주소를 둔다 (새로 고침하거나 주소를 복사해도 그 글로). 게시하지 않은 글은 주소가 없다.
	// 글을 다 읽어 오기 전에는 그대로 둔다 (글 주소로 들어온 그 글이 아직 없을 수 있다)
	// 주소로 들어왔거나 직접 글을 고른 뒤부터 (처음 보이는 글로 사이트 주소를 덮지 않게)
	const address = selectedSlug !== null && selected && !inTrash && !selected.status?.draftOnly ? selected.slug : null;
	useEffect(() => {
		if (status === 'ready') setAppAddress('memo', address);
	}, [status, address]);
	// 메모 앱을 닫으면 주소가 없다
	useEffect(() => () => setAppAddress('memo', null), []);
	const readerScroll = useRef<HTMLDivElement>(null);
	// 다른 글을 열면 본문 맨 위부터
	useEffect(() => {
		readerScroll.current?.scrollTo?.({ top: 0 });
	}, [selected?.slug]);
	const openAdjacent = (post: Post) => {
		setQuery('');
		setSelectedSlug(post.slug);
	};
	const toggleSidebar = () => setSidebarChoice(!sidebarOpen);

	const selectFolder = (path: string) => {
		setCategory(path);
		setGalleryNoteOpen(false);
		setPane('list');
	};

	// 끌어 놓기: 글은 다른 폴더로(최근 삭제된 항목에 놓으면 지우기), 지운 글은 폴더에 놓으면 되살리기,
	// 폴더는 다른 폴더 안(모든 글이면 맨 위)으로
	const canDrop = (target: string) => {
		if (!dragging) return false;
		if (dragging.type === 'deleted') return target !== RECENTLY_DELETED;
		if (target === RECENTLY_DELETED) {
			return dragging.type === 'post' && !organized.find((post) => post.slug === dragging.id)?.locked;
		}
		if (dragging.type === 'post') {
			return target !== ALL_CATEGORY && organized.find((post) => post.slug === dragging.id)?.category !== target;
		}
		return canMoveFolder(dragging.id, target === ALL_CATEGORY ? '' : target, folderPaths);
	};

	const drop = (target: string) => {
		if (!dragging) return;
		if (dragging.type === 'deleted') {
			const post = trash.find((item) => item.slug === dragging.id);
			if (post) void restoreDeleted(post, target);
		} else if (target === RECENTLY_DELETED) {
			const post = organized.find((item) => item.slug === dragging.id);
			if (post) void removePost(post);
		} else if (dragging.type === 'post') edit((prev) => movePost(prev, dragging.id, target));
		else {
			const parent = target === ALL_CATEGORY ? '' : target;
			edit((prev) => moveFolder(prev, dragging.id, parent, folderPaths));
			// 고른 폴더를 옮겼으면 새 경로를 따라간다
			const moved = `${parent ? `${parent}/` : ''}${dragging.id.split('/').at(-1)}`;
			if (category === dragging.id || category.startsWith(`${dragging.id}/`)) {
				setCategory(moved + category.slice(dragging.id.length));
			}
		}
		setDragging(null);
	};

	/** 글 목록·갤러리 카드를 끌 때 (최근 삭제된 항목의 글은 폴더에 놓아 되살린다) */
	const dragPost = (slug: string) =>
		canEdit
			? {
					draggable: true,
					onDragStart: (event: React.DragEvent) => {
						event.dataTransfer.effectAllowed = 'move';
						event.dataTransfer.setData('text/plain', slug);
						setDragging({ type: inTrash ? 'deleted' : 'post', id: slug });
					},
					onDragEnd: () => setDragging(null),
				}
			: {};

	const changeView = (next: View) => {
		setView(next);
		setGalleryNoteOpen(false);
	};

	const togglePin = (post: Post) => edit((prev) => setPinned(prev, post.slug, !post.pinned));
	/** 잠그면 고치거나 지울 수 없다 (실수로 바꾸지 않게). 다시 눌러 풀면 바로 고칠 수 있다 */
	const toggleLock = (post: Post) => edit((prev) => setLocked(prev, post.slug, !post.locked));
	const openNoteMenu = (slug: string) =>
		canEdit
			? (event: React.MouseEvent) => {
					event.preventDefault();
					setNoteMenu({ slug, x: event.clientX, y: event.clientY });
				}
			: undefined;
	const menuPost = noteMenu ? (inTrash ? trash : organized).find((post) => post.slug === noteMenu.slug) : undefined;

	/**
	 * 고정된 메모를 먼저, 그다음 나머지. 날짜별로 묶으면 나머지를 오늘·어제·지난 7일… 묶음으로 나눈다.
	 * 묶지 않을 때는 고정된 메모가 있을 때만 '메모' 묶음 이름을 단다.
	 */
	const sections = (render: (post: Post) => React.ReactNode, pinnedTitle: string, className: string) => {
		// 최근 삭제된 항목은 묶지 않고 최근에 지운 순서대로
		if (inTrash) return <ul className={className}>{visible.map(render)}</ul>;
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
				className={`memo-item ${selected?.slug === post.slug && newDraft === null ? 'active' : ''} ${dragging?.id === post.slug ? 'dragging' : ''}`}
				{...dragPost(post.slug)}
				aria-current={(selected?.slug === post.slug && newDraft === null) || undefined}
				onContextMenu={openNoteMenu(post.slug)}
				onClick={() => {
					setSelectedSlug(post.slug);
					leaveNewDraft();
					setPane('reader');
				}}
			>
				<strong>
					{post.locked && <i className="fa-solid fa-lock memo-item-lock" role="img" aria-label="잠김" />}
					{post.title}
					{statusBadge(post)}
				</strong>
				<span className="memo-item-meta">
					<time dateTime={post.date}>{formatPostDate(post.date)}</time> {post.summary}
				</span>
				<span className="memo-item-folder">
					<i className="fa-regular fa-folder" aria-hidden="true" /> {folderName(post.category)}
					{post.deletedAt && <span className="memo-item-purge">{daysUntilPurge(post.deletedAt, today)}일 남음</span>}
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
					leaveNewDraft();
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

	const upsertAdminPost = (post: AdminPost) =>
		setAdminPosts((list) => [...(list ?? []).filter((item) => item.slug !== post.slug), post]);

	/** 편집기가 임시 저장·게시할 때마다: 목록에 반영하고, 새 메모였으면 그 글을 고른다 */
	const onWriterSaved = (post: AdminPost) => {
		upsertAdminPost(post);
		if (newDraft !== null) {
			setWriterKeys((keys) => ({ ...keys, [post.slug]: `new-${newDraft}` }));
			setSelectedSlug(post.slug);
			setNewDraft(null);
		}
	};

	/** 편집기를 새로 그린다 (변경 사항을 버렸을 때) */
	const remountWriter = (slug: string) => setWriterKeys((keys) => ({ ...keys, [slug]: `${slug}-${Date.now()}` }));

	/** 변경 사항을 버렸다: 게시한 내용(없으면 저장소 원본)으로. 둘 다 없던 새 메모는 사라진다 */
	const onWriterDiscarded = (slug: string, post: AdminPost | null) => {
		if (post) upsertAdminPost(post);
		else setAdminPosts((list) => (list ?? []).filter((item) => item.slug !== slug));
		remountWriter(slug);
	};

	const writerRef = useRef<PostWriterHandle>(null);
	const {
		open: revisionsOpen,
		setOpen: setRevisionsOpen,
		buttonRef: revisionsButton,
		panelRef: revisionsPanel,
		position: revisionsPosition,
	} = usePopover();

	const startNewDraft = () => {
		// 최근 삭제된 항목에서는 새 메모가 들어갈 자리가 없으므로 모든 글로
		if (inTrash) setCategory(ALL_CATEGORY);
		setQuery('');
		setNewDraft(Date.now());
		setNewPreview(null);
		setPane('reader');
	};

	/** 새 메모를 두고 다른 글로 옮겨 간다: 목록의 새 메모 자리는 접히며 사라진다 (쓴 것이 있으면 편집기가 저장해 진짜 글로 남는다) */
	const leaveNewDraft = () => {
		if (newDraft === null) return;
		const key = newDraft;
		setLeavingDraft({ key, preview: newPreview });
		setTimeout(() => setLeavingDraft((current) => (current?.key === key ? null : current)), NEW_ITEM_LEAVE_MS);
		setNewDraft(null);
	};

	/** 목록 맨 위의 새 메모 (macOS 메모의 '새로운 메모': 쓰는 대로 제목·본문이 보인다) */
	const newDraftItem = (key: number, preview: PostDraft | null, leaving: boolean) => (
		<li key={`new-${key}`} className={`memo-new-item ${leaving ? 'leaving' : ''}`} aria-hidden={leaving || undefined}>
			<button
				type="button"
				className={`memo-item ${leaving ? '' : 'active'}`}
				aria-current={!leaving || undefined}
				tabIndex={leaving ? -1 : undefined}
				onClick={() => setPane('reader')}
			>
				<strong>{preview?.title.trim() || '새로운 메모'}</strong>
				<span className="memo-item-meta">
					<time>{new Intl.DateTimeFormat('ko-KR', { hour: 'numeric', minute: '2-digit' }).format(key)}</time>{' '}
					{(preview && excerpt(preview.body)) || '추가 텍스트 없음'}
				</span>
				<span className="memo-item-folder">
					<i className="fa-regular fa-folder" aria-hidden="true" /> {folderName(preview?.category ?? newFolder)}
				</span>
			</button>
		</li>
	);

	const failed = (title: string) =>
		notify({ app: 'memo', title, body: '관리자 로그인이 끝났거나 서버에 연결할 수 없습니다.' });

	/** 지우기: 묻지 않고 '최근 삭제된 항목'으로 옮긴다 (30일 동안 되살릴 수 있다, macOS 메모처럼) */
	const removePost = async (post: Post) => {
		if (!(await deletePost(env.apiUrl, post.slug))) return failed('지우지 못함');
		const current = adminPosts?.find((item) => item.slug === post.slug);
		upsertAdminPost({
			slug: post.slug,
			published: current?.published ?? null,
			publishedAt: current?.publishedAt ?? null,
			draft: current?.draft ?? null,
			draftUpdatedAt: current?.draftUpdatedAt ?? null,
			deleted: true,
			deletedAt: new Date().toISOString(),
			revisions: current?.revisions ?? 0,
		});
	};

	/**
	 * 최근 삭제된 항목에서 되살린다. 폴더에 끌어 놓았으면 그 폴더로 옮기고 그 폴더를, 아니면 모든 글을 열어 그 글을 보여준다
	 */
	const restoreDeleted = async (post: Post, folder = ALL_CATEGORY) => {
		const result = await restorePost(env.apiUrl, post.slug);
		if (!result.ok) return failed('되살리지 못함');
		if (result.post) upsertAdminPost(result.post);
		else setAdminPosts((list) => (list ?? []).filter((item) => item.slug !== post.slug));
		if (folder !== ALL_CATEGORY && folder !== post.category) edit((prev) => movePost(prev, post.slug, folder));
		setSelectedSlug(post.slug);
		selectFolder(folder);
	};

	/** 최근 삭제된 항목에서 영구히 지운다 (되돌릴 수 없어서 묻는다) */
	const purgeDeleted = async (post: Post) => {
		if (!window.confirm(`'${post.title}' 메모를 영구히 지울까요? 되돌릴 수 없습니다.`)) return;
		if (!(await purgePost(env.apiUrl, post.slug))) return failed('영구히 지우지 못함');
		// 마지막 하나였으면 최근 삭제된 항목이 사라지므로 모든 글로
		if (trash.length <= 1) selectFolder(ALL_CATEGORY);
		const current = adminPosts?.find((item) => item.slug === post.slug);
		if (current)
			upsertAdminPost({
				...current,
				published: null,
				publishedAt: null,
				draft: null,
				draftUpdatedAt: null,
				deletedAt: null,
				revisions: 0,
			});
	};

	/** 게시 상태 표시 (관리자 목록): 게시한 적 없음, 게시하지 않은 편집, 예약 */
	const statusBadge = (post: Post) =>
		post.status &&
		(post.status.draftOnly ? (
			<span className="memo-status-badge draft">임시 저장</span>
		) : post.status.scheduled ? (
			<span className="memo-status-badge scheduled" title={`${formatPostDate(post.status.scheduled)}에 공개`}>
				예약
			</span>
		) : post.status.changed ? (
			<span className="memo-status-dot" role="img" aria-label="게시하지 않은 변경" title="게시하지 않은 변경" />
		) : null);

	/** 관리자 도구: 새 메모, 지우기 (고치기는 본문에서 바로 한다) */
	const authorTools = (className: string) =>
		canEdit && (
			<>
				{/* 사이드바가 열려 있으면 새 메모는 사이드바 위쪽에 (좁은 창의 한 칸 보기에서는 여기) */}
				{(!sidebarOpen || className === 'compact-only') && (
					<IconButton
						className={className}
						label="새 메모"
						onClick={startNewDraft}
						icon="fa-regular fa-pen-to-square"
					/>
				)}
				{/* 본문 서식 (편집기가 열려 있을 때만) */}
				<span className={`memo-format-tools ${className}`}>
					<FormatTools />
				</span>
				{editing && selected && !inTrash && !selected.locked && newDraft === null && className === '' && (
					<IconButton
						ref={revisionsButton}
						on={revisionsOpen}
						label="버전 기록"
						aria-haspopup="dialog"
						aria-expanded={revisionsOpen}
						onPointerDown={keepFocus}
						onClick={() => setRevisionsOpen((value) => !value)}
						icon="fa-solid fa-clock-rotate-left"
					/>
				)}
				{selected && inTrash && (
					<IconButton
						className={className}
						label="메모 영구 삭제"
						onClick={() => void purgeDeleted(selected)}
						icon="fa-regular fa-trash-can"
					/>
				)}
				{selected && !inTrash && newDraft === null && (
					<IconButton
						className={className}
						label="메모 삭제"
						title={selected.locked ? '잠긴 메모는 지울 수 없습니다' : undefined}
						disabled={selected.locked}
						onClick={() => void removePost(selected)}
						icon="fa-regular fa-trash-can"
					/>
				)}
			</>
		);

	/** 글 아래: 이전 글·다음 글, 댓글 */
	const postFooter = (post: Post) => (
		<>
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
			<Comments slug={post.slug} />
		</>
	);

	/** 본문의 고정 단추 */
	const pinButton = (className: string) =>
		canEdit &&
		selected &&
		!inTrash && (
			<IconButton
				className={`memo-pin ${className}`}
				on={selected.pinned}
				label={selected.pinned ? '메모 고정 해제' : '메모 고정'}
				aria-pressed={Boolean(selected.pinned)}
				onClick={() => togglePin(selected)}
				icon="fa-solid fa-thumbtack"
			/>
		);

	/** 글 공유: 휴대폰은 공유 시트, 그 밖에는 링크 복사 (게시하지 않은 글은 주소가 없어 빼고) */
	const shareButton = (className: string) =>
		selected &&
		!selected.status?.draftOnly && (
			<IconButton
				className={`memo-share ${className}`}
				label="링크 공유"
				onClick={() => void shareLink({ app: 'memo', id: selected.slug }, selected.title)}
			>
				<ShareIcon />
			</IconButton>
		);

	const empty = (
		<>
			{status === 'loading' && <p className="memo-empty">불러오는 중…</p>}
			{status === 'error' && <p className="memo-empty">글을 불러오지 못했습니다.</p>}
			{status === 'ready' && visible.length === 0 && (
				<p className="memo-empty">{query || filter ? '검색 결과가 없습니다.' : '메모 없음'}</p>
			)}
		</>
	);

	/** 새 메모가 들어갈 폴더: 지금 연 폴더 (모든 글·태그·최근 삭제된 항목이면 마지막 폴더) */
	const newFolder = category === ALL_CATEGORY || tag || inTrash ? (folderPaths.at(-1) ?? '기타') : category;
	const openFind = selected ? () => setFindSlug(selected.slug) : null;
	const findTarget = selected?.slug ?? null;
	const memoInFront = foregroundApp(apps) === 'memo';
	// ⌘F: 메모가 맨 앞 창이면 열린 글 안에서 찾기 (브라우저의 페이지 찾기 대신)
	useEffect(() => {
		if (!memoInFront || !findTarget) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 'f') {
				event.preventDefault();
				setFindSlug(findTarget);
			}
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [memoInFront, findTarget]);
	const searchBox = (className = '') => (
		<SearchField
			className={className}
			query={query}
			onQuery={setQuery}
			filter={filter}
			onFilter={setFilter}
			admin={editing}
			onFind={openFind}
			onFocusChange={setSearchFocused}
		/>
	);
	// 최근 삭제된 항목은 늘 최근에 지운 순서라 정렬 단추가 없다
	const sortMenu = () => !inTrash && <SortMenu arrangement={arrangement} onChange={setArrangement} />;
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
						onNewNote={startNewDraft}
						open={sidebarOpen}
						onToggle={toggleSidebar}
						folders={folders}
						total={posts.length}
						current={category}
						onSelect={selectFolder}
						onAddFolder={(parent, name) => {
							edit((prev) => addFolder(prev, parent, name));
							selectFolder(parent ? `${parent}/${name}` : name);
						}}
						onRenameFolder={(path, name) => {
							edit((prev) => renameFolder(prev, path, name));
							// 고른 폴더(또는 그 안)의 이름이 바뀌면 새 경로를 따라간다
							if (category === path || category.startsWith(`${path}/`)) {
								const renamed = [...path.split('/').slice(0, -1), name].join('/');
								setCategory(renamed + category.slice(path.length));
							}
						}}
						onRemoveFolder={(path) => {
							edit((prev) => removeFolder(prev, path));
							if (category === path || category.startsWith(`${path}/`)) selectFolder(ALL_CATEGORY);
						}}
						dragging={dragging}
						onDragFolder={setDragging}
						canDrop={canDrop}
						onDrop={drop}
						recentlyDeleted={trash.length}
						tags={tags}
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
							{/* 쓰던 새 메모는 최근 삭제된 항목에서는 숨긴다 (모든 글로 돌아가면 다시 보인다) */}
							{!inTrash && (newDraft !== null || leavingDraft) && (
								<ul className="memo-items memo-new-items" aria-label="새 메모">
									{newDraft !== null && newDraftItem(newDraft, newPreview, false)}
									{leavingDraft && newDraftItem(leavingDraft.key, leavingDraft.preview, true)}
								</ul>
							)}
							{inTrash && (
								<p className="memo-trash-banner">
									지운 메모는 {RECENTLY_DELETED_DAYS}일 동안 여기에 있다가 영구히 지워집니다.
									<span className="memo-trash-drag-hint"> 폴더로 끌어 놓으면 되살아납니다.</span>
								</p>
							)}
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

					<article
						className="memo-reader"
						aria-label={selected ? selected.title : '글'}
						onClick={(event) => {
							// 읽기 화면의 #태그를 누르면 그 태그의 글만 (편집기 안에서는 커서만 옮긴다)
							const target = (event.target as Element).closest('.memo-tag');
							if (!target || target.closest('.ProseMirror')) return;
							const name = target.getAttribute('data-tag');
							if (name) selectFolder(TAG_PREFIX + name);
						}}
					>
						<div className={`memo-toolbar memo-reader-toolbar ${searching ? 'searching' : ''}`}>
							{galleryNoteOpen && (
								<>
									<ToolbarLead sidebarOpen={sidebarOpen} onToggleSidebar={toggleSidebar} />
									{/* 갤러리에서 연 글은 갤러리로 돌아간다 */}
									<IconButton className="memo-gallery-back" onClick={() => setGalleryNoteOpen(false)}>
										<i className="fa-solid fa-chevron-left" aria-hidden="true" /> {folderName(category)}
									</IconButton>
								</>
							)}
							{canEdit && (
								<span className="memo-admin-chip" title="관리자로 로그인했습니다">
									<i className="fa-solid fa-key" aria-hidden="true" />
									<span>관리자</span>
								</span>
							)}
							<span className="memo-toolbar-spacer" />
							{/* 검색하는 동안 도구는 접히고(••• 메뉴로 모인다) 검색 칸이 왼쪽으로 넓어진다 */}
							<span className="memo-toolbar-tools" inert={searching || undefined}>
								<span className="memo-toolbar-tools-inner">
									{authorTools('')}
									{pinButton('')}
									{/* 편집 중에는 서식 도구로 도구 막대가 꽉 차서 공유는 ••• 메뉴에만 */}
									{!editing && shareButton('')}
									{/* 정렬·보기 방식은 늘 검색 칸 왼쪽 (사이드바를 여닫아도 움직이지 않는다) */}
									{sortMenu()}
									<ViewSwitch view={view} onChange={changeView} />
								</span>
							</span>
							<IconButton
								className="memo-toolbar-more"
								label="도구 더 보기"
								aria-haspopup="menu"
								aria-expanded={moreMenu !== null}
								tabIndex={searching ? undefined : -1}
								// 검색 칸의 초점을 빼앗지 않는다 (누르는 순간 검색 칸이 접히지 않게)
								onPointerDown={(event) => {
									event.preventDefault();
									event.stopPropagation();
								}}
								onClick={(event) => {
									const rect = event.currentTarget.getBoundingClientRect();
									setMoreMenu(moreMenu ? null : { x: rect.left, y: rect.bottom + 6 });
								}}
								icon="fa-solid fa-ellipsis"
							/>
							{search}
						</div>
						{findSlug !== null && findSlug === selected?.slug && (
							<FindBar key={findSlug} editing={editing} readerRoot={readerScroll} onClose={() => setFindSlug(null)} />
						)}
						<div ref={readerScroll} className="memo-scroll">
							<div className="memo-reader-compact-bar">
								<button type="button" className="memo-back" onClick={() => setPane('list')}>
									<i className="fa-solid fa-chevron-left" aria-hidden="true" /> {folderName(category)}
								</button>
								{authorTools('compact-only')}
								{pinButton('compact-only')}
								{shareButton('compact-only')}
							</div>
							{editing && !inTrash && (newDraft !== null || (selected && !selected.locked)) && (
								// 관리자: 따로 편집 단추 없이 바로 고친다 (macOS 메모처럼)
								<div
									key={newDraft !== null ? `new-${newDraft}` : (writerKeys[selected!.slug] ?? selected!.slug)}
									className="memo-reader-body"
								>
									<PostWriter
										ref={writerRef}
										post={newDraft !== null ? null : selected}
										hasPublished={
											newDraft === null &&
											Boolean(selected) &&
											(repoPosts.some((item) => item.slug === selected!.slug) ||
												Boolean(adminPosts?.find((item) => item.slug === selected!.slug)?.published))
										}
										onDiscarded={onWriterDiscarded}
										onDraftChange={newDraft !== null ? setNewPreview : undefined}
										folders={folderPaths}
										defaultFolder={newFolder}
										onSaved={onWriterSaved}
										renderMarkdown={(body) => (
											<ReactMarkdown
												remarkPlugins={REMARK_PLUGINS}
												rehypePlugins={REHYPE_PLUGINS}
												components={MARKDOWN_COMPONENTS}
											>
												{body}
											</ReactMarkdown>
										)}
									/>
									{newDraft === null && selected && !selected.status?.draftOnly && postFooter(selected)}
								</div>
							)}
							{(!editing || inTrash || (newDraft === null && selected?.locked)) && selected && (
								// 글이 바뀌면 새로 그려서 나타나는 애니메이션이 다시 돈다. 최근 삭제된 항목의 글과 잠긴 메모는 관리자에게도 읽기 화면
								<div key={selected.slug} className="memo-reader-body">
									{selected.deletedAt ? (
										<div className="memo-trash-note" role="note">
											<i className="fa-regular fa-trash-can" aria-hidden="true" />
											<p>
												<strong>최근 삭제된 메모</strong>
												{daysUntilPurge(selected.deletedAt, today)}일 뒤에 영구히 지워집니다. 고치려면 먼저 되살리세요.
											</p>
											<Button
												tone="primary"
												icon="fa-solid fa-rotate-left"
												onClick={() => void restoreDeleted(selected)}
											>
												되살리기
											</Button>
										</div>
									) : (
										editing && (
											// 도구 막대는 편집 도구로 꽉 차서, 잠금은 메뉴로 걸고 여기서 푼다
											<p className="memo-locked-note">
												<i className="fa-solid fa-lock" aria-hidden="true" /> 잠긴 메모입니다.
												<button type="button" onClick={() => toggleLock(selected)}>
													잠금 풀기
												</button>
											</p>
										)
									)}
									<p className="memo-reader-date">
										<time dateTime={selected.date}>{formatPostDate(selected.date)}</time> ·{' '}
										{folderLabel(selected.category)}
									</p>
									<h1>{selected.title}</h1>
									<div className="memo-markdown">
										<ReactMarkdown
											remarkPlugins={REMARK_PLUGINS}
											rehypePlugins={REHYPE_PLUGINS}
											components={MARKDOWN_COMPONENTS}
										>
											{selected.body}
										</ReactMarkdown>
									</div>
									{!inTrash && postFooter(selected)}
								</div>
							)}
						</div>
					</article>

					{revisionsOpen &&
						editing &&
						selected &&
						createPortal(
							<div
								ref={revisionsPanel}
								className="memo-format-panel memo-format-panel-wide"
								role="dialog"
								aria-label="버전 기록"
								style={revisionsPosition}
							>
								<RevisionsPanel
									key={selected.slug}
									slug={selected.slug}
									original={repoPosts.find((item) => item.slug === selected.slug) ?? null}
									renderMarkdown={(body) => (
										<ReactMarkdown
											remarkPlugins={REMARK_PLUGINS}
											rehypePlugins={REHYPE_PLUGINS}
											components={MARKDOWN_COMPONENTS}
										>
											{body}
										</ReactMarkdown>
									)}
									onRestore={(content) => {
										writerRef.current?.replaceContent(content);
										setRevisionsOpen(false);
									}}
								/>
							</div>,
							document.body
						)}
					{moreMenu && (
						<Menu
							label="도구 더 보기"
							anchor={moreMenu}
							onClose={() => setMoreMenu(null)}
							items={[
								...(canEdit
									? [{ label: '새 메모', icon: 'fa-regular fa-pen-to-square', onSelect: startNewDraft }]
									: []),
								...(canEdit && selected && inTrash
									? [
											{
												label: '되살리기',
												icon: 'fa-solid fa-rotate-left',
												onSelect: () => void restoreDeleted(selected),
											},
											{
												label: '영구 삭제',
												icon: 'fa-regular fa-trash-can',
												destructive: true,
												onSelect: () => void purgeDeleted(selected),
											},
											'separator' as const,
										]
									: []),
								...(canEdit && selected && !inTrash
									? [
											{
												label: selected.pinned ? '메모 고정 해제' : '메모 고정',
												icon: 'fa-solid fa-thumbtack',
												onSelect: () => togglePin(selected),
											},
											{
												label: selected.locked ? '메모 잠금 해제' : '메모 잠그기',
												icon: selected.locked ? 'fa-solid fa-lock-open' : 'fa-solid fa-lock',
												onSelect: () => toggleLock(selected),
											},
											{
												label: '메모 삭제',
												icon: 'fa-regular fa-trash-can',
												disabled: selected.locked,
												hint: selected.locked ? '잠긴 메모는 지울 수 없습니다' : undefined,
												onSelect: () => void removePost(selected),
											},
											'separator' as const,
										]
									: []),
								...(selected && !inTrash && !selected.status?.draftOnly
									? [
											{
												label: '링크 공유',
												icon: <ShareIcon />,
												onSelect: () => void shareLink({ app: 'memo', id: selected.slug }, selected.title),
											},
											'separator' as const,
										]
									: []),
								...sortMenuItems(arrangement, setArrangement),
								'separator',
								{ heading: '보기' },
								{ label: '목록으로 보기', checked: view === 'list', onSelect: () => changeView('list') },
								{ label: '갤러리로 보기', checked: view === 'gallery', onSelect: () => changeView('gallery') },
							]}
						/>
					)}
					{noteMenu && menuPost && (
						<Menu
							label={`${menuPost.title} 메뉴`}
							anchor={noteMenu}
							onClose={() => setNoteMenu(null)}
							items={
								menuPost.deletedAt
									? [
											{
												label: '되살리기',
												icon: 'fa-solid fa-rotate-left',
												onSelect: () => void restoreDeleted(menuPost),
											},
											'separator',
											{
												label: '영구 삭제',
												icon: 'fa-regular fa-trash-can',
												destructive: true,
												onSelect: () => void purgeDeleted(menuPost),
											},
										]
									: [
											{
												label: menuPost.pinned ? '메모 고정 해제' : '메모 고정',
												icon: 'fa-solid fa-thumbtack',
												onSelect: () => togglePin(menuPost),
											},
											{
												label: menuPost.locked ? '메모 잠금 해제' : '메모 잠그기',
												icon: menuPost.locked ? 'fa-solid fa-lock-open' : 'fa-solid fa-lock',
												onSelect: () => toggleLock(menuPost),
											},
											'separator',
											{
												label: '메모 삭제',
												icon: 'fa-regular fa-trash-can',
												disabled: menuPost.locked,
												hint: menuPost.locked ? '잠긴 메모는 지울 수 없습니다' : undefined,
												onSelect: () => void removePost(menuPost),
											},
										]
							}
						/>
					)}
				</div>
			</div>
		</AppWindow>
	);
};

export default Memo;
