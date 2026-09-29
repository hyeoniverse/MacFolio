import React, { useEffect, useRef, useState } from 'react';
import { folderLabelOf } from '../posts';
import type { PostDraft } from '../postsApi';

interface Props {
	/** 고치는 글이면 처음 값, 새 글이면 null */
	initial: PostDraft | null;
	/** 고를 수 있는 폴더 */
	folders: string[];
	/** 새 글의 기본 폴더 */
	defaultFolder: string;
	/** 본문 미리 보기 (메모 본문과 같은 모양) */
	renderMarkdown: (body: string) => React.ReactNode;
	onSave: (draft: PostDraft) => Promise<string[] | null>;
	onCancel: () => void;
	onDelete?: () => void;
}

/** 오늘 (YYYY-MM-DD, 지역 시간) */
const today = () => {
	const now = new Date();
	return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

/**
 * 관리자의 글쓰기·편집. 본문은 Markdown으로 쓰고 미리 보기로 확인한다. ⌘S(Ctrl+S)로 저장.
 * 저장하면 서버가 규칙을 다시 확인하고, 어긴 규칙은 모두 보여 준다.
 */
const PostEditor: React.FC<Props> = ({
	initial,
	folders,
	defaultFolder,
	renderMarkdown,
	onSave,
	onCancel,
	onDelete,
}) => {
	const [draft, setDraft] = useState<PostDraft>(
		() => initial ?? { title: '', date: today(), category: defaultFolder, summary: '', body: '' }
	);
	const [preview, setPreview] = useState(false);
	const [errors, setErrors] = useState<string[]>([]);
	const [saving, setSaving] = useState(false);
	const titleRef = useRef<HTMLInputElement>(null);
	const options = folders.includes(draft.category) ? folders : [draft.category, ...folders];

	useEffect(() => {
		titleRef.current?.focus();
	}, []);

	const update =
		(field: keyof PostDraft) =>
		(event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
			setDraft((prev) => ({ ...prev, [field]: event.target.value }));

	const save = async () => {
		if (saving) return;
		setSaving(true);
		const problems = await onSave(draft);
		setSaving(false);
		setErrors(problems ?? []);
	};

	return (
		<form
			className="memo-editor"
			aria-label={initial ? '메모 편집' : '새 메모'}
			onSubmit={(event) => {
				event.preventDefault();
				void save();
			}}
			onKeyDown={(event) => {
				if ((event.metaKey || event.ctrlKey) && event.key === 's') {
					event.preventDefault();
					void save();
				}
				if (event.key === 'Escape') onCancel();
			}}
		>
			<input
				ref={titleRef}
				className="memo-editor-title"
				aria-label="제목"
				placeholder="제목"
				value={draft.title}
				onChange={update('title')}
			/>
			<div className="memo-editor-meta">
				<label>
					<span>날짜</span>
					<input type="date" aria-label="날짜" value={draft.date} onChange={update('date')} />
				</label>
				<label>
					<span>폴더</span>
					<select aria-label="폴더" value={draft.category} onChange={update('category')}>
						{options.map((folder) => (
							<option key={folder} value={folder}>
								{folderLabelOf(folder)}
							</option>
						))}
					</select>
				</label>
				<label className="wide">
					<span>요약</span>
					<input
						aria-label="요약"
						placeholder="목록에 보일 한 줄 (비우면 본문 앞부분)"
						value={draft.summary}
						onChange={update('summary')}
					/>
				</label>
			</div>

			<div className="memo-editor-tabs" role="group" aria-label="쓰기와 미리 보기">
				<button type="button" aria-pressed={!preview} onClick={() => setPreview(false)}>
					쓰기
				</button>
				<button type="button" aria-pressed={preview} onClick={() => setPreview(true)}>
					미리 보기
				</button>
				<span className="memo-editor-hint">Markdown · ⌘S 저장</span>
			</div>
			{preview ? (
				<div className="memo-editor-preview memo-markdown">
					{draft.body.trim() ? renderMarkdown(draft.body) : <p className="memo-empty">본문이 비어 있습니다.</p>}
				</div>
			) : (
				<textarea
					className="memo-editor-body"
					aria-label="본문"
					placeholder={'## 소제목\n\n본문을 Markdown으로 씁니다. 이미지는 ![설명](주소)'}
					value={draft.body}
					onChange={update('body')}
				/>
			)}

			{errors.length > 0 && (
				<ul className="memo-editor-errors" role="alert">
					{errors.map((error) => (
						<li key={error}>{error}</li>
					))}
				</ul>
			)}
			<div className="memo-editor-actions">
				{onDelete && (
					<button type="button" className="memo-comment-button danger" onClick={onDelete}>
						삭제
					</button>
				)}
				<span className="memo-toolbar-spacer" />
				<button type="button" className="memo-comment-button" onClick={onCancel}>
					취소
				</button>
				<button type="submit" className="memo-comment-button primary" disabled={saving}>
					{saving ? '저장 중…' : '저장'}
				</button>
			</div>
		</form>
	);
};

export default PostEditor;
