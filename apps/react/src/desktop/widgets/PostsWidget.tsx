import { POSTS_MODE_LABEL, type PostsMode, type WidgetSize } from './catalog';
import { seoulDate, shortDate } from './model';
import { useNow } from './useNow';
import { useWidgetPosts } from './useRecentPosts';

/** 머리띠의 아이콘 */
const MODE_ICON: Record<PostsMode, string> = {
	recent: 'fa-regular fa-folder',
	popular: 'fa-solid fa-fire',
	random: 'fa-solid fa-shuffle',
};

/** 고른 글이 없을 때 */
const EMPTY_NOTE: Record<PostsMode, string> = {
	recent: '아직 글이 없습니다',
	popular: '아직 인기글이 없습니다',
	random: '아직 글이 없습니다',
};

/**
 * 메모 앱의 글 (빌드할 때 넣은 저장소 글과 서버에 쓴 글). macOS 메모 위젯처럼 노란 머리띠 아래 한 줄씩.
 * 최근 글·인기글·랜덤 중 고른 것을 보이고(mode), 글을 누르면 메모 앱이 그 글을 연다
 */
const PostsWidget = ({
	size,
	mode = 'recent',
	openPost,
}: {
	size: WidgetSize;
	mode?: PostsMode;
	openPost: (slug: string) => void;
}) => {
	const today = seoulDate(useNow(60_000));
	const { posts, loading } = useWidgetPosts(mode, size === 'medium' ? 3 : 2);
	return (
		<div className="widget-posts-body">
			<p className="widget-posts-header">
				<i className={MODE_ICON[mode]} aria-hidden="true"></i> {POSTS_MODE_LABEL[mode]}
			</p>
			{loading ? null : posts.length === 0 ? (
				<p className="widget-note widget-posts-empty">{EMPTY_NOTE[mode]}</p>
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
