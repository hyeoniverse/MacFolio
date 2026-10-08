import { useEffect, useMemo, useRef, useState } from 'react';
import { mergeAdminPosts, mergeServerPosts, type AdminPost, type Post, type ServerPost } from './posts';
import { discardVisitorOrganization, EMPTY_ORGANIZATION, organizePosts, type Organization } from './organize';
import { fetchOrganization, saveOrganization } from './organizationApi';
import { fetchAdminPosts, fetchServerPosts } from './postsApi';
import { getPostRepository } from './repository';
import { useCanEditMemo } from './admin';
import { env } from '@/shared/config/env';
import { notify } from '@/desktop/notifications/notificationStore';
import { fetchViews } from '@/shared/analytics/analytics';

/** 날짜 묶음·예약 공개의 기준이 되는 오늘 (YYYY-MM-DD) */
const isoDate = (date: Date) =>
	`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/**
 * 메모 앱이 보여 줄 글과 정리 내용을 모은다.
 * - 저장소의 Markdown 글을 먼저 보여 주고, 서버의 글(게시한 글, 관리자면 임시 저장까지)을 겹친다
 * - 정리 내용(폴더·옮기기·고정·잠금)은 서버에서 읽고, 관리자가 바꾸면 바로 차례로 저장한다
 * - 글마다 조회수 (트래픽 분석 #102)
 */
export function useMemoLibrary() {
	/** 저장소의 Markdown 글 */
	const [repoPosts, setRepoPosts] = useState<Post[]>([]);
	/** 방문자용 서버 글 (게시한 글, 지운·예약 표시) */
	const [publicPosts, setPublicPosts] = useState<ServerPost[]>([]);
	/** 관리자용 서버 글 (게시한 내용과 임시 저장). 관리자로 로그인했을 때만 읽는다 */
	const [adminPosts, setAdminPosts] = useState<AdminPost[] | null>(null);
	const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
	// 편집(폴더·옮기기·고정)은 관리자만. 방문자에게는 편집 단추를 보이지 않는다 (admin.ts)
	const canEdit = useCanEditMemo();
	/** 관리자 목록을 읽었으면 편집기로 본다 (읽기 전에는 게시한 내용으로 읽기만) */
	const editing = canEdit && adminPosts !== null;
	// 날짜 묶음(오늘, 어제 …)의 기준. 창을 연 날로 고정한다
	const today = useMemo(() => new Date(), []);
	const todayIso = isoDate(today);
	// 관리자는 임시 저장까지 보이고, 방문자는 게시한 글만 본다
	const posts = useMemo(
		() => (editing ? mergeAdminPosts(repoPosts, adminPosts, todayIso) : mergeServerPosts(repoPosts, publicPosts)),
		[editing, repoPosts, adminPosts, publicPosts, todayIso]
	);

	// 글마다 조회수. 앱을 열 때 한 번 묻는다. 서버가 없으면 감춘다 (null)
	const [views, setViews] = useState<Record<string, number> | null>(null);
	useEffect(() => {
		let alive = true;
		void fetchViews('memo').then((next) => alive && setViews(next));
		return () => {
			alive = false;
		};
	}, []);

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

	/** 관리자 글 하나를 서버가 돌려준 것으로 바꾼다 (없으면 더한다) */
	const upsertAdminPost = (post: AdminPost) =>
		setAdminPosts((list) => [...(list ?? []).filter((item) => item.slug !== post.slug), post]);
	/** 관리자 글 하나를 목록에서 뺀다 */
	const dropAdminPost = (slug: string) => setAdminPosts((list) => (list ?? []).filter((item) => item.slug !== slug));

	// 관리자가 정리한 내용 (API). 방문자도 같은 정리 내용으로 본다
	const [organization, setOrganization] = useState<Organization>(EMPTY_ORGANIZATION);
	/** 관리자가 방금 바꿔서 아직 저장하지 않았는지 */
	const unsaved = useRef(false);

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

	return {
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
	};
}
