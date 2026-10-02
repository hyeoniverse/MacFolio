import React, { lazy, Suspense, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import Menu from '@/shared/ui/menu/Menu';
import { folderLabelOf, formatPostDate, type AdminPost, type Post } from '../posts';
import { discardDraft, publishPost, saveDraft, type PostDraft } from '../postsApi';
import { validateDraft } from '../postRules';
import { env } from '@/shared/config/env';
import DatePicker from './DatePicker';

// 편집기(Milkdown)는 관리자에게만 필요해서 처음 쓸 때 불러온다
const InlineEditor = lazy(() => import('./InlineEditor'));

/** 멈추고 이만큼 지나면 저장한다 */
const SAVE_DELAY_MS = 800;

type Status =
	| { kind: 'idle' }
	| { kind: 'saving' }
	| { kind: 'saved' }
	| { kind: 'publishing' }
	| { kind: 'published'; scheduled: string | null }
	| { kind: 'invalid'; message: string }
	| { kind: 'error'; message: string };

/** 부모(메모)가 부르는 것: 버전 기록에서 되돌리기 */
export interface PostWriterHandle {
	/** 내용을 통째로 바꾸고 임시 저장한다 (게시는 따로) */
	replaceContent: (content: PostDraft) => void;
}

interface Props {
	/** 고치는 글. 새 메모면 null */
	post: Post | null;
	/** 게시한 내용이나 저장소 원본이 있는지 (있으면 '변경 사항 버리기'로 돌아갈 곳이 있다) */
	hasPublished: boolean;
	folders: string[];
	/** 새 메모의 폴더 */
	defaultFolder: string;
	/** 임시 저장·게시할 때마다: 서버가 돌려준 글 */
	onSaved: (post: AdminPost) => void;
	/** 변경 사항을 버렸다. post가 null이면 서버에서 글이 없어졌다 (저장소 원본으로 돌아가거나, 새 메모면 사라진다) */
	onDiscarded: (slug: string, post: AdminPost | null) => void;
	/** 본문 미리 보기 (편집기를 불러오는 동안) */
	renderMarkdown: (body: string) => React.ReactNode;
	/** 쓰는 대로 알린다 (새 메모의 목록 미리 보기) */
	onDraftChange?: (draft: PostDraft) => void;
	ref?: React.Ref<PostWriterHandle>;
}

const today = () => {
	const now = new Date();
	return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

/** 폴더 고르기: 누르면 폴더 목록 메뉴 */
const FolderPicker = ({
	value,
	folders,
	onChange,
}: {
	value: string;
	folders: string[];
	onChange: (value: string) => void;
}) => {
	const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);
	const close = useCallback(() => setAnchor(null), []);
	const options = folders.includes(value) ? folders : [value, ...folders];
	return (
		<>
			<button
				type="button"
				className="memo-meta-button"
				aria-label={`폴더 ${folderLabelOf(value)}, 바꾸기`}
				aria-haspopup="menu"
				aria-expanded={anchor !== null}
				onPointerDown={(event) => event.stopPropagation()}
				onClick={(event) => {
					if (anchor) return close();
					const rect = event.currentTarget.getBoundingClientRect();
					setAnchor({ x: rect.left, y: rect.bottom + 6 });
				}}
			>
				{folderLabelOf(value)}
			</button>
			{anchor && (
				<Menu
					label="폴더 고르기"
					anchor={anchor}
					onClose={close}
					items={options.map((folder) => ({
						label: folderLabelOf(folder),
						checked: folder === value,
						onSelect: () => onChange(folder),
					}))}
				/>
			)}
		</>
	);
};

/**
 * 관리자가 보는 글: 따로 편집 단추 없이 macOS 메모처럼 바로 고친다.
 * 고치면 잠시 뒤 **임시 저장**만 한다 (방문자에게는 게시한 내용이 그대로 보인다). '게시'를 눌러야 공개되고,
 * 날짜가 미래면 '예약'이 되어 그날부터 보인다. 게시할 때마다 버전이 남는다.
 * 저장은 차례로 보내고(뒤바뀌지 않게), 다른 글로 옮겨 가면 남은 편집을 바로 보낸다.
 */
const PostWriter = ({
	post,
	hasPublished,
	folders,
	defaultFolder,
	onSaved,
	onDiscarded,
	renderMarkdown,
	onDraftChange,
	ref,
}: Props) => {
	const [draft, setDraft] = useState<PostDraft>(() =>
		post
			? { title: post.title, date: post.date, category: post.category, summary: post.summary, body: post.body }
			: { title: '', date: today(), category: defaultFolder, summary: '', body: '' }
	);
	const [status, setStatus] = useState<Status>({ kind: 'idle' });
	/** 게시하지 않은 편집이 있는지 (새 메모는 게시하기 전까지 늘 그렇다) */
	const [unpublished, setUnpublished] = useState(
		() => !post || Boolean(post.status?.draftOnly || post.status?.changed)
	);
	/** 되돌리기로 내용을 통째로 바꾸면 본문 편집기를 새로 그린다 */
	const [editorVersion, setEditorVersion] = useState(0);
	/** 저장한 글의 주소 (새 메모는 처음 저장할 때 생긴다) */
	const slug = useRef<string | null>(post?.slug ?? null);
	const dirty = useRef(false);
	const latest = useRef(draft);
	const queue = useRef<Promise<void>>(Promise.resolve());
	const onSavedRef = useRef(onSaved);
	const titleRef = useRef<HTMLTextAreaElement>(null);

	useEffect(() => {
		latest.current = draft;
		onSavedRef.current = onSaved;
	});

	// 새 메모는 제목부터 쓴다
	useEffect(() => {
		if (!post) titleRef.current?.focus();
	}, [post]);

	/** 규칙을 어겼으면 이유 (없으면 null) */
	const problemOf = (current: PostDraft) => {
		const problems = Object.values(validateDraft(current));
		return problems.length > 0 ? problems.join(' ') : null;
	};

	/** 지금 내용을 임시 저장한다 (규칙에 맞을 때만) */
	const flush = useCallback((mounted: boolean) => {
		if (!dirty.current) return;
		const current = latest.current;
		const problem = problemOf(current);
		if (problem) {
			if (mounted) setStatus({ kind: 'invalid', message: problem });
			return;
		}
		dirty.current = false;
		if (mounted) setStatus({ kind: 'saving' });
		queue.current = queue.current.then(async () => {
			const result = await saveDraft(env.apiUrl, slug.current, current);
			if (!result.ok) {
				dirty.current = true;
				if (mounted) setStatus({ kind: 'error', message: result.errors.join(' ') });
				return;
			}
			slug.current = result.post.slug;
			onSavedRef.current(result.post);
			if (mounted) setStatus({ kind: 'saved' });
		});
	}, []);

	// 고치고 멈추면 임시 저장
	useEffect(() => {
		if (!dirty.current) return;
		const id = setTimeout(() => flush(true), SAVE_DELAY_MS);
		return () => clearTimeout(id);
	}, [draft, flush]);

	// 다른 글로 옮겨 가거나 창을 닫으면 남은 편집을 바로 보낸다
	useEffect(() => () => flush(false), [flush]);

	const change = (patch: Partial<PostDraft>) => {
		dirty.current = true;
		setUnpublished(true);
		setStatus({ kind: 'idle' });
		setDraft((prev) => ({ ...prev, ...patch }));
		// 목록 미리 보기에 알린다 (고칠 때마다 부르는 이벤트 처리 중이라 지금 내용에 바로 더한다)
		onDraftChange?.({ ...draft, ...patch });
	};

	useImperativeHandle(ref, () => ({
		replaceContent: (content) => {
			dirty.current = true;
			setUnpublished(true);
			setDraft(content);
			setEditorVersion((version) => version + 1);
			// 되돌린 내용은 기다리지 않고 바로 임시 저장한다
			latest.current = content;
			flush(true);
		},
	}));

	/** 게시 (날짜가 미래면 예약). 기다리던 임시 저장이 끝난 뒤에 지금 내용으로 */
	const publish = () => {
		const current = latest.current;
		const problem = problemOf(current);
		if (problem) return setStatus({ kind: 'invalid', message: problem });
		dirty.current = false;
		setStatus({ kind: 'publishing' });
		queue.current = queue.current.then(async () => {
			if (!slug.current) {
				const created = await saveDraft(env.apiUrl, null, current);
				if (!created.ok) return setStatus({ kind: 'error', message: created.errors.join(' ') });
				slug.current = created.post.slug;
				onSavedRef.current(created.post);
			}
			const result = await publishPost(env.apiUrl, slug.current, current);
			if (!result.ok) {
				dirty.current = true;
				return setStatus({ kind: 'error', message: result.errors.join(' ') });
			}
			onSavedRef.current(result.post);
			// 게시하는 동안 더 고쳤으면 그건 다시 임시 저장할 편집이다
			if (!dirty.current) setUnpublished(false);
			setStatus({ kind: 'published', scheduled: current.date > today() ? current.date : null });
		});
	};

	/** 변경 사항 버리기: 게시한 내용(또는 저장소 원본)으로 돌아간다 */
	const discard = () => {
		if (!window.confirm('게시하지 않은 변경을 버리고 게시한 내용으로 되돌릴까요?')) return;
		dirty.current = false;
		queue.current = queue.current.then(async () => {
			if (!slug.current || !post) return;
			const result = await discardDraft(env.apiUrl, slug.current);
			// 서버에 임시 저장이 없었으면(아직 저장하기 전) 404: 그대로 되돌리면 된다
			if (!result.ok && !result.errors.some((error) => error.includes('없습니다')))
				return setStatus({ kind: 'error', message: result.errors.join(' ') });
			onDiscarded(slug.current, result.ok ? result.post : null);
		});
	};

	const scheduled = draft.date > today();
	const statusText =
		status.kind === 'saving'
			? '임시 저장 중…'
			: status.kind === 'saved'
				? '임시 저장됨'
				: status.kind === 'publishing'
					? '게시하는 중…'
					: status.kind === 'published'
						? status.scheduled
							? `예약됨 · ${formatPostDate(status.scheduled)}에 공개`
							: '게시됨'
						: status.kind === 'invalid' || status.kind === 'error'
							? status.message
							: !post
								? ''
								: unpublished
									? post.status?.draftOnly
										? '게시하지 않은 글'
										: '게시하지 않은 변경'
									: post.status?.scheduled
										? `예약됨 · ${formatPostDate(post.status.scheduled)}에 공개`
										: '';
	const busy = status.kind === 'publishing';

	return (
		<div className="memo-writer" aria-label={post ? `${post.title} 편집` : '새 메모'}>
			<div className="memo-writer-meta">
				<DatePicker value={draft.date} onChange={(date) => change({ date })} />
				<span aria-hidden="true">·</span>
				<FolderPicker value={draft.category} folders={folders} onChange={(category) => change({ category })} />
				<span className="memo-writer-actions">
					<span
						className={`memo-writer-status ${status.kind === 'invalid' || status.kind === 'error' ? 'problem' : ''}`}
						role="status"
					>
						{statusText}
					</span>
					{unpublished && hasPublished && (
						<button type="button" className="memo-writer-discard" disabled={busy} onClick={discard}>
							변경 사항 버리기
						</button>
					)}
					<button
						type="button"
						className="memo-writer-publish"
						disabled={!unpublished || busy}
						title={
							unpublished
								? scheduled
									? `${formatPostDate(draft.date)}부터 방문자에게 보입니다`
									: '방문자에게 보이게 합니다'
								: '게시하지 않은 변경이 없습니다'
						}
						onClick={publish}
					>
						{scheduled ? '예약' : '게시'}
					</button>
				</span>
			</div>
			<textarea
				ref={titleRef}
				className="memo-writer-title"
				aria-label="제목"
				placeholder="제목"
				rows={1}
				maxLength={100}
				value={draft.title}
				onChange={(event) => change({ title: event.target.value.replace(/\n/g, ' ') })}
				onKeyDown={(event) => {
					// 제목에서 Enter를 누르면 본문으로
					if (event.key === 'Enter') {
						event.preventDefault();
						event.currentTarget.closest('.memo-writer')?.querySelector<HTMLElement>('.ProseMirror')?.focus();
					}
				}}
			/>
			<Suspense fallback={<div className="memo-markdown">{renderMarkdown(draft.body)}</div>}>
				<InlineEditor
					key={editorVersion}
					markdown={draft.body}
					onChange={(body) => change({ body })}
					placeholder="본문을 쓰세요"
				/>
			</Suspense>
		</div>
	);
};

export default PostWriter;
