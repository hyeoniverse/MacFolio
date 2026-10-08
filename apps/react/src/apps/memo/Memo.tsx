import React, { useEffect, useMemo, useRef, useState } from 'react';
import { collectTags, tagsOf } from './tags';
import {
	EMPTY_TAG_SELECTION,
	isTagSelectionActive,
	matchesTags,
	onlyTag,
	tagSelectionNote,
	tagSelectionTitle,
	type TagSelection,
} from './tagFilter';
import AppWindow from '@/desktop/window/Window';
import MobileNavigation from '@/desktop/window/MobileNavigation';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import {
	adjacentPosts,
	ALL_CATEGORY,
	buildFolderTree,
	filterPosts,
	folderName,
	type FolderNode,
	type AdminPost,
	type Post,
	type PostFilter,
	RECENTLY_DELETED,
	RECENTLY_DELETED_DAYS,
	recentlyDeletedPosts,
	TAG_VIEW,
} from './posts';
import {
	addFolder,
	canMoveFolder,
	moveFolder,
	movePost,
	removeFolder,
	reorderFolders,
	renameFolder,
	setLocked,
	setPinned,
	splitPinned,
} from './organize';
import FolderSidebar, { type DragItem } from './components/FolderSidebar';
import { SortMenu, ToolbarLead, ViewSwitch, type View } from './components/MemoToolbar';
import { sortMenuItems } from './components/sortMenuItems';
import { loadArrangement, saveArrangement, sortBy, type Arrangement } from './arrange';
import Menu from '@/shared/ui/menu/Menu';
import PostWriter, { type PostWriterHandle } from './writer/PostWriter';
import FormatTools from './writer/FormatTools';
import RevisionsPanel from './components/RevisionsPanel';
import SearchField from './components/SearchField';
import FindBar from './components/FindBar';
import { keepFocus, usePopover } from './writer/popover';
import type { PostDraft } from './postsApi';
import { linkedId, setAppAddress, shareLink } from '@/shared/lib/appLink';
import { useOpenRequest } from '@/shared/lib/openRequest';
import ShareIcon from '@/shared/ui/ShareIcon';
import { createPortal } from 'react-dom';
import '@/apps/memo/Memo.css';
import IconButton from '@/shared/ui/button/IconButton';
import TagChips from './components/TagChips';
import MemoMarkdown from './components/MemoMarkdown';
import FolderPickMenu from './components/FolderPickMenu';
import { NewDraftItem, NoteCard, NoteItem, NoteSections } from './components/NoteList';
import PostFooter from './components/PostFooter';
import ReaderBody from './components/ReaderBody';
import { useShellSize } from './useShellSize';
import { useMemoLibrary } from './useMemoLibrary';
import { useTrash } from './useTrash';
import { useMemoAppMenus } from './useMemoAppMenus';
import {
	noteContextItems,
	phoneNoteItems,
	pinLockItems,
	purgeItem,
	removeItem,
	restoreItem,
	type NoteActions,
} from './noteMenus';

/** 본문 문자열을 메모 본문 모양으로 (편집기의 미리 보기, 버전 기록) */
const renderMarkdown = (body: string) => <MemoMarkdown>{body}</MemoMarkdown>;

type Pane = 'folders' | 'list' | 'reader';

/** 새 메모 자리가 접히며 사라지는 시간 (Memo.css의 memo-new-item-out과 같다) */
const NEW_ITEM_LEAVE_MS = 240;

const PANES: Pane[] = ['folders', 'list', 'reader'];

/**
 * 메모: 블로그 글을 읽는 공간. macOS 메모처럼 떠 있는 폴더 사이드바 · 글 목록 · 본문,
 * 또는 갤러리(카드)로 보여준다. 폴더는 글의 category('/'로 하위 폴더)에서 만든다.
 * 방문자는 읽기만 하고, 관리자는 바로 고치고 정리한다 (#9).
 * 글과 정리 내용은 useMemoLibrary, 지우기·최근 삭제된 항목은 useTrash, 목록 칸은 NoteList가 맡는다
 */
