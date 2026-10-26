import { type Post } from '@macfolio/desktop-core/memo';
import { NoteItem } from './NoteList';
import '@/apps/memo/components/SimilarResults.css';

/** 받침이 있으면 '을', 없으면 '를' (한글로 끝나지 않으면 '를') */
const objectParticle = (word: string) => {
	const code = word.charCodeAt(word.length - 1);
	return code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0 ? '을' : '를';
};

/**
 * 검색 결과가 없을 때 목록 칸: 맨 위 안내 줄, 고친 검색어 ("혹시 ○○를 찾으셨나요?", 누르면 그 검색어로),
 * 제목·주소·태그의 철자가 비슷한 글 (desktop-core의 search.ts). 비슷한 글은 일반 목록과 같은 행으로 그린다
 */
const SimilarResults = ({
	suggestion,
	posts,
	today,
	onSuggest,
	onOpen,
}: {
	suggestion: string | null;
	posts: Post[];
	today: Date;
	onSuggest: (query: string) => void;
	onOpen: (post: Post) => void;
}) => (
	<section className="memo-search-empty" aria-label="비슷한 검색 결과">
		<p className="memo-empty memo-search-empty-title">검색 결과가 없습니다.</p>
		{suggestion && (
			<p className="memo-search-suggest">
				혹시{' '}
				<button type="button" onClick={() => onSuggest(suggestion)}>
					{suggestion}
				</button>
				{objectParticle(suggestion)} 찾으셨나요?
			</p>
		)}
		{posts.length > 0 && (
			<>
				<h3 className="memo-section-title">비슷한 글</h3>
				<ul className="memo-items" aria-label="비슷한 글">
					{posts.map((post) => (
						<li key={post.slug}>
							<NoteItem
								post={post}
								picked={null}
								dragging={false}
								drag={{}}
								active={false}
								today={today}
								onOpen={() => onOpen(post)}
							/>
						</li>
					))}
				</ul>
			</>
		)}
	</section>
);

export default SimilarResults;
