// 목록용 글: 원문 없이 목록·사이드바·검색 조건이 쓰는 부분만 남긴 글. 저장소 글 247편의 원문(3.7MB)을 받기 전에 목록을 그린다.
// React와 DOM에 의존하지 않는 순수 함수만 둔다.
import { firstImage, type Post } from './posts.js';
import { tagsOf } from './tags.js';

/**
 * 본문에서 목록이 읽는 것만 남긴다. 목록 미리보기 그림(firstImage), 태그(tagsOf),
 * 검색 조건(체크리스트·표·이미지·코드·첨부 파일, posts.ts의 POST_FILTERS)이 원문과 같은 답을 내도록 그 줄만 모은다.
 * 요약(summary)은 원문으로 미리 만들어 두므로 여기 넣지 않는다
 */
export function listBody(body: string): string {
	const parts: string[] = [];
	const image = firstImage(body);
	if (image) parts.push(`![](${image})`);
	const checklist = /^\s*[-*+] \[[ xX]\]/m.exec(body);
	if (checklist) parts.push(`${checklist[0].trim()} .`);
	const table = /^\s*\|(?:\s*:?-+:?\s*\|)+\s*$/m.exec(body);
	if (table) parts.push(table[0].trim());
	if (/^\s*```/m.test(body)) parts.push('```\n```');
	const attachment = /\]\([^)\s]+ "첨부 파일[^"]*"\)/.exec(body);
	if (attachment) parts.push(`[첨부 파일]${attachment[0].slice(1)}`);
	const tags = tagsOf(body);
	if (tags.length) parts.push(tags.map((tag) => `#${tag}`).join(' '));
	return parts.join('\n\n');
}

/** 목록용 글: 본문을 listBody로 바꾸고 원문을 아직 받지 않았다고 표시한다 */
export const toListingPost = (post: Post): Post => ({ ...post, body: listBody(post.body), bodyPending: true });
