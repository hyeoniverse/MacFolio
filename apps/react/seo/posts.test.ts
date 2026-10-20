import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PROJECTS } from '../src/shared/profile';
import { cardImage, markdownHtml, rssXml, seoPosts, sitemapXml, updatedDates } from './posts';

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
