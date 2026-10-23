import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PROJECTS } from '../src/shared/profile';
import {
	cardImage,
	createdTimes,
	markdownHtml,
	recentPosts,
	rssXml,
	seoPosts,
	sitemapXml,
	updatedDates,
} from './posts';
import { ogCardVersion } from './site';

const post = (title: string, date: string, body: string) =>
	`---\ntitle: ${title}\ndate: ${date}\ncategory: 개발기\nsummary: ${title} 요약\n---\n\n${body}`;

describe('검색엔진용 파일', () => {
	it('글을 최신 순으로, 태그와 본문 HTML까지', async () => {
		const posts = await seoPosts({
			'./content/old.md': post('옛 글', '2026-01-01', '본문'),
			'./content/new.md': post('새 글', '2026-02-01', '## 제목\n\n| a |\n| - |\n| b |\n\n#MacFolio #SEO'),
			'./content/broken.md': '머리말 없음',
		});
		expect(posts.map((item) => item.slug)).toEqual(['new', 'old']);
		expect(posts[0]).toMatchObject({
			title: '새 글',
			summary: '새 글 요약',
			category: '개발기',
			tags: ['MacFolio', 'SEO'],
		});
		expect(posts[0].html).toContain('<h2>제목</h2>');
		expect(posts[0].html).toContain('<table>');
	});

	it('본문의 HTML은 그리지 않고 글자로, 찾지 못한 그림은 뺀다', () => {
		const html = markdownHtml('<script>alert(1)</script>\n\n![그림](./a.png) 220~440px');
		expect(html).not.toContain('<script>');
		expect(html).not.toContain('<img');
		expect(html).toContain('220~440px');
	});

	it('그림은 빌드한 주소로 바꾸고 대체 글과 설명을 둔다', () => {
		const html = markdownHtml('![창 "캡처"](./images/a.jpg \'설명\')', { 'images/a.jpg': '/assets/a-1.jpg' });
		expect(html).toContain('<img src="/assets/a-1.jpg" alt="창 &quot;캡처&quot;" title="설명" loading="lazy"/>');
	});

	it('공유 카드 그림: 본문의 첫 사진(SVG는 건너뛴다), 없으면 없다', () => {
		const images = { 'images/flow.svg': '/assets/flow-1.svg', 'images/shot.png': '/assets/shot-1.png' };
		expect(cardImage('![흐름](./images/flow.svg)\n\n![화면](images/shot.png)', images)).toBe(
			'https://macfolio.hyeoniverse.com/assets/shot-1.png'
		);
		expect(cardImage('![바깥](https://example.com/a.webp)', {})).toBe('https://example.com/a.webp');
		expect(cardImage('![흐름](./images/flow.svg) ![없음](./images/none.jpg)', images)).toBeUndefined();
	});

	it('git 기록에서 글마다 마지막으로 고친 날, 글 날짜보다 뒤일 때만', async () => {
		const updated = updatedDates('\x002026-02-03\n\nnew.md\nimages/a.png\n\x002026-01-05\n\nnew.md\nold.md\n');
		expect(updated).toEqual({ new: '2026-02-03', old: '2026-01-05' });
		const posts = await seoPosts(
			{
				'./content/old.md': post('옛 글', '2026-01-05', '본문'),
				'./content/new.md': post('새 글', '2026-02-01', '![화면](./images/a.png)'),
			},
			{ updated, images: { 'images/a.png': '/assets/a-1.png' } }
		);
		expect(posts[0]).toMatchObject({
			slug: 'new',
			updated: '2026-02-03',
			image: 'https://macfolio.hyeoniverse.com/assets/a-1.png',
		});
		expect(posts[1]).not.toHaveProperty('updated');
		expect(posts[1]).not.toHaveProperty('image');
	});

	it('sitemap: 첫 화면, 모든 글(lastmod), 모든 프로젝트', () => {
		const xml = sitemapXml(
			[
				{ slug: 'a&b', date: '2026-02-01' },
				{ slug: '한글', date: '2026-01-01' },
			],
			['qru']
		);
		expect(xml).toContain('<loc>https://macfolio.hyeoniverse.com/</loc><lastmod>2026-02-01</lastmod>');
		expect(xml).toContain('<loc>https://macfolio.hyeoniverse.com/memo/a%26b</loc><lastmod>2026-02-01</lastmod>');
		expect(xml).toContain(`<loc>https://macfolio.hyeoniverse.com/memo/${encodeURIComponent('한글')}</loc>`);
		expect(xml).toContain('<loc>https://macfolio.hyeoniverse.com/safari/qru</loc>');
	});

	it('공유 카드 버전: 8자리, 제목·날짜·분류가 같으면 같고 하나라도 바뀌면 다르다', () => {
		const post = { title: '제목', date: '2026-10-21', category: '개발기' };
		expect(ogCardVersion(post)).toMatch(/^[0-9a-f]{8}$/);
		expect(ogCardVersion({ ...post })).toBe(ogCardVersion(post));
		for (const patch of [{ title: '제목!' }, { date: '2026-10-22' }, { category: '기타' }])
			expect(ogCardVersion({ ...post, ...patch })).not.toBe(ogCardVersion(post));
	});

	it('sitemap: 고친 글의 lastmod는 고친 날', () => {
		const xml = sitemapXml([{ slug: 'a', date: '2026-01-01', updated: '2026-03-01' }], []);
		expect(xml).toContain('<loc>https://macfolio.hyeoniverse.com/</loc><lastmod>2026-03-01</lastmod>');
		expect(xml).toContain('<loc>https://macfolio.hyeoniverse.com/memo/a</loc><lastmod>2026-03-01</lastmod>');
	});

	it('rss: 채널과 글마다 제목·주소·날짜(한국 시각 0시)·분류·요약', () => {
		const xml = rssXml(
			[{ slug: 'a&b', title: '<제목>', date: '2026-02-01', summary: '요약 & 끝', category: '개발기' }],
			{ title: '김정현의 Mac', description: '설명' }
		);
		expect(xml).toContain('<rss version="2.0"');
		expect(xml).toContain('<title>김정현의 Mac</title>');
		expect(xml).toContain('<lastBuildDate>Sat, 31 Jan 2026 15:00:00 GMT</lastBuildDate>');
		expect(xml).toContain(
			'<item><title>&lt;제목&gt;</title><link>https://macfolio.hyeoniverse.com/memo/a%26b</link>' +
				'<guid isPermaLink="true">https://macfolio.hyeoniverse.com/memo/a%26b</guid>' +
				'<pubDate>Sat, 31 Jan 2026 15:00:00 GMT</pubDate><category>개발기</category>' +
				'<description>요약 &amp; 끝</description></item>'
		);
	});

	// 저장소의 글을 모두 HTML로 바꾸므로 글이 늘수록 느려진다. 로컬 1초, CI 3~8초라 기본 5초로는 CI에서 가끔 끊긴다
	it('저장소의 모든 글과 프로젝트가 sitemap에 있다', { timeout: 30_000 }, async () => {
		const dir = fileURLToPath(new URL('../src/apps/memo/content', import.meta.url));
		const names = readdirSync(dir).filter((name) => name.endsWith('.md'));
		const posts = await seoPosts(
			Object.fromEntries(names.map((name) => [`./content/${name}`, readFileSync(join(dir, name), 'utf8')]))
		);
		expect(posts).toHaveLength(names.length);
		const xml = sitemapXml(
			posts,
			DEFAULT_PROJECTS.map((project) => project.id)
		);
		for (const name of names) expect(xml).toContain(`/memo/${encodeURIComponent(name.replace(/\.md$/, ''))}</loc>`);
		for (const project of DEFAULT_PROJECTS) expect(xml).toContain(`/safari/${project.id}</loc>`);
	});
});

