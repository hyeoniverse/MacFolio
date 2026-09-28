import { describe, expect, it } from 'vitest';
import {
	buildFolderTree,
	firstImage,
	inFolder,
	ALL_CATEGORY,
	excerpt,
	filterPosts,
	formatPostDate,
	parseFrontmatter,
	resolveImageSrc,
	sortPosts,
	toPost,
	type Post,
} from './posts';

const post = (slug: string, date: string, category: string, title = slug, body = ''): Post => ({
	slug,
	title,
	date,
	category,
	summary: '',
	body,
});

describe('parseFrontmatter', () => {
	it('머리말과 본문을 나눈다', () => {
		const { meta, body } = parseFrontmatter('---\ntitle: 안녕\ndate: 2026-09-28\n---\n\n# 본문\n');
		expect(meta).toEqual({ title: '안녕', date: '2026-09-28' });
		expect(body).toBe('\n# 본문\n');
	});

	it('따옴표로 감싼 값과 콜론이 들어간 값', () => {
		expect(parseFrontmatter('---\ntitle: "A: B"\nsummary: \'요약\'\n---\n').meta).toEqual({
			title: 'A: B',
			summary: '요약',
		});
	});

	it('머리말이 없으면 본문 전체', () => {
		expect(parseFrontmatter('# 제목만')).toEqual({ meta: {}, body: '# 제목만' });
	});

	it('Windows 줄바꿈(CRLF)도 읽는다', () => {
		expect(parseFrontmatter('---\r\ntitle: 윈도우\r\n---\r\n본문').meta.title).toBe('윈도우');
	});
});

describe('excerpt', () => {
	it('Markdown 문법을 걷어 내고 길면 자른다', () => {
		const text = excerpt('# 제목\n\n**굵게** [링크](https://a.b) `코드`\n\n```js\nconst x = 1;\n```\n끝', 100);
		expect(text).toBe('제목 굵게 링크 코드 끝');
		expect(excerpt('가'.repeat(100), 10)).toBe(`${'가'.repeat(10)}…`);
	});
});

describe('toPost', () => {
	it('요약이 없으면 본문 앞부분, 카테고리가 없으면 기타', () => {
		expect(toPost('a', '---\ntitle: 제목\ndate: 2026-09-28\n---\n본문입니다')).toEqual({
			slug: 'a',
			title: '제목',
			date: '2026-09-28',
			category: '기타',
			summary: '본문입니다',
			body: '본문입니다',
		});
	});

	it('제목이나 날짜 형식이 잘못되면 null', () => {
		expect(toPost('a', '---\ndate: 2026-09-28\n---\n')).toBeNull();
		expect(toPost('a', '---\ntitle: t\ndate: 9월 28일\n---\n')).toBeNull();
	});
});

describe('목록', () => {
	const posts = [
		post('a', '2026-09-01', '회고', 'A', 'vite 이야기'),
		post('b', '2026-09-28', '개발기', 'B', 'React 이야기'),
		post('c', '2026-09-28', '개발기', 'C', ''),
	];

	it('최신 글이 위, 같은 날은 제목 순', () => {
		expect(sortPosts(posts).map((p) => p.slug)).toEqual(['b', 'c', 'a']);
	});

	it('카테고리와 검색어(제목·본문, 대소문자 무시)로 거른다', () => {
		expect(filterPosts(posts, '개발기', '').map((p) => p.slug)).toEqual(['b', 'c']);
		expect(filterPosts(posts, ALL_CATEGORY, 'VITE').map((p) => p.slug)).toEqual(['a']);
		expect(filterPosts(posts, '회고', 'react')).toEqual([]);
	});
});

describe('formatPostDate', () => {
	it('YYYY-MM-DD를 한국식 날짜로', () => {
		expect(formatPostDate('2026-09-08')).toBe('2026. 9. 8.');
	});
});

describe('resolveImageSrc', () => {
	const images = { 'images/chart.svg': '/assets/chart-abc123.svg' };

	it('글 파일 기준 상대 경로는 빌드된 주소로', () => {
		expect(resolveImageSrc('./images/chart.svg', images)).toBe('/assets/chart-abc123.svg');
		expect(resolveImageSrc('images/chart.svg', images)).toBe('/assets/chart-abc123.svg');
	});

	it('public 경로, 외부 주소, data URL은 그대로', () => {
		expect(resolveImageSrc('/imgs/me.png', images)).toBe('/imgs/me.png');
		expect(resolveImageSrc('https://example.com/a.png', images)).toBe('https://example.com/a.png');
		expect(resolveImageSrc('data:image/png;base64,AAAA', images)).toBe('data:image/png;base64,AAAA');
	});

	it('없는 파일이나 빈 주소는 null', () => {
		expect(resolveImageSrc('./images/none.png', images)).toBeNull();
		expect(resolveImageSrc(undefined, images)).toBeNull();
	});
});

describe('폴더', () => {
	const post = (category: string, slug = category): Post => ({
		slug,
		title: slug,
		date: '2026-09-28',
		category,
		summary: '',
		body: '',
	});
	const posts = [post('개발기/MacFolio', 'a'), post('개발기/MacFolio', 'b'), post('개발기', 'c'), post('회고', 'd')];

	it("category의 '/'로 하위 폴더를 만들고, 상위 폴더는 하위 폴더의 글까지 센다", () => {
		expect(buildFolderTree(posts)).toEqual([
			{
				name: '개발기',
				path: '개발기',
				count: 3,
				children: [{ name: 'MacFolio', path: '개발기/MacFolio', count: 2, children: [] }],
			},
			{ name: '회고', path: '회고', count: 1, children: [] },
		]);
	});

	it('상위 폴더를 고르면 하위 폴더의 글도 보인다', () => {
		expect(inFolder(posts[0], '개발기')).toBe(true);
		expect(inFolder(posts[0], '개발')).toBe(false);
		expect(filterPosts(posts, '개발기', '').map((p) => p.slug)).toEqual(['a', 'b', 'c']);
	});
});

describe('firstImage', () => {
	it('본문의 첫 이미지 주소를 찾는다', () => {
		expect(firstImage('글\n\n![설명](./images/a.png "캡션")\n![b](b.png)')).toBe('./images/a.png');
		expect(firstImage('이미지 없음')).toBeNull();
	});
});
