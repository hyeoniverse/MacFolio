import type { WidgetSize } from './catalog';
import { seoulDate, shortDate } from './model';
import { useNow } from './useNow';
import { useRecentPosts } from './useRecentPosts';

/**
 * 메모 앱의 최근 글 (빌드할 때 넣은 저장소 글과 서버에 쓴 글). macOS 메모 위젯처럼 노란 머리띠 아래 한 줄씩.
 * 글을 누르면 메모 앱이 그 글을 연다
 */
const PostsWidget = ({ size, openPost }: { size: WidgetSize; openPost: (slug: string) => void }) => {
	const today = seoulDate(useNow(60_000));
	const posts = useRecentPosts(size === 'medium' ? 3 : 2);
	return (
		<div className="widget-posts-body">
			<p className="widget-posts-header">
				<i className="fa-regular fa-folder" aria-hidden="true"></i> 최근 글
			</p>
			{posts.length === 0 ? (
				<p className="widget-note widget-posts-empty">아직 글이 없습니다</p>
			) : (
				<ul>
					{posts.map((post) => (
						<li key={post.slug}>
							<button type="button" onClick={() => openPost(post.slug)}>
								<strong>{post.title}</strong>
								<span className="widget-note">{shortDate(post.date, today)}</span>
							</button>
						</li>
					))}
				</ul>
			)}
		</div>
	);
};

export default PostsWidget;
