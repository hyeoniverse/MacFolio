import { useEffect, useState } from 'react';
import { env } from '@/shared/config/env';
import { useAdmin } from '@/shared/auth/adminStore';
import { avatarUrl } from '@/shared/auth/admin';
import { githubLogin, useProfile } from '@/shared/site/profileStore';
import { displayName, LIMITS, monogram, validateMessageInput } from '@/apps/messages/conversations';
import { fetchVisitorName } from '@/shared/lib/visitor';
import { createComment, deleteComment, formatCommentTime, listComments, type Comment } from './commentsApi';
import Button from '@/shared/ui/button/Button';
import Turnstile from '@/shared/ui/turnstile/Turnstile';
import { useHumanCheck } from '@/shared/security/security';
import LikeButton from '../likes/LikeButton';
import { setCommentLike, toggleLike } from '../likes/likesApi';

/** 프로필 동그라미: 작성자는 GitHub 사진, 방문자는 이름 첫 글자 */
const CommentAvatar = ({ name, owner }: { name: string; owner: boolean }) => {
	const profile = useProfile();
	return owner ? (
		<img className="memo-comment-avatar" src={avatarUrl(githubLogin(profile))} alt="" />
	) : (
		<span className="memo-comment-avatar" aria-hidden="true">
			{monogram(name)}
		</span>
	);
};

/** 댓글 하나. 지우기는 이 브라우저에서 쓴 댓글(관리자는 모든 댓글)에만 있고, 한 번 더 물어본다. 좋아요는 누구나 */
const CommentItem = ({
	comment,
	isAdmin,
	onDeleted,
}: {
	comment: Comment;
	isAdmin: boolean;
	onDeleted: () => void;
}) => {
	const ownerName = useProfile().name;
	const [likes, setLikes] = useState({ count: comment.likes, liked: comment.liked });
	const [liking, setLiking] = useState(false);
	const [asking, setAsking] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const canDelete = isAdmin || comment.mine;

	const remove = async () => {
		const result = await deleteComment(env.apiUrl, comment.id);
		if (result === 'ok' || result === 'not-found') return onDeleted();
		setError(
			result === 'forbidden'
				? '이 브라우저에서 쓴 댓글만 지울 수 있습니다.'
				: '지우지 못했습니다. 잠시 뒤 다시 시도해 주세요.'
		);
	};

	return (
		<li className={`memo-comment ${comment.isAdmin ? 'owner' : ''}`}>
			<CommentAvatar name={comment.name} owner={comment.isAdmin} />
			<div className="memo-comment-main">
				<div className="memo-comment-head">
					<strong>{comment.isAdmin ? ownerName : displayName(comment.name, comment.ipPrefix ?? undefined)}</strong>
					{comment.isAdmin && <span className="memo-comment-badge">작성자</span>}
					<time dateTime={comment.createdAt}>{formatCommentTime(comment.createdAt)}</time>
					{canDelete && (
						<button
							type="button"
							className="memo-comment-delete"
							aria-label={`${comment.name}의 댓글 삭제`}
							title="삭제"
							onClick={() => setAsking((value) => !value)}
						>
							<i className="fa-regular fa-trash-can" aria-hidden="true" />
						</button>
					)}
				</div>
				<p className="memo-comment-body">{comment.body}</p>
				<div className="memo-comment-actions">
					<LikeButton
						likes={likes}
						what={`${comment.isAdmin ? ownerName : comment.name}의 댓글`}
						size="comment"
						onToggle={() => {
							if (liking) return;
							setLiking(true);
							void toggleLike(likes, (liked) => setCommentLike(env.apiUrl, comment.id, liked), setLikes).then(() =>
								setLiking(false)
							);
						}}
					/>
				</div>
				{asking && (
					<div className="memo-comment-confirm" role="group" aria-label="댓글 삭제 확인">
						<span>이 댓글을 지울까요?</span>
						<Button onClick={() => setAsking(false)}>취소</Button>
						<Button tone="danger" onClick={() => void remove()}>
							삭제
						</Button>
					</div>
				)}
				{error && (
					<p className="memo-comment-error" role="alert">
						{error}
					</p>
				)}
			</div>
		</li>
	);
};

