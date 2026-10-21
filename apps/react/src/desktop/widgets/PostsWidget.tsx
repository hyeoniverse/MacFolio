import RECENT_POSTS from 'virtual:recent-posts';
import type { WidgetSize } from './catalog';
import { seoulDate, shortDate } from './model';
import { useNow } from './useNow';

/** 메모 앱의 최근 글 (빌드할 때 넣은 저장소 글). 글을 누르면 메모 앱이 그 글을 연다 */
const PostsWidget = ({ size, openPost }: { size: WidgetSize; openPost: (slug: string) => void }) => {
	const today = seoulDate(useNow(60_000));
	const posts = RECENT_POSTS.slice(0, size === 'medium' ? 3 : 1);
	return (
		<div className="widget-posts-body">
			<p className="widget-posts-header">
				<i className="fa-solid fa-note-sticky" aria-hidden="true"></i> 최근 글
			</p>
			{posts.length === 0 ? (
				<p className="widget-note">아직 글이 없습니다</p>
			) : (
				<ul>
					{posts.map((post) => (
						<li key={post.slug}>
							<button type="button" onClick={() => openPost(post.slug)}>
								<strong>{post.title}</strong>
								<span className="widget-note">
									{shortDate(post.date, today)} · {post.category.split('/').at(-1)}
								</span>
							</button>
						</li>
					))}
				</ul>
			)}
		</div>
	);
};

export default PostsWidget;
