import type { Likes } from './likesApi';

/**
 * 좋아요 단추 (Apple 스타일): 하트와 수. 누르면 systemPink로 찬 하트 (다시 누르면 취소).
 * size: 글 아래(옅은 회색 캡슐, 수는 늘 보인다) 또는 댓글 줄(작은 하트, 0이면 수를 숨긴다)
 */
const LikeButton = ({
	likes,
	what,
	size,
	onToggle,
}: {
	likes: Likes;
	/** 화면 읽기 이름에 붙인다 (예: '글', '날쌘 여우의 댓글') */
	what: string;
	size: 'post' | 'comment';
	onToggle: () => void;
}) => (
	<button
		type="button"
		className={`memo-like ${size} ${likes.liked ? 'liked' : ''}`}
		aria-pressed={likes.liked}
		aria-label={`${what} 좋아요 ${likes.count}개`}
		title={likes.liked ? '좋아요 취소' : '좋아요'}
		onClick={onToggle}
	>
		<i className={`${likes.liked ? 'fa-solid' : 'fa-regular'} fa-heart`} aria-hidden="true" />
		<span>{size === 'post' || likes.count > 0 ? likes.count.toLocaleString() : ''}</span>
	</button>
);

export default LikeButton;