describe('올린 시각 (같은 날 글의 순서)', () => {
	it('git 기록(최신 커밋이 먼저)에서 글마다 처음 더한 시각을 UTC로 읽는다. 그림과 하위 폴더는 뺀다', () => {
		const log =
			'\x002026-10-22T15:00:00+09:00\n\nevening.md\nimages/evening-a.png\n' +
			'\x002026-10-22T09:00:00+09:00\n\nmorning.md\n' +
			'\x002026-01-01T09:00:00+09:00\n\nevening.md\n';
		expect(createdTimes(log)).toEqual({
			evening: '2026-01-01T00:00:00.000Z',
			morning: '2026-10-22T00:00:00.000Z',
		});
		expect(createdTimes('')).toEqual({});
	});

	it('같은 날 글은 나중에 올린 글이 먼저 (메모 목록·위젯·RSS가 같은 순서)', async () => {
		const files = {
			'./content/a-morning.md': '---\ntitle: 가 아침\ndate: 2026-10-22\n---\n본문',
			'./content/b-evening.md': '---\ntitle: 나 저녁\ndate: 2026-10-22\n---\n본문',
		};
		const created = { 'a-morning': '2026-10-22T00:00:00.000Z', 'b-evening': '2026-10-22T08:00:00.000Z' };
		expect((await seoPosts(files, { created })).map((post) => post.slug)).toEqual(['b-evening', 'a-morning']);
		expect((await recentPosts(files, 5, '2026-10-22', created)).map((post) => post.slug)).toEqual([
			'b-evening',
			'a-morning',
		]);
		// 올린 시각을 모르면 제목 순
		expect((await seoPosts(files)).map((post) => post.slug)).toEqual(['a-morning', 'b-evening']);
	});
});
