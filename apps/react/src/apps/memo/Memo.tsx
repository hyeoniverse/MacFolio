import React, { useEffect, useRef, useState } from 'react';

import {
	ALL_CATEGORY,
	EMPTY_TAG_SELECTION,
	isTagSelectionActive,
	keepFolder,
	onlyTag,
	type Post,
	RECENTLY_DELETED_DAYS,
	reorderFolders,
	setLocked,
	setPinned,
	statsOf,
	TAG_VIEW,
	type TagSelection,
	tagSelectionNote,
	postSlug,
} from '@macfolio/desktop-core/memo';
import AppWindow from '@/desktop/window/Window';
import MobileNavigation from '@/desktop/window/MobileNavigation';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import FolderSidebar from './components/FolderSidebar';
import PaneResizer from './components/PaneResizer';
import { savePaneWidth } from './memoStorage';
import { cssVars } from '@/shared/lib/cssVars';
import { SortMenu, ToolbarLead, ViewSwitch } from './components/MemoToolbar';

import Menu from '@/shared/ui/menu/Menu';
import PostWriter, { type PostWriterHandle } from './writer/PostWriter';
import RevisionsPopover from './components/RevisionsPopover';
import MemoSearch from './components/MemoSearch';
import FindBar from './components/FindBar';
import { keepFocus, usePopover } from './writer/usePopover';
import type { PostDraft } from './postsApi';
import { useSecretPost } from './useSecretPost';
import { shareLink } from '@/shared/lib/appLink';
import { useOpenRequest } from '@/shared/lib/openRequest';
import ShareIcon from '@/shared/ui/ShareIcon';
import '@/apps/memo/Memo.css';
import IconButton from '@/shared/ui/button/IconButton';
import TagChips from './components/TagChips';
import MemoMarkdown from './components/MemoMarkdown';
import { NewDraftItem, NoteCard, NoteItem, NoteSections } from './components/NoteList';
import PostFooter from './components/PostFooter';
import ReaderBody from './components/ReaderBody';
import SeriesBox from './components/SeriesBox';
import { useFolderActions } from './useFolderActions';
import { useMemoLayout } from './useMemoLayout';
import { usePickedNotes } from './usePickedNotes';
import TextSizeControl from './components/TextSizeControl';
import { useMemoLibrary } from './useMemoLibrary';
import { useNoteView } from './useNoteView';
import { useNewDraft } from './useNewDraft';
import { useNoteDrag } from './useNoteDrag';
import AuthorTools from './components/AuthorTools';
import ReaderToolbar from './components/ReaderToolbar';
import PhoneListBars from './components/PhoneListBars';
import PhoneReaderBars from './components/PhoneReaderBars';
import PhoneFoldersBar from './components/PhoneFoldersBar';
import { useTrash } from './useTrash';
import { useMemoAppMenus } from './useMemoAppMenus';
import { useMemoNavHistory } from './useMemoNavHistory';
import HistoryNav from './components/HistoryNav';
import { noteContextItems, phoneNoteItems, toolMenuItems, type NoteActions } from './noteMenus';
import Toolbar from '@/shared/ui/toolbar/Toolbar';
import EmptyState from '@/shared/ui/empty-state/EmptyState';
import SimilarResults, { SuggestLine } from './components/SimilarResults';
import SearchEmptyReader from './components/SearchEmptyReader';

