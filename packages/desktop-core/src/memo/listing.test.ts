import { describe, expect, it } from 'vitest';
import { listBody, toListingPost } from './listing.js';
import { firstImage, POST_FILTERS, type Post } from './posts.js';
import { postSlug } from './rules.js';
import { tagsOf } from './tags.js';

const BODY = [
	'처음 문단. 코드 `#notatag`와 링크 [글](https://example.com/#anchor)는 태그가 아니다.',
	'',
	'![첫 그림](./images/first.jpg "캡션")',
	'',
	'| 칸 | 값 |',
	'| --- | ---: |',
	'| a | 1 |',
	'',
	'- [x] 끝낸 일 #체크',
	'',
	'```ts',
	"const color = '#edbb4d'; // #코드안",
	'```',
	'',
	'[notes.md](https://api.example.com/files/abc "첨부 파일 · notes.md")',
	'',
	'![둘째 그림](./images/second.png)',
	'',
	'#React #상태관리 #react',
].join('\n');

const post = (body: string): Post => ({
	slug: postSlug('sample')!,
	title: '제목',
	date: '2026-10-31',
	category: '개발 기록/MacFolio/화면·스타일',
	summary: '요약',
	body,
});

describe('목록용 본문 (listBody)', () => {
	it('미리보기 그림과 태그가 원문과 같다', () => {
		const digest = listBody(BODY);
		expect(firstImage(digest)).toBe(firstImage(BODY));
		expect(tagsOf(digest)).toEqual(tagsOf(BODY));
		expect(digest.length).toBeLessThan(BODY.length);
	});

	it('검색 조건(체크리스트·표·이미지·코드·첨부 파일)이 원문과 같은 답을 낸다', () => {
		const filters = POST_FILTERS.filter((filter) =>
			['checklist', 'table', 'image', 'code', 'attachment'].includes(filter.id)
		);
		expect(filters).toHaveLength(5);
		for (const body of [BODY, '그림도 표도 없는 글. #태그']) {
			for (const filter of filters) expect(filter.test(post(listBody(body))), filter.id).toBe(filter.test(post(body)));
		}
	});

	it('아무것도 없는 본문은 빈 문자열', () => {
		expect(listBody('그냥 문장만 있는 글.')).toBe('');
	});

	it('목록용 글은 원문을 받지 않았다고 표시한다', () => {
		const listed = toListingPost(post(BODY));
		expect(listed.bodyPending).toBe(true);
		expect(listed.body).toBe(listBody(BODY));
		expect(listed.summary).toBe('요약');
	});
});
