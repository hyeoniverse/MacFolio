import { useState } from 'react';
import type { AdminPost } from './posts';
import type { PostDraft } from './postsApi';

/** 새 메모 자리가 접히며 사라지는 시간 (Memo.css의 memo-new-item-out과 같다) */
const NEW_ITEM_LEAVE_MS = 240;

/**
 * 새 메모 (관리자): 쓰기 시작하면 목록 맨 위에 '새로운 메모' 자리가 생기고, 쓰는 대로 제목·본문이 보인다.
 * 처음 저장되면 진짜 글이 되고(주소가 생긴다), 같은 편집기를 이어 쓴다. 쓰다가 다른 글로 가면 자리가 접히며 사라진다.
 * 편집기가 저장·되돌리기를 알리면 관리자 글 목록에 반영한다
 */
export function useNewDraft({
	canEdit,
	upsertAdminPost,
	dropAdminPost,
	onCreated,
}: {
	canEdit: boolean;
	upsertAdminPost: (post: AdminPost) => void;
	dropAdminPost: (slug: string) => void;
	/** 새 메모가 처음 저장되어 주소가 생겼을 때 (그 글을 고른다) */
	onCreated: (slug: string) => void;
}) {
	/** 새 메모에 지금 쓰고 있는 것 (목록 미리 보기) */
	const [preview, setPreview] = useState<PostDraft | null>(null);
	/** 사라지는 중인 새 메모 자리 (접히는 애니메이션이 끝나면 지운다) */
	const [leaving, setLeaving] = useState<{ key: number; preview: PostDraft | null } | null>(null);
	/** 새 메모를 쓰는 중이면 그 번호 (쓰기 시작한 때). 관리자가 아니면 쓰지 않는다 */
	const [draftState, setDraft] = useState<number | null>(null);
	const draft = canEdit ? draftState : null;
	/** 새 메모가 처음 저장되면 주소가 생긴다. 그 뒤에도 같은 편집기를 이어 쓰도록 주소 → 편집기 이름을 기억한다 */
	const [writerKeys, setWriterKeys] = useState<Record<string, string>>({});

	const start = () => {
		setDraft(Date.now());
		setPreview(null);
	};

	/** 새 메모를 두고 다른 글로 옮겨 간다: 목록의 새 메모 자리는 접히며 사라진다 (쓴 것이 있으면 편집기가 저장해 진짜 글로 남는다) */
	const leave = () => {
		if (draft === null) return;
		const key = draft;
		setLeaving({ key, preview });
		setTimeout(() => setLeaving((current) => (current?.key === key ? null : current)), NEW_ITEM_LEAVE_MS);
		setDraft(null);
	};

	/** 편집기가 임시 저장·게시할 때마다: 목록에 반영하고, 새 메모였으면 그 글을 고른다 */
	const onSaved = (post: AdminPost) => {
		upsertAdminPost(post);
		if (draft !== null) {
			setWriterKeys((keys) => ({ ...keys, [post.slug]: `new-${draft}` }));
			onCreated(post.slug);
			setDraft(null);
		}
	};

	/** 변경 사항을 버렸다: 게시한 내용(없으면 저장소 원본)으로. 둘 다 없던 새 메모는 사라진다. 편집기는 새로 그린다 */
	const onDiscarded = (slug: string, post: AdminPost | null) => {
		if (post) upsertAdminPost(post);
		else dropAdminPost(slug);
		setWriterKeys((keys) => ({ ...keys, [slug]: `${slug}-${Date.now()}` }));
	};

	/** 편집기 이름 (key): 새 메모, 처음 저장된 새 메모, 되돌린 뒤의 편집기를 가린다 */
	const writerKey = (slug: string) => (draft !== null ? `new-${draft}` : (writerKeys[slug] ?? slug));

	return { draft, preview, setPreview, leaving, start, leave, onSaved, onDiscarded, writerKey };
}
