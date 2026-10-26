import { type Post } from '@macfolio/desktop-core/memo';
import { SuggestLine } from './SimilarResults';
import '@/apps/memo/components/SearchEmptyReader.css';

/**
 * 검색 결과가 없을 때 본문 칸 가운데: 검색어에 맞는 메모가 없다는 안내, 고친 검색어, 비슷한 글이 목록에 있다는 안내와 첫 글 열기.
 * 목록 칸과 본문 칸이 함께 보일 때만 쓴다 (한 칸씩 보는 휴대폰은 목록 칸에 이미 보인다)
 */
const SearchEmptyReader = ({
	query,
	suggestion,
	posts,
	onSuggest,
	onOpen,
}: {
	query: string;
	suggestion: string | null;
	posts: Post[];
	onSuggest: (query: string) => void;
	onOpen: (post: Post) => void;
}) => (
	<section className="ui-empty memo-reader-empty memo-search-reader" aria-label="검색 결과 없음">
		<p className="memo-search-reader-title">‘{query.trim()}’에 맞는 메모가 없습니다.</p>
		{suggestion && <SuggestLine suggestion={suggestion} onSuggest={onSuggest} />}
		{posts.length > 0 && (
			<p className="memo-search-suggest">
				비슷한 글 {posts.length}편이 목록에 있습니다.{' '}
				<button type="button" className="memo-search-reader-open" onClick={() => onOpen(posts[0])}>
					첫 글 열기
				</button>
			</p>
		)}
	</section>
);

export default SearchEmptyReader;