const Memo: React.FC = () => {
	const {
		repoPosts,
		adminPosts,
		upsertAdminPost,
		dropAdminPost,
		status,
		canEdit,
		editing,
		today,
		posts,
		organized,
		organization,
		edit,
		views,
	} = useMemoLibrary();
	const [category, setCategory] = useState(ALL_CATEGORY);
	const [query, setQuery] = useState('');
	/** 검색 조건 (체크리스트가 있는 메모 등) */
	const [filter, setFilter] = useState<PostFilter | null>(null);
	/** 찾기 막대를 연 글 (다른 글로 옮겨 가면 닫힌 것으로 본다) */
	const [findSlug, setFindSlug] = useState<string | null>(null);
	/** 휴대폰(모바일 셸) 안인지: 본문을 iOS 메모처럼 떠 있는 단추로 그린다 */
	const phone = useIsMobile();
	/** 휴대폰 본문의 ••• 메뉴를 연 자리 */
	const [phoneMenu, setPhoneMenu] = useState<{ x: number; y: number } | null>(null);
	/** 휴대폰 목록의 ••• 메뉴, 메모 선택(고른 메모들, null = 고르는 중 아님)과 그때의 이동 메뉴 */
	const [listMenu, setListMenu] = useState<{ x: number; y: number } | null>(null);
	const [picked, setPicked] = useState<Set<string> | null>(null);
	const [pickMoveMenu, setPickMoveMenu] = useState<{ x: number; y: number } | null>(null);
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
	/** 갤러리에서 카드를 눌러 글을 연 상태 */
	const [galleryNoteOpen, setGalleryNoteOpen] = useState(false);
	const shellRef = useRef<HTMLDivElement>(null);
	const shellSize = useShellSize(shellRef);
	// 휴대폰 화면에서는 폭과 상관없이 한 칸씩. 모양도 이 값을 따른다 (memo-shell의 data-compact)
	const compact = phone || shellSize.compact;
	const narrow = shellSize.narrow;
	// 한 칸씩 볼 때는 폴더가 따로 한 화면이라 닫지 않는다
	const sidebarOpen = compact || (sidebarChoice ?? !narrow);
	/** 메모 우클릭 메뉴 */
	const [noteMenu, setNoteMenu] = useState<{ slug: string; x: number; y: number } | null>(null);
	/** 끌고 있는 글이나 폴더 */
	const [dragging, setDragging] = useState<DragItem | null>(null);

	const setPane = (next: Pane) => {
		setNav(PANES.indexOf(next) > PANES.indexOf(pane) ? 'forward' : 'back');
		setPaneState(next);
	};

	/** 새 메모에 지금 쓰고 있는 것 (목록 미리 보기) */
	const [newPreview, setNewPreview] = useState<PostDraft | null>(null);
	/** 사라지는 중인 새 메모 자리 (접히는 애니메이션이 끝나면 지운다) */
	const [leavingDraft, setLeavingDraft] = useState<{ key: number; preview: PostDraft | null } | null>(null);
	/** 새 메모를 쓰는 중이면 그 번호 (아직 한 번도 저장하지 않은 메모). 관리자가 아니면 쓰지 않는다 */
	const [newDraftState, setNewDraft] = useState<number | null>(null);
	const newDraft = canEdit ? newDraftState : null;
	/** 새 메모가 처음 저장되면 주소가 생긴다. 그 뒤에도 같은 편집기를 이어 쓰도록 주소 → 편집기 이름을 기억한다 */
	const [writerKeys, setWriterKeys] = useState<Record<string, string>>({});

	const folders = useMemo(
		() => buildFolderTree(organized, organization.folders, organization.order),
		[organized, organization.folders, organization.order]
	);
	/** 최근 삭제된 항목 (관리자): 30일 동안 되살리거나 영구히 지울 수 있다 */
	const inTrash = category === RECENTLY_DELETED;
	const trash = useMemo(
		() => (editing && adminPosts ? recentlyDeletedPosts(repoPosts, adminPosts, today) : []),
		[editing, adminPosts, repoPosts, today]
	);
	/** 본문의 #태그 (사이드바의 태그 묶음, 태그로 보기) */
	const tags = useMemo(() => collectTags(organized), [organized]);
	/** 사이드바에서 고른 태그 (태그마다 미선택 → 포함 → 제외) */
	const [tagSelection, setTagSelection] = useState<TagSelection>(EMPTY_TAG_SELECTION);
	const inTags = category === TAG_VIEW;
	/** 태그로 볼 때는 고른 태그에 맞는 글, 아니면 폴더의 글 */
	const inCategory = useMemo(
		() =>
			inTags
				? filterPosts(organized, ALL_CATEGORY, '').filter((post) => matchesTags(tagsOf(post.body), tagSelection))
				: filterPosts(organized, category, ''),
		[organized, category, inTags, tagSelection]
	);
	/** 목록 위 제목: 폴더 이름, 또는 #태그 / N개의 태그 / 모든 태그 */
	const categoryName = inTags ? tagSelectionTitle(tagSelection) : folderName(category);
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

	/** 태그를 고르면 태그로 보기, 다 풀면 모든 글로 */
	const changeTags = (next: TagSelection) => {
		setTagSelection(next);
		setCategory(isTagSelectionActive(next) ? TAG_VIEW : ALL_CATEGORY);
		setGalleryNoteOpen(false);
		setPane('list');
	};
	// 휴대폰의 태그 화면 (iOS 메모): 칩을 다 풀면 화면을 떠나지 않고 '모든 태그'로 돌아간다
	const changeTagsInView = (next: TagSelection) =>
		changeTags(isTagSelectionActive(next) ? next : { ...next, all: true, tags: {} });

	const selectFolder = (path: string) => {
		// 폴더를 고르면 태그 고르기는 풀린다 (모두/일부 포함은 그대로)
		if (path !== TAG_VIEW) setTagSelection((current) => ({ ...EMPTY_TAG_SELECTION, match: current.match }));
		setCategory(path);
		setGalleryNoteOpen(false);
		setPicked(null);
		setPane('list');
	};

	// Finder에서 글을 열면 모든 글에서 그 글을 본문으로 연다 (shared/lib/openRequest.ts)
	useOpenRequest('memo', (slug) => {
		setTagSelection((current) => ({ ...EMPTY_TAG_SELECTION, match: current.match }));
		setCategory(ALL_CATEGORY);
		setQuery('');
		setFilter(null);
		setGalleryNoteOpen(false);
		setPicked(null);
		setSelectedSlug(slug);
		setPane('reader');
	});

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
		else moveFolderTo(dragging.id, target);
		setDragging(null);
	};

	/** 폴더를 target 폴더 안(모든 글이면 맨 위)으로 옮긴다. 고른 폴더를 옮겼으면 새 경로를 따라간다 */
	const moveFolderTo = (path: string, target: string) => {
		const parent = target === ALL_CATEGORY ? '' : target;
		edit((prev) => moveFolder(prev, path, parent, folderPaths));
		const moved = `${parent ? `${parent}/` : ''}${path.split('/').at(-1)}`;
		if (category === path || category.startsWith(`${path}/`)) setCategory(moved + category.slice(path.length));
	};

	/** 메모 선택: 누를 때마다 넣고 뺀다 */
	const togglePicked = (slug: string) =>
		setPicked((current) => {
			const next = new Set(current);
			if (next.has(slug)) next.delete(slug);
			else next.add(slug);
			return next;
		});
	const pickedPosts = picked ? organized.filter((post) => picked.has(post.slug)) : [];
	/** 고른 메모들을 한 폴더로 옮기고 고르기를 끝낸다 */
	const movePicked = (path: string) => {
		edit((prev) => pickedPosts.reduce((next, post) => movePost(next, post.slug, path), prev));
		setPicked(null);
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

	/** 목록·갤러리의 메모 칸 (고정된 메모 먼저, 날짜별 묶음). 누르면 그 글을 연다 (메모 선택 중이면 넣고 뺀다) */
	const sections = (card: boolean, pinnedTitle: string, className: string) => (
		<NoteSections
			posts={visible}
			pinned={pinnedPosts}
			others={otherPosts}
			flat={inTrash}
			arrangement={arrangement}
			today={today}
			pinnedTitle={pinnedTitle}
			className={className}
			render={(post) => {
				const props = {
					post,
					picked,
					dragging: dragging?.id === post.slug,
					drag: dragPost(post.slug),
					onContextMenu: openNoteMenu(post.slug),
				};
				const open = () => {
					if (picked) return togglePicked(post.slug);
					setSelectedSlug(post.slug);
					leaveNewDraft();
					// 카드: 한 칸씩 볼 때(휴대폰 목록의 갤러리)는 본문 칸으로, 아니면 갤러리 위에 글을 연다
					if (card && !compact) setGalleryNoteOpen(true);
					else setPane('reader');
				};
				return card ? (
					<NoteCard key={post.slug} {...props} onOpen={open} />
				) : (
					<NoteItem
						key={post.slug}
						{...props}
						onOpen={open}
						active={selected?.slug === post.slug && newDraft === null}
						today={today}
					/>
				);
			}}
		/>
	);

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
		else dropAdminPost(slug);
		remountWriter(slug);
	};

	const writerRef = useRef<PostWriterHandle>(null);
	const {
		open: revisionsOpen,
		setOpen: setRevisionsOpen,
		buttonRef: revisionsButton,
		panel: revisionsPanelExit,
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

	/** 목록 맨 위의 새 메모 (쓰는 중, 또는 떠나며 접히는 중) */
	const newDraftItem = (startedAt: number, preview: PostDraft | null, leaving: boolean) => (
		<NewDraftItem
			key={`new-${startedAt}`}
			startedAt={startedAt}
			preview={preview}
			leaving={leaving}
			folder={newFolder}
			onOpen={() => setPane('reader')}
		/>
	);

	const {
		removePost,
		restoreDeleted,
		purgeDeleted,
		emptyTrash,
		alert: trashAlert,
	} = useTrash({
		adminPosts,
		upsertAdminPost,
		dropAdminPost,
		edit,
		trash,
		inTrash,
		onRestored: (slug, folder) => {
			setSelectedSlug(slug);
			selectFolder(folder);
		},
		onTrashGone: () => selectFolder(ALL_CATEGORY),
	});
	/** 메모 하나에 할 수 있는 일 (메뉴들이 함께 쓴다, noteMenus.tsx) */
	const noteActions: NoteActions = {
		togglePin,
		toggleLock,
		remove: (post) => void removePost(post),
		restore: (post) => void restoreDeleted(post),
		purge: (post) => void purgeDeleted(post),
	};

	/** 관리자 도구: 새 메모, 지우기 (고치기는 본문에서 바로 한다) */
	const authorTools = (className: string) =>
		canEdit && (
			<>
				{/* 사이드바가 열려 있으면 새 메모는 사이드바 위쪽에 (한 칸씩 보일 때는 목록 위 검색 칸 옆) */}
				{!sidebarOpen && className === '' && (
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
				{/* 최근 삭제된 메모: 되돌려 놓기·즉시 삭제 아이콘 (본문 위 안내 상자에도 같은 단추) */}
				{selected && inTrash && (
					<>
						<IconButton
							className={className}
							label="되돌려 놓기"
							onClick={() => void restoreDeleted(selected)}
							icon="fa-solid fa-rotate-left"
						/>
						<IconButton
							className={className}
							label="메모 즉시 삭제"
							onClick={() => void purgeDeleted(selected)}
							icon="fa-regular fa-trash-can"
						/>
					</>
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
	const postFooter = (post: Post) => <PostFooter post={post} older={older} newer={newer} onOpen={openAdjacent} />;

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

	/** 편집기를 보이는 중인지 (관리자, 최근 삭제·잠금이 아닌 글이나 새 메모) */
	const writing = editing && !inTrash && (newDraft !== null || (selected !== null && !selected.locked));

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
	const newFolder = category === ALL_CATEGORY || inTags || inTrash ? (folderPaths.at(-1) ?? '기타') : category;
	const openFind = selected ? () => setFindSlug(selected.slug) : null;

	useMemoAppMenus({
		canEdit,
		onNewNote: startNewDraft,
		onFind: openFind,
		view,
		onView: changeView,
		sidebarOpen,
		onToggleSidebar: toggleSidebar,
		inTrash,
		arrangement,
		onArrange: setArrangement,
	});
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
			{canEdit && (
				<IconButton
					className="memo-compact-new"
					label="새 메모"
					onClick={startNewDraft}
					icon="fa-regular fa-pen-to-square"
				/>
			)}
		</div>
	);

	return (
		<AppWindow title="메모" appName="memo" chrome="unified">
			{/* 모바일 제목 막대의 뒤로 가기를 메모 안의 이동에도 쓴다 (한 칸씩 보일 때만: 본문 → 목록 → 폴더 → 홈) */}
			<MobileNavigation
				{...(compact && pane === 'reader'
					? { backLabel: categoryName, onBack: () => setPane('list') }
					: compact && pane === 'list'
						? {
								backLabel: '폴더',
								onBack: () => {
									setPicked(null);
									setPane('folders');
								},
							}
						: {})}
			/>
			{/* 한 칸씩 볼 때의 모양은 Memo.css의 [data-compact] 규칙이 그린다 (휴대폰 화면이거나 메모 칸이 700px 이하) */}
			<div ref={shellRef} className="memo-shell" data-compact={compact || undefined}>
				{trashAlert}
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
						onMoveFolder={moveFolderTo}
						onReorderFolders={(siblings) => edit((prev) => reorderFolders(prev, siblings))}
						dragging={dragging}
						onDragFolder={setDragging}
						canDrop={canDrop}
						onDrop={drop}
						recentlyDeleted={trash.length}
						onEmptyTrash={() => void emptyTrash()}
						tags={tags}
						tagSelection={tagSelection}
						onTagsChange={changeTags}
					/>

					<section className="memo-list" aria-label="글 목록">
						<div className="memo-toolbar">
							<ToolbarLead sidebarOpen={sidebarOpen} onToggleSidebar={toggleSidebar} />
							<div className="memo-toolbar-heading">
								<h2>{categoryName}</h2>
								<p>{inTags && visible.length === 0 ? '메모 없음' : `${visible.length}개의 메모`}</p>
							</div>
						</div>
						<div className="memo-scroll">
							<button type="button" className="memo-back" onClick={() => setPane('folders')}>
								<i className="fa-solid fa-chevron-left" aria-hidden="true" /> 폴더
							</button>
							{/* 휴대폰: iOS 메모처럼 목록 위에 큰 제목 (도구 막대의 제목은 좁은 창에서 숨는다) */}
							<div className="memo-phone-title">
								{/* 휴대폰의 태그 화면은 제목이 늘 '태그'이고, 고른 태그는 아래 칩 줄이 보여 준다 (iOS 메모) */}
								<h2>{phone && inTags ? '태그' : categoryName}</h2>
								<p>{inTags && visible.length === 0 ? '메모 없음' : `${visible.length}개의 메모`}</p>
							</div>
							{phone && inTags && (
								<TagChips
									className="memo-phone-tag-chips"
									label="태그 고르기"
									tags={tags}
									selection={tagSelection}
									onChange={changeTagsInView}
								/>
							)}
							{compactTools}
							{/* 쓰던 새 메모는 최근 삭제된 항목에서는 숨긴다 (모든 글로 돌아가면 다시 보인다) */}
							{!inTrash && (newDraft !== null || leavingDraft) && (
								<ul className="memo-items memo-new-items" aria-label="새 메모">
									{newDraft !== null && newDraftItem(newDraft, newPreview, false)}
									{leavingDraft && newDraftItem(leavingDraft.key, leavingDraft.preview, true)}
								</ul>
							)}
							{inTags && tagSelectionNote(tagSelection) && (
								<p className="memo-trash-banner memo-tag-note">{tagSelectionNote(tagSelection)}</p>
							)}
							{inTrash && (
								<p className="memo-trash-banner">
									지운 메모는 {RECENTLY_DELETED_DAYS}일 동안 여기에 있다가 영구히 지워집니다.
									<span className="memo-trash-drag-hint"> 폴더로 끌어 놓으면 되살아납니다.</span>
								</p>
							)}
							{/* 휴대폰에서 갤러리로 보면 목록 칸에 카드로 (넓은 창의 갤러리 칸은 한 칸씩 볼 때 숨는다) */}
							{/* 폴더·태그·정렬을 바꾸면 목록이 서서히 바뀐다 (감싸는 요소 없이 key로 새로 그린다: 휴대폰 CSS의 인접 선택자가 그대로 맞는다) */}
							<React.Fragment
								key={`${category}|${JSON.stringify(tagSelection)}|${JSON.stringify(arrangement)}|${view}`}
							>
								{phone && compact && view === 'gallery'
									? sections(true, '고정된 메모', 'memo-cards motion-swap')
									: sections(false, '고정됨', 'memo-items motion-swap')}
							</React.Fragment>
							{empty}
						</div>
						{/* 휴대폰: 정렬은 오른쪽 위, 검색 알약과 새 메모는 아래에 뜬다 (넘기는 칸 밖에 두어 늘 제자리) */}
						{phone && compact && (
							<>
								<div className="memo-phone-list-top">
									{picked ? (
										<button type="button" className="memo-phone-pill" onClick={() => setPicked(null)}>
											완료
										</button>
									) : (
										<>
											{sortMenu()}
											<IconButton
												className="memo-phone-list-more"
												label="목록 동작"
												aria-haspopup="menu"
												aria-expanded={listMenu !== null}
												onClick={(event) => {
													const rect = event.currentTarget.getBoundingClientRect();
													setListMenu(listMenu ? null : { x: rect.right - 250, y: rect.bottom + 8 });
												}}
												icon="fa-solid fa-ellipsis"
											/>
										</>
									)}
								</div>
								<div className="memo-phone-bottom memo-list-bottom">
									{picked ? (
										<>
											<button
												type="button"
												className="memo-phone-pill"
												disabled={pickedPosts.length === 0}
												onClick={(event) => {
													const rect = event.currentTarget.getBoundingClientRect();
													setPickMoveMenu({ x: rect.left, y: rect.top - 8 });
												}}
											>
												이동
											</button>
											<span className="memo-pick-count" role="status">
												{pickedPosts.length > 0 ? `${pickedPosts.length}개 선택됨` : '메모 선택'}
											</span>
											<button
												type="button"
												className="memo-phone-pill destructive"
												disabled={pickedPosts.every((post) => post.locked)}
												onClick={() => {
													pickedPosts.filter((post) => !post.locked).forEach((post) => void removePost(post));
													setPicked(null);
												}}
											>
												삭제
											</button>
										</>
									) : (
										<>
											{searchBox('memo-phone-search-field')}
											{canEdit && (
												<IconButton
													className="memo-phone-compose"
													label="새 메모"
													onClick={startNewDraft}
													icon="fa-regular fa-pen-to-square"
												/>
											)}
										</>
									)}
								</div>
								{/* 휴대폰 목록의 ••• 메뉴 (iOS 메모처럼): 갤러리로 보기, 메모 선택, 첨부 파일 보기 */}
								{listMenu && (
									<Menu
										label="목록 동작"
										className="touch"
										anchor={{ x: listMenu.x, y: listMenu.y }}
										onClose={() => setListMenu(null)}
										items={[
											view === 'gallery'
												? { label: '목록으로 보기', icon: 'fa-solid fa-list-ul', onSelect: () => changeView('list') }
												: {
														label: '갤러리로 보기',
														icon: 'fa-solid fa-table-cells-large',
														onSelect: () => changeView('gallery'),
													},
											'separator',
											...(canEdit && !inTrash
												? [
														{
															label: '메모 선택',
															icon: 'fa-regular fa-circle-check',
															onSelect: () => setPicked(new Set()),
														},
													]
												: []),
											{
												label: '첨부 파일 보기',
												icon: 'fa-solid fa-paperclip',
												onSelect: () => setFilter('attachment'),
											},
										]}
									/>
								)}
								{/* 고른 메모들을 옮길 폴더 */}
								{pickMoveMenu && (
									<FolderPickMenu
										anchor={pickMoveMenu}
										paths={folderPaths}
										onClose={() => setPickMoveMenu(null)}
										onPick={movePicked}
									/>
								)}
							</>
						)}
					</section>

					{/* 갤러리는 갤러리로 볼 때만 그린다 (목록과 검색 칸·안내 문구가 겹치지 않게) */}
					{view === 'gallery' && (
						<section className="memo-gallery" aria-label="갤러리">
							<div className="memo-toolbar">
								<ToolbarLead sidebarOpen={sidebarOpen} onToggleSidebar={toggleSidebar} />
								<div className="memo-toolbar-heading">
									<h2>{categoryName}</h2>
									<p>{inTags && visible.length === 0 ? '메모 없음' : `${visible.length}개의 메모`}</p>
								</div>
								{sortMenu()}
								<ViewSwitch view={view} onChange={changeView} />
								{search}
							</div>
							<div className="memo-scroll">
								{sections(true, '고정된 메모', 'memo-cards')}
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
							if (name) changeTags(onlyTag(tagSelection, name));
						}}
					>
						<div className={`memo-toolbar memo-reader-toolbar ${searching ? 'searching' : ''}`}>
							{galleryNoteOpen && (
								<>
									<ToolbarLead sidebarOpen={sidebarOpen} onToggleSidebar={toggleSidebar} />
									{/* 갤러리에서 연 글은 갤러리로 돌아간다 */}
									<IconButton className="memo-gallery-back" onClick={() => setGalleryNoteOpen(false)}>
										<i className="fa-solid fa-chevron-left" aria-hidden="true" /> {categoryName}
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
						{/* 휴대폰: 오른쪽 위에 공유·••• 알약, 아래에 서식 알약과 새 메모 (iOS 메모 본문처럼) */}
						{phone && compact && selected && (
							<div className="memo-phone-top">
								{newDraft === null && !inTrash && shareButton('')}
								<IconButton
									label="메모 동작"
									aria-haspopup="menu"
									aria-expanded={phoneMenu !== null}
									onClick={(event) => {
										const rect = event.currentTarget.getBoundingClientRect();
										setPhoneMenu(phoneMenu ? null : { x: rect.right - 250, y: rect.bottom + 8 });
									}}
									icon="fa-solid fa-ellipsis"
								/>
							</div>
						)}
						{phone && compact && canEdit && (
							<div className="memo-phone-bottom">
								{writing ? (
									<span className="memo-format-tools memo-phone-format">
										<FormatTools />
									</span>
								) : (
									<span />
								)}
								<IconButton
									className="memo-phone-compose"
									label="새 메모"
									onClick={startNewDraft}
									icon="fa-regular fa-pen-to-square"
								/>
							</div>
						)}
						{/* 휴대폰 본문의 ••• 메뉴: 맨 위에 고정·잠그기, 그 아래 찾기·삭제 (iOS 메모처럼) */}
						{phoneMenu && selected && (
							<Menu
								label="메모 동작"
								className="touch"
								anchor={phoneMenu}
								onClose={() => setPhoneMenu(null)}
								items={phoneNoteItems(selected, noteActions, {
									canEdit,
									inTrash,
									newDraft: newDraft !== null,
									onFind: () => setFindSlug(selected.slug),
								})}
							/>
						)}
						<div ref={readerScroll} className="memo-scroll">
							<div className="memo-reader-compact-bar">
								<button type="button" className="memo-back" onClick={() => setPane('list')}>
									<i className="fa-solid fa-chevron-left" aria-hidden="true" /> {categoryName}
								</button>
								{authorTools('compact-only')}
								{pinButton('compact-only')}
								{shareButton('compact-only')}
							</div>
							{writing && (
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
										renderMarkdown={renderMarkdown}
									/>
									{newDraft === null && selected && !selected.status?.draftOnly && postFooter(selected)}
								</div>
							)}
							{(!editing || inTrash || (newDraft === null && selected?.locked)) && selected && (
								// 글이 바뀌면 새로 그려서 나타나는 애니메이션이 다시 돈다. 최근 삭제된 항목의 글과 잠긴 메모는 관리자에게도 읽기 화면
								<ReaderBody
									key={selected.slug}
									post={selected}
									today={today}
									views={views}
									editing={editing}
									footer={!inTrash && postFooter(selected)}
									onRestore={() => void restoreDeleted(selected)}
									onPurge={() => void purgeDeleted(selected)}
									onUnlock={() => toggleLock(selected)}
								/>
							)}
						</div>
					</article>

					{revisionsOpen &&
						editing &&
						selected &&
						createPortal(
							<div
								ref={revisionsPanelExit}
								className="memo-format-panel memo-format-panel-wide"
								role="dialog"
								aria-label="버전 기록"
								style={revisionsPosition}
							>
								<RevisionsPanel
									key={selected.slug}
									slug={selected.slug}
									original={repoPosts.find((item) => item.slug === selected.slug) ?? null}
									renderMarkdown={renderMarkdown}
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
									? [restoreItem(selected, noteActions), purgeItem(selected, noteActions), 'separator' as const]
									: []),
								...(canEdit && selected && !inTrash
									? [...pinLockItems(selected, noteActions), removeItem(selected, noteActions), 'separator' as const]
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
							items={noteContextItems(menuPost, noteActions)}
						/>
					)}
				</div>
				{/* 휴대폰 폴더 화면 아래: iOS 메모처럼 검색 알약(누르면 모든 글에서 찾기)과 새 메모 */}
				{phone && compact && pane === 'folders' && (
					<div className="memo-phone-bottom memo-folders-bottom">
						<button
							type="button"
							className="memo-phone-search"
							onClick={() => {
								selectFolder(ALL_CATEGORY);
								requestAnimationFrame(() =>
									shellRef.current?.querySelector<HTMLInputElement>('.memo-list-bottom .memo-search input')?.focus()
								);
							}}
						>
							<i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
							검색
						</button>
						{canEdit && (
							<IconButton
								className="memo-phone-compose"
								label="새 메모"
								onClick={startNewDraft}
								icon="fa-regular fa-pen-to-square"
							/>
						)}
					</div>
				)}
			</div>
		</AppWindow>
	);
};

export default Memo;
