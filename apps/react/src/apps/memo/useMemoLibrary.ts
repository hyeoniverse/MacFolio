import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	type AdminPost,
	EMPTY_ORGANIZATION,
	mergeAdminPosts,
	mergeServerPosts,
	type Organization,
	organizePosts,
	type Post,
	type PostSlug,
	type PostStats,
	type ServerPost,
} from '@macfolio/desktop-core/memo';
import { fetchOrganization, organizationEvents, publishOrganization, saveOrganization } from './organizationApi';
import { fetchAdminPosts, fetchServerPosts } from './postsApi';
import { getPostRepository } from './repository';
import { loadPostBody } from './repository/postBody';
import { useCanEditMemo } from './useCanEditMemo';
import { env } from '@/shared/config/env';
import { notify } from '@/desktop/notifications/notificationStore';
import { fetchViews } from '@/shared/analytics/analytics';
import { usePolling } from '@/shared/hooks/usePolling';
import { keepIfSame } from '@/shared/lib/poller';
import { useAppWindowShown } from '@/desktop/useAppWindowShown';
import { fetchPostCounts, type Likes, type PostCounts } from './likes/likesApi';
// 목록용 글 (원문 대신 목록이 읽는 부분만). 원문 묶음(3.7MB)을 받기 전에 목록을 그린다 (vite.config.ts)
import LIST_POSTS from 'virtual:post-list';

/** 조회수·댓글 수·좋아요 수를 다시 묻는 간격. 서버가 조회수를 1분 동안 같은 값으로 준다 */
const STATS_POLL_MS = 60_000;
/** 서버의 게시 글 목록을 다시 묻는 간격. 글은 하루에 몇 편 수준으로 바뀐다 */
const POSTS_POLL_MS = 10 * 60_000;

