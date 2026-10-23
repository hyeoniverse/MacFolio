import { useState } from 'react';
import AlertDialog from '@/shared/ui/dialog/AlertDialog';
import { env } from '@/shared/config/env';
import { notify } from '@/desktop/notifications/notificationStore';
import {
	type AdminPost,
	ALL_CATEGORY,
	folderPath,
	keepFolder,
	movePost,
	type Organization,
	type Post,
	type PostSlug,
} from '@macfolio/desktop-core/memo';
import { deletePost, purgePost, restorePost, revertToRepository } from './postsApi';

const failed = (title: string) =>
	notify({ app: 'memo', title, body: '관리자 로그인이 끝났거나 서버에 연결할 수 없습니다.' });

/**
 * 지우기와 '최근 삭제된 항목' (관리자): 묻지 않고 지우고(30일 동안 되살릴 수 있다), 되살리고, 즉시 삭제한다.
 * 저장소 글로 되돌리기도 여기 둔다. 즉시 삭제와 되돌리기는 취소할 수 없어서 메모 창 안의 경고창으로 묻는다 (alert를 메모 창 안에 그린다)
 */
export function useTrash({
	adminPosts,
	upsertAdminPost,
	dropAdminPost,
	edit,
	trash,
	inTrash,
	onRestored,
	onTrashGone,
	onReverted,
}: {
	adminPosts: AdminPost[] | null;
	upsertAdminPost: (post: AdminPost) => void;
	dropAdminPost: (slug: string) => void;
	edit: (update: (prev: Organization) => Organization) => void;
	/** 최근 삭제된 메모들 */
	trash: Post[];
	/** 지금 최근 삭제된 항목을 보고 있는지 */
	inTrash: boolean;
	/** 되살린 글을 그 폴더(끌어 놓은 곳, 아니면 모든 글)에서 연다 */
	onRestored: (slug: PostSlug, folder: string) => void;
	/** 최근 삭제된 항목이 비어 사라졌을 때 (모든 글로) */
	onTrashGone: () => void;
	/** 저장소 글로 되돌렸다 (서버의 글을 목록에서 빼고, 열려 있던 편집기를 저장소 글로 새로 그린다) */
	onReverted: (slug: PostSlug) => void;
}) {
	/** 지우기: 묻지 않고 '최근 삭제된 항목'으로 옮긴다 (30일 동안 되살릴 수 있다, macOS 메모처럼) */
	const removePost = async (post: Post) => {
		if (!(await deletePost(env.apiUrl, post.slug))) return failed('지우지 못함');
		// 마지막 글을 지워도 폴더는 남는다
		edit((prev) => keepFolder(prev, post.category));
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

	/** 되살린다. 폴더에 끌어 놓았으면 그 폴더로 옮기고 그 폴더를, 아니면 모든 글을 열어 그 글을 보여준다 */
	const restoreDeleted = async (post: Post, folder = ALL_CATEGORY) => {
		const result = await restorePost(env.apiUrl, post.slug);
		if (!result.ok) return failed('되돌려 놓지 못함');
		if (result.post) upsertAdminPost(result.post);
		else dropAdminPost(post.slug);
		const target = folder === ALL_CATEGORY ? null : folderPath(folder);
		if (target && target !== post.category) edit((prev) => movePost(prev, post.slug, target));
		onRestored(post.slug, folder);
	};

	/** 영구히 지운 글: 내용 없이 가리는 표시만 남는다 (서버와 같게) */
	const markPurged = (slug: string) => {
		const current = adminPosts?.find((item) => item.slug === slug);
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

	/** 앱 안 경고창으로 묻는다 (메모 창 한가운데). 확인하면 true */
	const [confirm, setConfirm] = useState<{
		title: string;
		message: string;
		confirmLabel: string;
		resolve: (ok: boolean) => void;
	} | null>(null);
	const ask = (title: string, message: string, confirmLabel: string) =>
		new Promise<boolean>((resolve) => setConfirm({ title, message, confirmLabel, resolve }));
	const askPurge = (count: number) =>
		ask(`${count}개의 메모를 영구적으로 삭제하겠습니까?`, '이 동작은 취소할 수 없습니다.', '삭제');

	/**
	 * 저장소 글로 되돌린다: 서버에서 고친 내용·임시 저장·버전 기록을 지우면 저장소의 Markdown 글이 다시 보인다.
	 * 취소할 수 없어서 묻는다
	 */
	const revertPost = async (post: Post) => {
		const ok = await ask(
			'저장소의 원래 글로 되돌리겠습니까?',
			'서버에서 고친 내용, 임시 저장, 버전 기록이 모두 지워집니다. 이 동작은 취소할 수 없습니다.',
			'되돌리기'
		);
		if (!ok) return;
		if (!(await revertToRepository(env.apiUrl, post.slug))) return failed('되돌리지 못함');
		onReverted(post.slug);
	};

	/** 최근 삭제된 항목에서 즉시 삭제한다 (되돌릴 수 없어서 묻는다) */
	const purgeDeleted = async (post: Post) => {
		if (!(await askPurge(1))) return;
		if (!(await purgePost(env.apiUrl, post.slug))) return failed('즉시 삭제하지 못함');
		// 마지막 하나였으면 최근 삭제된 항목이 사라지므로 모든 글로
		if (trash.length <= 1) onTrashGone();
		markPurged(post.slug);
	};

	/** 휴지통 비우기: 최근 삭제된 항목의 메모를 모두 즉시 삭제한다 */
	const emptyTrash = async () => {
		if (trash.length === 0) return;
		if (!(await askPurge(trash.length))) return;
		const results = await Promise.all(
			trash.map(async (post) => ({ slug: post.slug, ok: await purgePost(env.apiUrl, post.slug) }))
		);
		results.filter((result) => result.ok).forEach((result) => markPurged(result.slug));
		if (results.some((result) => !result.ok)) failed('휴지통을 다 비우지 못함');
		else if (inTrash) onTrashGone();
	};

	const answer = (ok: boolean) => {
		confirm?.resolve(ok);
		setConfirm(null);
	};
	const alert = confirm && (
		<AlertDialog
			title={confirm.title}
			message={confirm.message}
			confirmLabel={confirm.confirmLabel}
			onConfirm={() => answer(true)}
			onCancel={() => answer(false)}
		/>
	);

	return { removePost, restoreDeleted, purgeDeleted, emptyTrash, revertPost, alert };
}
