import { useEffect, useState } from 'react';
import { env } from '@/shared/config/env';
import { useAdmin } from '@/shared/auth/adminStore';
import { displayName, OWNER_NAME, validateMessageInput } from '@/apps/messages/conversations';
import { createComment, deleteComment, formatCommentTime, listComments, type Comment } from './commentsApi';

/** 댓글 하나. 지우기는 방문자는 비밀번호를 물어 보고, 관리자는 바로 */
const CommentItem = ({
	comment,
	isAdmin,
	onDeleted,
}: {
	comment: Comment;
	isAdmin: boolean;
	onDeleted: () => void;
}) => {
	const [asking, setAsking] = useState(false);
	const [password, setPassword] = useState('');
	const [error, setError] = useState<string | null>(null);

	const remove = async () => {
		const result = await deleteComment(env.apiUrl, comment.id, isAdmin ? null : password);
		if (result === 'ok' || result === 'not-found') return onDeleted();
		setError(result === 'forbidden' ? '비밀번호가 맞지 않습니다.' : '지우지 못했습니다. 잠시 뒤 다시 시도해 주세요.');
	};

	return (
		<li className={`memo-comment ${comment.isAdmin ? 'owner' : ''}`}>
			<div className="memo-comment-head">
				<strong>{comment.isAdmin ? OWNER_NAME : displayName(comment.name, comment.ipPrefix ?? undefined)}</strong>
				{comment.isAdmin && <span className="memo-comment-badge">작성자</span>}
				<time dateTime={comment.createdAt}>{formatCommentTime(comment.createdAt)}</time>
				<button
					type="button"
					className="memo-comment-delete"
					aria-label={`${comment.name}의 댓글 삭제`}
					onClick={() => (isAdmin ? void remove() : setAsking((value) => !value))}
				>
					삭제
				</button>
			</div>
			<p className="memo-comment-body">{comment.body}</p>
			{asking && !isAdmin && (
				<form
					className="memo-comment-confirm"
					onSubmit={(event) => {
						event.preventDefault();
						void remove();
					}}
				>
					<input
						type="password"
						aria-label="댓글 비밀번호"
						placeholder="비밀번호"
						value={password}
						autoFocus
						onChange={(event) => setPassword(event.target.value)}
					/>
					<button type="submit">삭제</button>
					<button type="button" onClick={() => setAsking(false)}>
						취소
					</button>
				</form>
			)}
			{error && (
				<p className="memo-comment-error" role="alert">
					{error}
				</p>
			)}
		</li>
	);
};

/**
 * 글 아래 댓글. 방문자는 이름·비밀번호로 쓰고 같은 비밀번호로 지운다 (메시지 앱과 같은 규칙).
 * 관리자로 로그인했으면 김정현으로 쓰고 무엇이든 지운다. 서버가 규칙과 권한을 다시 확인한다.
 */
const Comments = ({ slug }: { slug: string }) => {
	const admin = useAdmin();
	const isAdmin = admin.status === 'signed-in';
	const [comments, setComments] = useState<Comment[] | null>(null);
	const [failed, setFailed] = useState(false);
	const [name, setName] = useState('');
	const [password, setPassword] = useState('');
	const [body, setBody] = useState('');
	const [errors, setErrors] = useState<string[]>([]);
	const [sending, setSending] = useState(false);

	useEffect(() => {
		if (!env.apiUrl) return;
		let cancelled = false;
		listComments(env.apiUrl, slug).then((list) => {
			if (cancelled) return;
			setComments(list ?? []);
			setFailed(list === null);
		});
		return () => {
			cancelled = true;
		};
	}, [slug]);

	if (!env.apiUrl) {
		return (
			<section className="memo-comments" aria-label="댓글">
				<h2>댓글</h2>
				<p className="memo-comments-note">댓글은 서버를 연결한 뒤 쓸 수 있어요.</p>
			</section>
		);
	}

	const submit = async () => {
		// 방문자 입력은 메시지 앱과 같은 규칙으로 먼저 확인한다
		if (!isAdmin) {
			const { errors: invalid } = validateMessageInput({ nickname: name, password, text: body });
			const messages = Object.values(invalid);
			if (messages.length > 0) return setErrors(messages);
		} else if (!body.trim()) return setErrors(['내용을 입력해주세요.']);

		setSending(true);
		const result = await createComment(env.apiUrl, slug, isAdmin ? { body } : { name, password, body });
		setSending(false);
		if (!result.ok) return setErrors(result.errors);
		setErrors([]);
		setBody('');
		setComments((list) => [...(list ?? []), result.comment]);
	};

	return (
		<section className="memo-comments" aria-label="댓글">
			<h2>
				댓글 <span>{comments?.length ?? ''}</span>
			</h2>
			{failed && <p className="memo-comments-note">댓글을 불러오지 못했습니다.</p>}
			{comments && comments.length === 0 && !failed && <p className="memo-comments-note">첫 댓글을 남겨 주세요.</p>}
			{comments && comments.length > 0 && (
				<ul className="memo-comment-list">
					{comments.map((comment) => (
						<CommentItem
							key={comment.id}
							comment={comment}
							isAdmin={isAdmin}
							onDeleted={() => setComments((list) => list?.filter((item) => item.id !== comment.id) ?? null)}
						/>
					))}
				</ul>
			)}

			<form
				className="memo-comment-form"
				aria-label="댓글 쓰기"
				onSubmit={(event) => {
					event.preventDefault();
					void submit();
				}}
			>
				{isAdmin ? (
					<p className="memo-comments-note">
						<strong>{OWNER_NAME}</strong>(작성자)으로 씁니다
					</p>
				) : (
					<div className="memo-comment-fields">
						<input
							aria-label="이름"
							placeholder="이름"
							value={name}
							onChange={(event) => setName(event.target.value)}
						/>
						<input
							type="password"
							aria-label="비밀번호"
							placeholder="비밀번호 (삭제할 때 필요)"
							value={password}
							onChange={(event) => setPassword(event.target.value)}
						/>
					</div>
				)}
				<textarea
					aria-label="댓글 내용"
					placeholder="댓글을 남겨 주세요"
					rows={3}
					value={body}
					onChange={(event) => setBody(event.target.value)}
				/>
				{errors.length > 0 && (
					<ul className="memo-comment-error" role="alert">
						{errors.map((error) => (
							<li key={error}>{error}</li>
						))}
					</ul>
				)}
				<button type="submit" className="memo-comment-submit" disabled={sending}>
					{sending ? '등록 중…' : '등록'}
				</button>
			</form>
		</section>
	);
};

export default Comments;
