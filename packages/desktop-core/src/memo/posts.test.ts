import { describe, expect, it } from 'vitest';
import {
	adjacentPosts,
	mergeAdminPosts,
	mergeServerPosts,
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
	daysUntilPurge,
	recentlyDeletedPosts,
	type AdminPost,
	type Post,
} from './posts.js';

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

	it('줄 처음의 #태그는 제목 표시가 아니라서 남긴다', () => {
		expect(excerpt('#리팩터링 #디자인\n## 소제목')).toBe('#리팩터링 #디자인 소제목');
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

	it('방문자가 만든 폴더는 글 0개로 들어가고 custom으로 표시된다', () => {
		const tree = buildFolderTree(posts, ['개발기/읽을거리', '새 폴더']);
		expect(tree.find((node) => node.name === '새 폴더')).toMatchObject({ count: 0, custom: true });
		const 개발기 = tree.find((node) => node.name === '개발기')!;
		expect(개발기.count).toBe(3);
		expect(개발기.custom).toBeUndefined();
		expect(개발기.children.map((child) => child.name)).toEqual(['MacFolio', '읽을거리']);
	});

	it('같은 층은 정한 순서를 따르고, 순서에 없는 폴더는 뒤에 가나다순', () => {
		const tree = buildFolderTree(posts, ['개발기/읽을거리', '새 폴더', '디자인'], ['새 폴더', '개발기/읽을거리']);
		expect(tree.map((node) => node.name)).toEqual(['새 폴더', '개발기', '디자인', '회고']);
		expect(tree.find((node) => node.name === '개발기')!.children.map((child) => child.name)).toEqual([
			'읽을거리',
			'MacFolio',
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

describe('adjacentPosts', () => {
	const make = (slug: string, date: string): Post => ({
		slug,
		title: slug,
		date,
		category: '기타',
		summary: '',
		body: '',
	});
	const posts = [make('b', '2026-09-28'), make('c', '2026-09-29'), make('a', '2026-09-01'), make('d', '2026-09-29')];

	it('이전 글은 더 오래된 글, 다음 글은 더 최근 글', () => {
		expect(adjacentPosts(posts, 'b')).toEqual({ older: posts[2], newer: posts[3] });
	});

	it('같은 날이면 제목 순으로 잇는다', () => {
		expect(adjacentPosts(posts, 'd')).toEqual({ older: posts[0], newer: posts[1] });
	});

	it('맨 끝 글에는 한쪽이 없고, 없는 글이면 둘 다 없다', () => {
		expect(adjacentPosts(posts, 'c').newer).toBeNull();
		expect(adjacentPosts(posts, 'a').older).toBeNull();
		expect(adjacentPosts(posts, 'nope')).toEqual({ older: null, newer: null });
	});
});

describe('mergeServerPosts', () => {
	const make = (slug: string, date: string, extra: Partial<Post> = {}): Post => ({
		slug,
		title: slug,
		date,
		category: '개발기',
		summary: slug,
		body: slug,
		...extra,
	});
	const server = (slug: string, extra: Partial<import('./posts.js').ServerPost> = {}) => ({
		slug,
		title: `${slug} (서버)`,
		date: '2026-09-29',
		category: '읽을거리',
		summary: '',
		body: '서버 본문',
		deleted: false,
		...extra,
	});

	it('같은 주소는 서버 글이 대신하고, 고정 여부는 저장소 글을 따른다. 요약이 없으면 본문 앞부분', () => {
		const merged = mergeServerPosts([make('a', '2026-09-01', { pinned: true })], [server('a')]);
		expect(merged).toEqual([
			{
				slug: 'a',
				title: 'a (서버)',
				date: '2026-09-29',
				category: '읽을거리',
				summary: '서버 본문',
				body: '서버 본문',
				pinned: true,
			},
		]);
	});

	it('지운 표시는 목록에서 빼고, 서버에만 있는 글은 더해 날짜 순으로', () => {
		const merged = mergeServerPosts(
			[make('a', '2026-09-01'), make('b', '2026-09-02')],
			[server('a', { deleted: true }), server('new', { date: '2026-09-30' })]
		);
		expect(merged.map((post) => post.slug)).toEqual(['new', 'b']);
	});
});

describe('mergeAdminPosts (관리자 목록)', () => {
	const content = (title: string, date = '2026-09-29') => ({
		title,
		date,
		category: '개발기',
		summary: '',
		body: `${title} 본문`,
	});
	const repo: Post = {
		slug: 'repo',
		title: '저장소 글',
		date: '2026-09-01',
		category: '개발기',
		summary: '',
		body: '원본',
		pinned: true,
	};
	const admin = (slug: string, extra: Partial<import('./posts.js').AdminPost>) => ({
		slug,
		published: null,
		publishedAt: null,
		draft: null,
		draftUpdatedAt: null,
		deleted: false,
		deletedAt: null,
		revisions: 0,
		...extra,
	});
	const TODAY = '2026-09-30';

	it('임시 저장이 있으면 그 내용을 보이고 상태를 단다', () => {
		const merged = mergeAdminPosts(
			[repo],
			[
				admin('repo', { draft: content('저장소 글 고치는 중') }),
				admin('new', { draft: content('새 글') }),
				admin('pub', { published: content('게시한 글'), draft: content('게시한 글 고치는 중') }),
				admin('same', { published: content('그대로') }),
			],
			TODAY
		);
		const bySlug = Object.fromEntries(merged.map((post) => [post.slug, post]));
		expect(bySlug.repo).toMatchObject({
			title: '저장소 글 고치는 중',
			pinned: true,
			status: { draftOnly: false, changed: true },
		});
		expect(bySlug.new).toMatchObject({ title: '새 글', status: { draftOnly: true, changed: false, scheduled: null } });
		expect(bySlug.pub).toMatchObject({ title: '게시한 글 고치는 중', status: { draftOnly: false, changed: true } });
		expect(bySlug.same.status).toEqual({ draftOnly: false, changed: false, scheduled: null });
	});

	it('날짜가 오늘보다 뒤인 게시 글은 예약, 지운 표시는 뺀다', () => {
		const merged = mergeAdminPosts(
			[repo],
			[admin('later', { published: content('예약 글', '2026-10-03') }), admin('repo', { deleted: true })],
			TODAY
		);
		expect(merged.map((post) => [post.slug, post.status?.scheduled])).toEqual([['later', '2026-10-03']]);
	});
});

describe('검색 조건', () => {
	const make = (slug: string, body: string, extra: Partial<Post> = {}): Post => ({
		slug,
		title: slug,
		date: '2026-09-29',
		category: '개발기',
		summary: '',
		body,
		...extra,
	});
	const posts = [
		make('check', '- [ ] 할 일'),
		make('table', '| a | b |\n| --- | :-: |\n| 1 | 2 |'),
		make('image', '![설명](./images/a.jpg)'),
		make('code', '```ts\nconst a = 1;\n```'),
		make('file', '[보고서.pdf](http://api/files/abc "첨부 파일 · 2 KB")'),
		make('link', '[그냥 링크](https://example.com) | 표 아님 |'),
		make('pin', '본문', { pinned: true }),
		make('draft', '본문', { status: { draftOnly: true, changed: false, scheduled: null } }),
		make('later', '본문', { status: { draftOnly: false, changed: false, scheduled: '2026-10-03' } }),
	];
	it.each([
		['checklist', ['check']],
		['table', ['table']],
		['image', ['image']],
		['code', ['code']],
		['attachment', ['file']],
		['pinned', ['pin']],
		['draft', ['draft']],
		['scheduled', ['later']],
	] as const)('%s', (filter, slugs) => {
		expect(filterPosts(posts, ALL_CATEGORY, '', filter).map((post) => post.slug)).toEqual(slugs);
	});

	it('검색어와 함께 쓴다', () => {
		expect(filterPosts(posts, ALL_CATEGORY, '할 일', 'checklist').map((post) => post.slug)).toEqual(['check']);
		expect(filterPosts(posts, ALL_CATEGORY, '없는 말', 'checklist')).toEqual([]);
	});
});

describe('recentlyDeletedPosts', () => {
	const repo = [post('repo', '2026-09-01', '개발기', '저장소 글')];
	const content = { title: '서버 글', date: '2026-09-30', category: '개발기', summary: '', body: '본문' };
	const admin = (slug: string, deletedAt: string | null, draft = content): AdminPost => ({
		slug,
		published: null,
		publishedAt: null,
		draft: slug === 'repo' ? null : draft,
		draftUpdatedAt: null,
		deleted: true,
		deletedAt,
		revisions: 0,
	});
	const now = new Date('2026-10-31T00:00:00Z');

	it('30일이 안 된 지운 글만, 최근에 지운 글이 위로. 저장소 글은 파일 내용으로', () => {
		const list = recentlyDeletedPosts(
			repo,
			[
				admin('repo', '2026-10-20T00:00:00Z'),
				admin('server', '2026-10-30T00:00:00Z'),
				admin('old', '2026-09-30T00:00:00Z'),
				admin('purged', null),
			],
			now
		);
		expect(list.map((item) => [item.slug, item.title])).toEqual([
			['server', '서버 글'],
			['repo', '저장소 글'],
		]);
		expect(list[0].deletedAt).toBe('2026-10-30T00:00:00Z');
	});

	it('남은 날: 지운 날은 30, 하루 지날 때마다 하나씩, 마지막 날은 1', () => {
		expect(daysUntilPurge('2026-10-31T00:00:00Z', now)).toBe(30);
		expect(daysUntilPurge('2026-10-21T00:00:00Z', now)).toBe(20);
		expect(daysUntilPurge('2026-10-01T12:00:00Z', now)).toBe(1);
	});
});
