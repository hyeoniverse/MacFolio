import Comments from '../comments/Comments';
import type { Post } from '@macfolio/desktop-core/memo';

/** 글 아래: 같은 폴더 안의 이전 글·다음 글(날짜 순), 댓글 */
const PostFooter = ({
	post,
	older,
	newer,
	onOpen,
}: {
	post: Post;
	older: Post | null;
	newer: Post | null;
	onOpen: (post: Post) => void;
}) => (
	<>
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
		<Comments slug={post.slug} />
	</>
);

export default PostFooter;
