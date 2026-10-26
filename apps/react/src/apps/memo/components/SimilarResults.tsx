import { folderName, type Post } from '@macfolio/desktop-core/memo';
import Button from '@/shared/ui/button/Button';
import '@/apps/memo/components/SimilarResults.css';

/**
 * 검색 결과가 없을 때: 고친 검색어("혹시 ○○?")와, 제목·주소·태그의 철자가 비슷한 글 (desktop-core의 search.ts).
 * 고친 검색어를 누르면 그 검색어로 다시 찾고, 글을 누르면 검색어를 지우고 그 글을 연다
 */
const SimilarResults = ({
	suggestion,
	posts,
	onSuggest,
	onOpen,
}: {
	suggestion: string | null;
	posts: Post[];
	onSuggest: (query: string) => void;
	onOpen: (post: Post) => void;
}) => {
	if (!suggestion && posts.length === 0) return null;
	return (
		<section className="memo-similar" aria-label="비슷한 검색 결과">
			{suggestion && (
				<p className="memo-similar-suggest">
					<span>혹시 이 검색어인가요?</span>
					<Button onClick={() => onSuggest(suggestion)}>{suggestion}</Button>
				</p>
			)}
			{posts.length > 0 && (
				<>
					<h3 className="memo-similar-title">비슷한 글</h3>
					<ul className="memo-similar-list">
						{posts.map((post) => (
							<li key={post.slug}>
								<button type="button" onClick={() => onOpen(post)}>
									<strong>{post.title}</strong>
									<span>
										<i className="fa-regular fa-folder" aria-hidden="true" /> {folderName(post.category)}
									</span>
								</button>
							</li>
						))}
					</ul>
				</>
			)}
		</section>
	);
};

export default SimilarResults;
