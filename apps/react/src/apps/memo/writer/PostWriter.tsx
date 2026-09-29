import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import ContextMenu from '../components/ContextMenu';
import { folderLabelOf, type Post, type ServerPost } from '../posts';
import { savePost, type PostDraft } from '../postsApi';
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
	| { kind: 'invalid'; message: string }
	| { kind: 'error'; message: string };

interface Props {
	/** 고치는 글. 새 메모면 null */
	post: Post | null;
	folders: string[];
	/** 새 메모의 폴더 */
	defaultFolder: string;
	/** 저장할 때마다: 서버가 돌려준 글 */
	onSaved: (post: ServerPost) => void;
	/** 본문 미리 보기 (편집기를 불러오는 동안) */
	renderMarkdown: (body: string) => React.ReactNode;
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
				<ContextMenu
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
 * 제목·날짜·폴더·본문을 고치면 잠시 뒤 저장한다. 필수 항목이 비면 저장하지 않고 이유를 보여 준다.
 * 저장은 차례로 보내고(뒤바뀌지 않게), 다른 글로 옮겨 가면 남은 편집을 바로 보낸다.
 */
const PostWriter = ({ post, folders, defaultFolder, onSaved, renderMarkdown }: Props) => {
	const [draft, setDraft] = useState<PostDraft>(() =>
		post
			? { title: post.title, date: post.date, category: post.category, summary: post.summary, body: post.body }
			: { title: '', date: today(), category: defaultFolder, summary: '', body: '' }
	);
	const [status, setStatus] = useState<Status>({ kind: 'idle' });
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

	/** 지금 내용을 저장한다 (규칙에 맞을 때만) */
	const flush = useCallback((mounted: boolean) => {
		if (!dirty.current) return;
		const current = latest.current;
		const problems = Object.values(validateDraft(current));
		if (problems.length > 0) {
			if (mounted) setStatus({ kind: 'invalid', message: problems.join(' ') });
			return;
		}
		dirty.current = false;
		if (mounted) setStatus({ kind: 'saving' });
		queue.current = queue.current.then(async () => {
			const result = await savePost(env.apiUrl, slug.current, current);
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

	// 고치고 멈추면 저장
	useEffect(() => {
		if (!dirty.current) return;
		const id = setTimeout(() => flush(true), SAVE_DELAY_MS);
		return () => clearTimeout(id);
	}, [draft, flush]);

	// 다른 글로 옮겨 가거나 창을 닫으면 남은 편집을 바로 보낸다
	useEffect(() => () => flush(false), [flush]);

	const change = (patch: Partial<PostDraft>) => {
		dirty.current = true;
		setStatus({ kind: 'idle' });
		setDraft((prev) => ({ ...prev, ...patch }));
	};

	const statusText =
		status.kind === 'saving'
			? '저장 중…'
			: status.kind === 'saved'
				? '저장됨'
				: status.kind === 'invalid' || status.kind === 'error'
					? status.message
					: post
						? ''
						: '제목과 본문을 쓰면 저장됩니다.';

	return (
		<div className="memo-writer" aria-label={post ? `${post.title} 편집` : '새 메모'}>
			<div className="memo-writer-meta">
				<DatePicker value={draft.date} onChange={(date) => change({ date })} />
				<span aria-hidden="true">·</span>
				<FolderPicker value={draft.category} folders={folders} onChange={(category) => change({ category })} />
				<span
					className={`memo-writer-status ${status.kind === 'invalid' || status.kind === 'error' ? 'problem' : ''}`}
					role="status"
				>
					{statusText}
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
				<InlineEditor markdown={draft.body} onChange={(body) => change({ body })} placeholder="본문을 쓰세요" />
			</Suspense>
		</div>
	);
};

export default PostWriter;