/** 날짜 묶음·예약 공개의 기준이 되는 오늘 (YYYY-MM-DD) */
const isoDate = (date: Date) =>
	`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/**
 * 메모 앱이 보여 줄 글과 정리 내용을 모은다.
 * - 저장소의 Markdown 글을 먼저 보여 주고, 서버의 글(게시한 글, 관리자면 임시 저장까지)을 겹친다
 * - 정리 내용(폴더·옮기기·고정·잠금)은 서버에서 읽고, 관리자가 바꾸면 바로 차례로 저장한다
 * - 글마다 조회수 (트래픽 분석 #102), 댓글 수·좋아요 수 (인기글)
 */
export function useMemoLibrary() {
	/** 저장소의 Markdown 글. 처음에는 목록용 글(본문은 목록이 읽는 부분만, bodyPending)이고 원문 묶음이 오면 바꾼다 */
	const [repoPosts, setRepoPosts] = useState<Post[]>(LIST_POSTS);
	/** 방문자용 서버 글 (게시한 글, 지운·예약 표시) */
	const [publicPosts, setPublicPosts] = useState<ServerPost[]>([]);
	/** 관리자용 서버 글 (게시한 내용과 임시 저장). 관리자로 로그인했을 때만 읽는다 */
	const [adminPosts, setAdminPosts] = useState<AdminPost[] | null>(null);
	// 편집(폴더·옮기기·고정)은 관리자만. 방문자에게는 편집 버튼을 보이지 않는다 (admin.ts)
	const canEdit = useCanEditMemo();
	/** 관리자 목록을 읽었으면 편집기로 본다 (읽기 전에는 게시한 내용으로 읽기만) */
	const editing = canEdit && adminPosts !== null;
	// 날짜 묶음(오늘, 어제 …)의 기준. 창을 연 날로 고정한다
	const today = useMemo(() => new Date(), []);
	const todayIso = isoDate(today);
	// 관리자는 임시 저장까지 보이고, 방문자는 게시한 글만 본다.
	// 저장소 글은 목록용 글로 처음부터 있다: 서버 글만으로 목록을 그렸다가 저장소 글이 뒤늦게 합쳐져 순서가 바뀌는 일이 없다
	const posts = useMemo(
		() => (editing ? mergeAdminPosts(repoPosts, adminPosts, todayIso) : mergeServerPosts(repoPosts, publicPosts)),
		[editing, repoPosts, adminPosts, publicPosts, todayIso]
	);

	// 글마다 조회수와 댓글 수·좋아요 수 (인기글 순위). 메모 창이 보이는 동안 1분마다 다시 묻는다.
	// 서버가 없으면 감춘다 (null). 이 화면에서 누르거나 쓰면 응답을 기다리지 않고 바로 고친다
	const [views, setViews] = useState<Record<string, number> | null>(null);
	const [counts, setCounts] = useState<PostCounts | null>(null);
	/** 이 화면에서 좋아요·댓글 수를 마지막으로 고친 시각. 그보다 먼저 보낸 조회의 응답은 댓글·좋아요 수를 덮지 않는다 */
	const countsEditedAt = useRef(0);
	const shown = useAppWindowShown('memo');
	usePolling(
		() => {
			const askedAt = Date.now();
			return Promise.all([
				fetchViews('memo').then((next) => {
					if (next) setViews(next);
					return next !== null;
				}),
				fetchPostCounts(env.apiUrl).then((next) => {
					if (next && askedAt >= countsEditedAt.current) setCounts(next);
					return next !== null;
				}),
			]).then(([viewed, counted]) => {
				// 둘 다 읽지 못했으면 실패로 보고 간격을 늘린다
				if (!viewed && !counted) throw new Error('stats');
			});
		},
		{ intervalMs: STATS_POLL_MS, active: shown && Boolean(env.apiUrl) }
	);
	/** 글마다 조회·댓글·좋아요. 서버가 없거나 둘 다 읽지 못하면 null (인기글을 감춘다) */
	const stats = useMemo(() => {
		if (!views && !counts) return null;
		const merged: Record<string, PostStats> = {};
		const entry = (slug: string) => (merged[slug] ??= { views: 0, comments: 0, likes: 0 });
		for (const [slug, count] of Object.entries(views ?? {})) entry(slug).views = count;
		for (const [slug, { comments, likes }] of Object.entries(counts ?? {}))
			Object.assign(entry(slug), { comments, likes });
		return merged;
	}, [views, counts]);
	const setLikes = (slug: string, likes: Likes) => {
		countsEditedAt.current = Date.now();
		setCounts((current) => ({
			...current,
			[slug]: { comments: current?.[slug]?.comments ?? 0, likes: likes.count },
		}));
	};
	const setCommentCount = (slug: string, comments: number) => {
		countsEditedAt.current = Date.now();
		setCounts((current) => ({ ...current, [slug]: { likes: current?.[slug]?.likes ?? 0, comments } }));
	};

	// 원문 묶음은 목록을 그린 뒤 바로 받는다 (본문 검색·편집에 쓴다). 받지 못하면 목록용 글을 그대로 두고 연 글만 따로 받는다
	useEffect(() => {
		let cancelled = false;
		getPostRepository()
			.list()
			.then((list) => {
				if (cancelled) return;
				setRepoPosts(list);
			})
			.catch(() => {});
		return () => {
			cancelled = true;
		};
	}, []);

	/** 연 글(목록용 글)의 원문을 원문 묶음보다 먼저 받는다. 그사이 묶음이 와서 원문이 있으면 그대로 둔다 */
	const loadBody = useCallback((slug: PostSlug) => {
		void loadPostBody(slug).then((body) => {
			if (body === null) return;
			setRepoPosts((current) =>
				current.map((post) => {
					if (post.slug !== slug || !post.bodyPending) return post;
					const { bodyPending: _pending, ...rest } = post;
					return { ...rest, body };
				})
			);
		});
	}, []);

	// 서버의 게시 글 (관리자가 사이트에서 쓴 글): 메모 창이 보이는 동안 10분마다 다시 묻는다.
	// 읽지 못하면(빈 목록) 보던 목록을 그대로 둔다
	usePolling(
		() =>
			fetchServerPosts(env.apiUrl).then((server) => {
				if (server.length > 0) setPublicPosts((current) => keepIfSame(current, server));
			}),
		{ intervalMs: POSTS_POLL_MS, active: shown && Boolean(env.apiUrl) }
	);

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

	/** 관리자 글 하나를 서버가 돌려준 것으로 바꾼다 (없으면 더한다) */
	const upsertAdminPost = (post: AdminPost) =>
		setAdminPosts((list) => [...(list ?? []).filter((item) => item.slug !== post.slug), post]);
	/** 관리자 글 하나를 목록에서 뺀다 */
	const dropAdminPost = (slug: string) => setAdminPosts((list) => (list ?? []).filter((item) => item.slug !== slug));

	// 관리자가 정리한 내용 (API). 방문자도 같은 정리 내용으로 본다
	const [organization, setOrganization] = useState<Organization>(EMPTY_ORGANIZATION);
	/** 관리자가 방금 바꿔서 아직 저장하지 않았는지 */
	const unsaved = useRef(false);

	// 서버의 정리 내용을 읽는다
	useEffect(() => {
		let cancelled = false;
		fetchOrganization(env.apiUrl).then((loaded) => {
			if (!cancelled && !unsaved.current) setOrganization(loaded);
		});
		// Finder가 저장한 정리 내용(블로그 폴더를 옮기거나 이름을 바꿈)을 따라간다
		const unsubscribe = organizationEvents.subscribe(({ organization: next, source }) => {
			if (next && source === 'finder' && !unsaved.current) setOrganization(next);
		});
		return () => {
			cancelled = true;
			unsubscribe();
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
			if (await saveOrganization(env.apiUrl, snapshot)) {
				// Finder의 블로그 폴더도 따라가게 알린다
				publishOrganization(snapshot, 'memo');
				return;
			}
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

	return {
		repoPosts,
		loadBody,
		adminPosts,
		upsertAdminPost,
		dropAdminPost,
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
	};
}
