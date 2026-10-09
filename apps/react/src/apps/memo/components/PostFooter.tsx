import Comments from '../comments/Comments';
import PostLike from '../likes/PostLike';
import type { Likes } from '../likes/likesApi';
import type { Post } from '@macfolio/desktop-core/memo';

/** 글 아래: 좋아요, 같은 폴더 안의 이전 글·다음 글(날짜 순), 댓글. 좋아요·댓글 수가 바뀌면 알린다 (인기글 순위) */
const PostFooter = ({
	post,
	older,
	newer,
	onOpen,
	onLikes,
	onComments,
}: {
	post: Post;
	older: Post | null;
	newer: Post | null;
	onOpen: (post: Post) => void;
	onLikes?: (slug: string, likes: Likes) => void;
	onComments?: (slug: string, count: number) => void;
}) => (
	<>
		<PostLike key={post.slug} slug={post.slug} onChange={onLikes} />
		{(older || newer) && (
			<nav className="memo-post-nav" aria-label="이전 글, 다음 글">
				{older ? (
					<button type="button" className="older" onClick={() => onOpen(older)}>
						<span>
							<i className="fa-solid fa-chevron-left" aria-hidden="true" /> 이전 글
						</span>
						<strong>{older.title}</strong>
					</button>
				) : (
					<span />
				)}
				{newer && (
					<button type="button" className="newer" onClick={() => onOpen(newer)}>
						<span>
							다음 글 <i className="fa-solid fa-chevron-right" aria-hidden="true" />
						</span>
						<strong>{newer.title}</strong>
					</button>
				)}
			</nav>
		)}
		<Comments slug={post.slug} onCount={onComments} />
	</>
);

export default PostFooter;
