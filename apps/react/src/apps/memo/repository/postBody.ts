import { toPost, type PostSlug } from '@macfolio/desktop-core/memo';

// 저장소 글의 원문을 한 편씩 (파일 경로 → 그 글만 담은 청크를 받는 함수). 메모 앱만 쓴다: 첫 화면 묶음에 이 목록(247편)이 들어가지 않게 index.ts와 나눴다.
// contentFiles.ts(전체 원문 한 묶음)와 같은 파일이지만 쿼리(&single)가 달라 번들러가 글마다 따로 청크를 만든다
const sources = import.meta.glob<string>('../content/*.md', { query: '?raw&single', import: 'default' });

/**
 * 글 한 편의 본문. 메모는 목록용 글(virtual:post-list)로 먼저 그리므로, 연 글의 본문은 전체 묶음보다 먼저 이것으로 받는다.
 * 저장소에 없는 글이거나 머리말이 잘못되었으면 null
 */
export async function loadPostBody(slug: PostSlug): Promise<string | null> {
	const load = sources[`../content/${slug}.md`];
	return load ? (toPost(slug, await load())?.body ?? null) : null;
}