/**
 * 글 아래 댓글. 방문자는 이름·비밀번호 없이, 서버가 방문자 쿠키로 정한 이름(메시지 앱과 같은 이름)으로 쓴다.
 * 이 브라우저에서 쓴 댓글만 지운다. 관리자로 로그인했으면 김정현으로 쓰고 무엇이든 지운다. 서버가 권한을 다시 확인한다.
 */
const Comments = ({ slug, onCount }: { slug: string; onCount?: (slug: string, count: number) => void }) => {
	const ownerName = useProfile().name;
	const admin = useAdmin();
	const isAdmin = admin.status === 'signed-in';
	const [comments, setComments] = useState<Comment[] | null>(null);
	const [failed, setFailed] = useState(false);
	/** 이 브라우저의 이름 (예: 🦊 날쌘 여우) */
	const [name, setName] = useState<string | null>(null);
	const [body, setBody] = useState('');
	const [errors, setErrors] = useState<string[]>([]);
	const [sending, setSending] = useState(false);
	/** 사람 확인: 관리자가 시스템 설정에서 댓글에 켜면 (관리자에게는 없다) */
	const human = useHumanCheck('comment');

	useEffect(() => {
		if (!env.apiUrl) return;
		let cancelled = false;
		listComments(env.apiUrl, slug).then((list) => {
			if (cancelled) return;
			setComments(list ?? []);
			setFailed(list === null);
		});
		fetchVisitorName(env.apiUrl).then((visitor) => !cancelled && setName(visitor));
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
		// 메시지 앱과 같은 규칙으로 먼저 확인한다
		const { errors: invalid } = validateMessageInput({ text: body });
		if (invalid.text) return setErrors([invalid.text]);

		if (!human.ready) return setErrors(['사람인지 확인하는 칸이 끝날 때까지 기다려 주세요.']);

		setSending(true);
		const result = await createComment(env.apiUrl, slug, { body, turnstileToken: human.token ?? undefined });
		setSending(false);
		// 토큰은 한 번만 쓸 수 있다: 다음 댓글을 위해 새로 받는다
		if (human.siteKey) human.reset();
		if (!result.ok) return setErrors(result.errors);
		setErrors([]);
		setBody('');
		if (!result.comment.isAdmin) setName(result.comment.name);
		setComments((list) => [...(list ?? []), result.comment]);
		onCount?.(slug, (comments?.length ?? 0) + 1);
	};

	return (
		<section className="memo-comments" aria-label="댓글">
			<h2>
				댓글 <span>{comments?.length ?? ''}</span>
			</h2>
			{failed && <p className="memo-comments-note">댓글을 불러오지 못했습니다.</p>}
			{comments && comments.length === 0 && !failed && (
				<p className="memo-comments-note">아직 댓글이 없어요. 첫 댓글을 남겨 주세요.</p>
			)}
			{comments && comments.length > 0 && (
				<ul className="memo-comment-list">
					{comments.map((comment) => (
						<CommentItem
							key={comment.id}
							comment={comment}
							isAdmin={isAdmin}
							onDeleted={() => {
								setComments((list) => list?.filter((item) => item.id !== comment.id) ?? null);
								onCount?.(slug, (comments?.length ?? 1) - 1);
							}}
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
					<div className="memo-comment-as">
						<CommentAvatar name={ownerName} owner />
						<span>
							<strong>{ownerName}</strong>(작성자)으로 씁니다.
						</span>
					</div>
				) : (
					name && (
						<div className="memo-comment-as">
							<span>
								<strong>{name}</strong> 이름으로 씁니다.
							</span>
						</div>
					)
				)}
				<textarea
					aria-label="댓글 내용"
					placeholder="댓글을 남겨 주세요"
					rows={3}
					maxLength={LIMITS.text.max}
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
				{human.siteKey && (
					<Turnstile
						className="memo-comment-turnstile"
						siteKey={human.siteKey}
						resetKey={human.resetKey}
						onToken={human.setToken}
					/>
				)}
				<div className="memo-comment-footer">
					<span className="memo-comment-count">
						{body.length}/{LIMITS.text.max}
					</span>
					{/* 사람 확인을 켰으면 토큰이 올 때까지 끈다: 댓글을 쓴 직후 새 토큰을 받는 사이에 누르면 보내지 못한다 */}
					<Button tone="primary" type="submit" disabled={sending || !human.ready}>
						{sending ? '등록 중…' : human.ready ? '등록' : '확인 중…'}
					</Button>
				</div>
			</form>
		</section>
	);
};

export default Comments;