/** 본문 문자열을 메모 본문 모양으로 (편집기의 미리 보기, 버전 기록) */
const renderMarkdown = (body: string) => <MemoMarkdown>{body}</MemoMarkdown>;

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
		stats,
		setLikes,
		setCommentCount,
	} = useMemoLibrary();
	const noteView = useNoteView({
		organized,
		organization,
		repoPosts,
		adminPosts,
		editing,
		today,
		ready: status === 'ready',
		stats,
	});
	const {
		category,
		setCategory,
		query,
		setQuery,
		filter,
		setFilter,
		tagSelection,
		setTagSelection,
		arrangement,
		setArrangement,
		setSelectedSlug,
		folders,
		folderPaths,
		inTrash,
		trash,
		tags,
		inTags,
		inPopular,
		popular,
		categoryName,
		visible,
		similar,
		didYouMean,
		searchQuery,
		ranked,
		pinnedPosts,
		otherPosts,
		selected,
		older,
		newer,
		series,
		seriesBySlug,
		seriesList,
		inView,
	} = noteView;
	/** 찾기 막대를 연 글 (다른 글로 옮겨 가면 닫힌 것으로 본다) */
	const [findSlug, setFindSlug] = useState<string | null>(null);
	/** 관리자가 편집 대신 방문자가 보는 읽기 화면으로 보는 중인지 (관리자 표시를 누르면 바뀐다) */
	const [readerView, setReaderView] = useState(false);
	/** 휴대폰(모바일 셸) 안인지: 본문을 iOS 메모처럼 떠 있는 버튼으로 그린다 */
	const phone = useIsMobile();
	/** 검색 칸에 초점이 있는지, 도구를 모은 ••• 메뉴 (검색하는 동안 다른 도구를 접고 검색 칸을 넓힌다) */
	const [searchFocused, setSearchFocused] = useState(false);
	const [moreMenu, setMoreMenu] = useState<{ x: number; y: number } | null>(null);
	const searching = searchFocused || moreMenu !== null;
	const {
		pane,
		nav,
		setPane,
		compact,
		shellRef,
		attachShell,
		memoRef,
		sidebarOpen,
		toggleSidebar,
		sidebarWidth,
		setSidebarWidth,
		listWidth,
		setListWidth,
		resizing,
		setResizing,
		roomFor,
		view,
		changeView,
		galleryNoteOpen,
		setGalleryNoteOpen,
		textScale,
		setTextScale,
	} = useMemoLayout(phone);
	const { picked, setPicked, pickedPosts, togglePicked, movePicked } = usePickedNotes(organized, edit);
	/** 메모 우클릭 메뉴 */
	const [noteMenu, setNoteMenu] = useState<{ slug: string; x: number; y: number } | null>(null);

	const readerScroll = useRef<HTMLDivElement>(null);
	/** 뒤로·앞으로로 연 글의 스크롤 위치 (useMemoNavHistory가 정한다). 없으면 맨 위 */
	const pendingScroll = useRef<number | null>(null);
	// 다른 글을 열면 본문 맨 위부터, 뒤로·앞으로로 돌아온 글은 떠날 때의 위치부터.
	// 편집기·목차처럼 늦게 그려지는 내용이 있으면 높이가 바뀌고, 브라우저의 스크롤 앵커링이 위치를 옮긴다.
	// 그래서 본문이 자리 잡을 동안(약 0.6초, 40프레임) 매 프레임 위치를 다시 맞춘다
	useEffect(() => {
		const scroller = readerScroll.current;
		const top = pendingScroll.current ?? 0;
		pendingScroll.current = null;
		scroller?.scrollTo?.({ top });
		if (!scroller || top === 0) return;
		let frames = 0;
		let frame = 0;
		const retry = () => {
			if (frames++ > 40) return;
			if (Math.abs(scroller.scrollTop - top) > 1) scroller.scrollTo({ top });
			frame = requestAnimationFrame(retry);
		};
		frame = requestAnimationFrame(retry);
		// 그동안 사용자가 직접 스크롤하면 맞추기를 멈춘다
		const stop = () => cancelAnimationFrame(frame);
		scroller.addEventListener('wheel', stop, { passive: true });
		scroller.addEventListener('touchstart', stop, { passive: true });
		return () => {
			stop();
			scroller.removeEventListener('wheel', stop);
			scroller.removeEventListener('touchstart', stop);
		};
	}, [selected?.slug]);
	const openAdjacent = (post: Post) => {
		setQuery('');
		setSelectedSlug(post.slug);
	};
	/** 연재의 다른 편: 지금 보는 폴더·태그에 없는 글이면 모든 글로 바꾼 뒤 연다 */
	const openSeries = (post: Post) => {
		setQuery('');
		if (!inView(post.slug)) setCategory(ALL_CATEGORY);
		setSelectedSlug(post.slug);
	};

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
	useOpenRequest('memo', (opened) => {
		// 열어 달라는 id는 문자열이라 글 주소 모양인지 먼저 본다
		const slug = postSlug(opened);
		if (!slug) return;
		setTagSelection((current) => ({ ...EMPTY_TAG_SELECTION, match: current.match }));
		setCategory(ALL_CATEGORY);
		setQuery('');
		setFilter(null);
		setGalleryNoteOpen(false);
		setPicked(null);
		setSelectedSlug(slug);
		setPane('reader');
	});

	const folderActions = useFolderActions({ edit, category, setCategory, selectFolder, folderPaths });

	const togglePin = (post: Post) => edit((prev) => setPinned(prev, post.slug, !post.pinned));
	/** 잠그면 고치거나 지울 수 없다 (실수로 바꾸지 않게). 다시 눌러 풀면 바로 고칠 수 있다 */
	const toggleLock = (post: Post) => edit((prev) => setLocked(prev, post.slug, !post.locked));
	/** 비밀 글로 지정하거나 푼다: 관리자에게만 보이게 (서버에만 있는 글) */
	const toggleSecret = useSecretPost(upsertAdminPost);
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
			flat={inTrash || ranked}
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
					<NoteCard key={post.slug} {...props} series={seriesBySlug.get(post.slug)} onOpen={open} />
				) : (
					<NoteItem
						key={post.slug}
						{...props}
						onOpen={open}
						active={selected?.slug === post.slug && newDraft === null}
						today={today}
						popularity={
							inPopular && stats
								? { rank: (popular?.indexOf(post.slug) ?? 0) + 1, stats: statsOf(stats, post.slug) }
								: undefined
						}
						views={!inPopular && views ? (views[post.slug] ?? 0) : undefined}
						series={seriesBySlug.get(post.slug)}
					/>
				);
			}}
		/>
	);

	// 새 메모 (관리자): 목록 맨 위의 자리, 처음 저장되면 그 글을 고른다 (useNewDraft)
	const draft = useNewDraft({ canEdit, upsertAdminPost, dropAdminPost, onCreated: setSelectedSlug });
	const newDraft = draft.draft;

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
		// 새 메모는 쓰는 화면에서 시작한다
		setReaderView(false);
		setQuery('');
		draft.start();
		setPane('reader');
	};

	const leaveNewDraft = draft.leave;

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
		revertPost,
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
		// 서버 글을 빼고 편집기를 새로 그린다: 임시 저장을 버렸을 때와 같다 (useNewDraft)
		onReverted: (slug) => draft.onDiscarded(slug, null),
	});
	// 끌어 놓기 (관리자): 글·지운 글·폴더 (useNoteDrag)
	const { dragging, setDragging, canDrop, drop, dragPost } = useNoteDrag({
		canEdit,
		inTrash,
		organized,
		trash,
		folderPaths,
		edit,
		onRemove: (post) => void removePost(post),
		onRestore: (post, folder) => void restoreDeleted(post, folder),
		onMoveFolder: folderActions.moveTo,
	});
	/** 메모 하나에 할 수 있는 일 (메뉴들이 함께 쓴다, noteMenus.tsx) */
	const noteActions: NoteActions = {
		togglePin,
		toggleLock,
		toggleSecret: (post) => void toggleSecret(post),
		remove: (post) => void removePost(post),
		restore: (post) => void restoreDeleted(post),
		purge: (post) => void purgeDeleted(post),
		revert: (post) => void revertPost(post),
	};

	/** 관리자 도구: 새 메모, 서식, 버전 기록, 지우기 (최근 삭제된 메모면 되돌려 놓기·즉시 삭제) */
	const authorTools = (className: string) =>
		canEdit && (
			<AuthorTools
				className={className}
				// 사이드바가 열려 있으면 새 메모는 사이드바 위쪽에 (한 칸씩 보일 때는 목록 위 검색 칸 옆)
				onNewNote={!sidebarOpen && className === '' ? startNewDraft : null}
				revisions={
					editing &&
					selected &&
					!inTrash &&
					!selected.locked &&
					newDraft === null &&
					className === '' && (
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
					)
				}
				deleted={
					selected && inTrash
						? { onRestore: () => void restoreDeleted(selected), onPurge: () => void purgeDeleted(selected) }
						: null
				}
				remove={
					selected && !inTrash && newDraft === null
						? { locked: Boolean(selected.locked), onRemove: () => void removePost(selected) }
						: null
				}
			/>
		);

	/** 글 아래: 이전 글·다음 글, 댓글 */
	const postFooter = (post: Post) => (
		<PostFooter
			post={post}
			older={older}
			newer={newer}
			onOpen={openAdjacent}
			onLikes={setLikes}
			onComments={setCommentCount}
		/>
	);

	/** 본문의 고정 버튼 */
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

	/** 글 공유: 휴대폰은 공유 시트, 그 밖에는 링크 복사 (게시하지 않은 글은 주소가 없어 빼고, 비밀 글은 다른 사람에게 열리지 않아 뺀다) */
	const shareButton = (className: string) =>
		selected &&
		!selected.status?.draftOnly &&
		!selected.status?.secret && (
			<IconButton
				className={`memo-share ${className}`}
				label="링크 공유"
				onClick={() => void shareLink({ app: 'memo', id: selected.slug }, selected.title)}
			>
				<ShareIcon />
			</IconButton>
		);

	/** 편집기를 보이는 중인지 (관리자, 최근 삭제·잠금이 아닌 글이나 새 메모. 읽기 화면으로 보는 중이면 아니다) */
	const writing = editing && !inTrash && (newDraft !== null || (selected !== null && !selected.locked && !readerView));

	/** 비슷한 글 열기: 검색어를 지우고 그 글을 연다 */
	const openSimilar = (post: Post) => {
		setQuery('');
		setSelectedSlug(post.slug);
		setPane('reader');
	};
	/** 결과가 본문에서만 걸렸을 때 목록 맨 위의 고친 검색어 */
	const didYouMeanLine = status === 'ready' && didYouMean && (
		<SuggestLine suggestion={didYouMean} className="memo-search-did-you-mean" onSuggest={setQuery} />
	);
	/** 목록 위의 메모 개수 */
	const countLabel = inTags && visible.length === 0 ? '메모 없음' : `${visible.length}개의 메모`;
	const empty = (
		<>
			{status === 'loading' && <EmptyState className="memo-empty">불러오는 중…</EmptyState>}
			{status === 'error' && <EmptyState className="memo-empty">글을 불러오지 못했습니다.</EmptyState>}
			{status === 'ready' && visible.length === 0 && !similar && (
				<EmptyState className="memo-empty">{query || filter ? '검색 결과가 없습니다.' : '메모 없음'}</EmptyState>
			)}
			{status === 'ready' && similar && (
				<SimilarResults
					suggestion={similar.suggestion}
					posts={similar.posts}
					today={today}
					onSuggest={setQuery}
					onOpen={openSimilar}
				/>
			)}
		</>
	);

	/** 새 메모가 들어갈 폴더: 지금 연 폴더 (모든 글·태그·최근 삭제된 항목이면 마지막 폴더) */
	const newFolder =
		category === ALL_CATEGORY || inTags || inPopular || inTrash ? (folderPaths.at(-1) ?? '기타') : category;
	const openFind = selected ? () => setFindSlug(selected.slug) : null;

	// 뒤로·앞으로: 연 폴더와 본 글의 기록 (Finder·Safari처럼). 기록의 칸을 열 때는 검색어·조건을 비워 그 글이 목록에 보이게 한다
	const history = useMemoNavHistory({
		category,
		tagSelection,
		slug: selected?.slug ?? null,
		posts: organized,
		folders: folderPaths,
		ready: status === 'ready',
		open: ({ category: target, tagSelection: tagsAt, slug }) => {
			setTagSelection((current) => tagsAt ?? { ...EMPTY_TAG_SELECTION, match: current.match });
			setCategory(target);
			setQuery('');
			setFilter(null);
			setGalleryNoteOpen(false);
			setPicked(null);
			if (slug) setSelectedSlug(postSlug(slug));
			setPane(slug ? 'reader' : 'list');
		},
		scrollRef: readerScroll,
		restoreScroll: (top) => {
			pendingScroll.current = top;
		},
	});
	const historyNav = !phone && (
		<HistoryNav
			canBack={history.canBack}
			canForward={history.canForward}
			onBack={history.goBack}
			onForward={history.goForward}
			backSteps={history.backSteps}
			forwardSteps={history.forwardSteps}
			onGo={history.go}
		/>
	);

	useMemoAppMenus({
		history,
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
		<MemoSearch
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
	// 최근 삭제된 항목은 늘 최근에 지운 순서라 정렬 버튼이 없다
	const sortMenu = () => !inTrash && <SortMenu arrangement={arrangement} onChange={setArrangement} />;
	// 검색 칸은 늘 창 오른쪽 위(도구 막대 끝)에 있다. 좁은 창에서는 도구 막대가 없으므로 목록 위에 정렬 버튼과 함께 둔다
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
			{/* 한 칸씩 볼 때의 모양은 styles/compact.css의 [data-compact] 규칙이 그린다 (휴대폰 화면이거나 메모 칸이 700px 이하) */}
			<div ref={attachShell} className="memo-shell" data-compact={compact || undefined}>
				{trashAlert}
				<div
					className={`memo pane-${pane} view-${view} ${galleryNoteOpen ? 'gallery-note' : ''} ${sidebarOpen ? '' : 'sidebar-closed'}`}
					data-nav={nav}
					ref={memoRef}
					data-resizing={resizing || undefined}
					style={
						{
							'--memo-sidebar-width': `${sidebarWidth}px`,
							'--memo-list-width': `${listWidth}px`,
						} as React.CSSProperties
					}
				>
					<FolderSidebar
						canEdit={canEdit}
						onNewNote={startNewDraft}
						open={sidebarOpen}
						onToggle={toggleSidebar}
						folders={folders}
						total={posts.length}
						popular={popular?.length ?? null}
						current={category}
						onSelect={selectFolder}
						onAddFolder={folderActions.add}
						onRenameFolder={folderActions.rename}
						onRemoveFolder={folderActions.remove}
						onMoveFolder={folderActions.moveTo}
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
					{sidebarOpen && !compact && (
						<PaneResizer
							pane="sidebar"
							label="사이드바 너비"
							width={sidebarWidth}
							roomFor={roomFor(view === 'list' ? listWidth : 0)}
							onResize={setSidebarWidth}
							onCommit={(width) => savePaneWidth('sidebar', width)}
							onDraggingChange={setResizing}
						/>
					)}
					{view === 'list' && !compact && (
						<PaneResizer
							pane="list"
							label="목록 너비"
							width={listWidth}
							roomFor={roomFor(sidebarOpen ? sidebarWidth : 0)}
							onResize={setListWidth}
							onCommit={(width) => savePaneWidth('list', width)}
							onDraggingChange={setResizing}
						/>
					)}

					<section className="memo-list" aria-label="글 목록">
						<Toolbar className="memo-toolbar">
							<ToolbarLead sidebarOpen={sidebarOpen} onToggleSidebar={toggleSidebar} />
							{historyNav}
							<div className="memo-toolbar-heading">
								<h2>{categoryName}</h2>
								<p>{countLabel}</p>
							</div>
						</Toolbar>
						<div className="memo-scroll">
							<IconButton className="memo-back" onClick={() => setPane('folders')}>
								<i className="fa-solid fa-chevron-left" aria-hidden="true" /> 폴더
							</IconButton>
							{/* 휴대폰: iOS 메모처럼 목록 위에 큰 제목 (도구 막대의 제목은 좁은 창에서 숨는다) */}
							<div className="memo-phone-title">
								{/* 휴대폰의 태그 화면은 제목이 늘 '태그'이고, 고른 태그는 아래 칩 줄이 보여 준다 (iOS 메모) */}
								<h2>{phone && inTags ? '태그' : categoryName}</h2>
								<p>{countLabel}</p>
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
							{!inTrash && (newDraft !== null || draft.leaving) && (
								<ul className="memo-items memo-new-items" aria-label="새 메모">
									{newDraft !== null && newDraftItem(newDraft, draft.preview, false)}
									{draft.leaving && newDraftItem(draft.leaving.key, draft.leaving.preview, true)}
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
							{didYouMeanLine}
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
							<PhoneListBars
								picked={picked}
								pickedPosts={pickedPosts}
								canPick={canEdit && !inTrash}
								onStartPicking={() => setPicked(new Set())}
								onStopPicking={() => setPicked(null)}
								onMovePicked={movePicked}
								onDeletePicked={() => {
									pickedPosts.filter((post) => !post.locked).forEach((post) => void removePost(post));
									setPicked(null);
								}}
								folderPaths={folderPaths}
								sort={sortMenu()}
								search={searchBox('memo-phone-search-field')}
								canEdit={canEdit}
								view={view}
								onView={changeView}
								onShowAttachments={() => setFilter('attachment')}
								onNewNote={startNewDraft}
							/>
						)}
					</section>

					{/* 갤러리는 갤러리로 볼 때만 그린다 (목록과 검색 칸·안내 문구가 겹치지 않게) */}
					{view === 'gallery' && (
						<section className="memo-gallery" aria-label="갤러리">
							<Toolbar className="memo-toolbar">
								<ToolbarLead sidebarOpen={sidebarOpen} onToggleSidebar={toggleSidebar} />
								{historyNav}
								<div className="memo-toolbar-heading">
									<h2>{categoryName}</h2>
									<p>{countLabel}</p>
								</div>
								{sortMenu()}
								<ViewSwitch view={view} onChange={changeView} />
								{search}
							</Toolbar>
							<div className="memo-scroll">
								{didYouMeanLine}
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
						<ReaderToolbar
							lead={
								galleryNoteOpen && (
									<>
										<ToolbarLead sidebarOpen={sidebarOpen} onToggleSidebar={toggleSidebar} />
										{/* 갤러리에서 연 글은 갤러리로 돌아간다 */}
										<IconButton className="memo-gallery-back" onClick={() => setGalleryNoteOpen(false)}>
											<i className="fa-solid fa-chevron-left" aria-hidden="true" /> {categoryName}
										</IconButton>
									</>
								)
							}
							admin={canEdit}
							readerView={editing ? readerView : null}
							onToggleReaderView={() => setReaderView((value) => !value)}
							searching={searching}
							tools={
								<>
									{authorTools('')}
									{pinButton('')}
									{shareButton('')}
									{/* 정렬·보기 방식은 늘 검색 칸 왼쪽 (사이드바를 여닫아도 움직이지 않는다) */}
									{sortMenu()}
									<ViewSwitch view={view} onChange={changeView} />
								</>
							}
							moreOpen={moreMenu !== null}
							onMore={(rect) => setMoreMenu(moreMenu ? null : { x: rect.left, y: rect.bottom + 6 })}
							search={search}
						/>
						{findSlug !== null && findSlug === selected?.slug && (
							<FindBar key={findSlug} editing={writing} readerRoot={readerScroll} onClose={() => setFindSlug(null)} />
						)}
						{/* 휴대폰: 오른쪽 위에 공유·••• 알약, 아래에 서식 알약과 새 메모 (iOS 메모 본문처럼) */}
						{phone && compact && (
							<PhoneReaderBars
								hasNote={selected !== null}
								share={newDraft === null && !inTrash && shareButton('')}
								menuItems={() =>
									selected
										? phoneNoteItems(selected, noteActions, {
												canEdit,
												inTrash,
												newDraft: newDraft !== null,
												onFind: () => setFindSlug(selected.slug),
												readerView: editing && !selected.locked ? readerView : null,
												onToggleReaderView: () => setReaderView((value) => !value),
											})
										: []
								}
								canEdit={canEdit}
								writing={writing}
								onNewNote={startNewDraft}
							/>
						)}
						<div ref={readerScroll} className="memo-scroll">
							<div className="memo-reader-compact-bar">
								<IconButton className="memo-back" onClick={() => setPane('list')}>
									<i className="fa-solid fa-chevron-left" aria-hidden="true" /> {categoryName}
								</IconButton>
								{authorTools('compact-only')}
								{pinButton('compact-only')}
								{shareButton('compact-only')}
							</div>
							{writing && (
								// 관리자: 따로 편집 버튼 없이 바로 고친다 (macOS 메모처럼)
								// 글자 크기는 편집기에도 같은 배율로 (markdown.css의 .memo-writer-scale: 본문·제목·목차만 키운다)
								<div
									key={draft.writerKey(selected?.slug ?? '')}
									className="memo-reader-body memo-writer-scale"
									style={cssVars({ 'memo-text-scale': textScale })}
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
										onDiscarded={draft.onDiscarded}
										onDraftChange={newDraft !== null ? draft.setPreview : undefined}
										onLeaveFolder={
											newDraft === null && selected
												? () => edit((prev) => keepFolder(prev, selected.category))
												: undefined
										}
										folders={folderPaths}
										seriesNames={seriesList}
										defaultFolder={newFolder}
										onSaved={draft.onSaved}
										renderMarkdown={renderMarkdown}
										compact={compact}
										series={
											newDraft === null &&
											series && <SeriesBox key={selected?.slug} series={series} compact={compact} onOpen={openSeries} />
										}
									/>
									{newDraft === null && selected && !selected.status?.draftOnly && postFooter(selected)}
								</div>
							)}
							{(!editing || inTrash || (newDraft === null && (selected?.locked || readerView))) && selected && (
								// 글이 바뀌면 새로 그려서 나타나는 애니메이션이 다시 돈다. 최근 삭제된 항목의 글과 잠긴 메모는 관리자에게도 읽기 화면
								<div className="memo-text-scale" style={cssVars({ 'memo-text-scale': textScale })}>
									<ReaderBody
										key={selected.slug}
										post={selected}
										today={today}
										views={views}
										editing={editing && Boolean(selected.locked)}
										footer={!inTrash && postFooter(selected)}
										series={series}
										onOpenSeries={openSeries}
										compact={compact}
										onRestore={() => void restoreDeleted(selected)}
										onPurge={() => void purgeDeleted(selected)}
										onUnlock={() => toggleLock(selected)}
									/>
								</div>
							)}
							{/* 고른 글이 없을 때 (검색 결과가 없거나 빈 폴더): macOS 메모처럼 본문 칸 가운데에 짧은 안내 */}
							{status === 'ready' && !selected && newDraft === null && similar && !compact && (
								<SearchEmptyReader
									query={searchQuery}
									suggestion={similar.suggestion}
									posts={similar.posts}
									onSuggest={setQuery}
									onOpen={openSimilar}
								/>
							)}
							{status === 'ready' && !selected && newDraft === null && !(similar && !compact) && (
								<EmptyState className="memo-reader-empty">선택한 메모 없음</EmptyState>
							)}
						</div>
						{(selected || newDraft !== null) && <TextSizeControl scale={textScale} onChange={setTextScale} />}
					</article>

					{revisionsOpen && editing && selected && (
						<RevisionsPopover
							slug={selected.slug}
							original={repoPosts.find((item) => item.slug === selected.slug) ?? null}
							panelRef={revisionsPanelExit}
							position={revisionsPosition}
							renderMarkdown={renderMarkdown}
							onRestore={(content) => {
								writerRef.current?.replaceContent(content);
								setRevisionsOpen(false);
							}}
						/>
					)}
					{moreMenu && (
						<Menu
							label="도구 더 보기"
							anchor={moreMenu}
							onClose={() => setMoreMenu(null)}
							items={toolMenuItems({
								selected,
								actions: noteActions,
								canEdit,
								inTrash,
								onNewNote: startNewDraft,
								onShare: (post) => void shareLink({ app: 'memo', id: post.slug }, post.title),
								arrangement,
								onArrange: setArrangement,
								view,
								onView: changeView,
							})}
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
				{/* 휴대폰 폴더 화면 아래: 검색 알약(누르면 모든 글에서 찾기)과 새 메모 */}
				{phone && compact && pane === 'folders' && (
					<PhoneFoldersBar
						onSearch={() => {
							selectFolder(ALL_CATEGORY);
							requestAnimationFrame(() =>
								shellRef.current?.querySelector<HTMLInputElement>('.memo-list-bottom .memo-search input')?.focus()
							);
						}}
						onNewNote={canEdit ? startNewDraft : null}
					/>
				)}
			</div>
		</AppWindow>
	);
};

export default Memo;
