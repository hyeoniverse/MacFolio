import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PROJECTS } from '../src/shared/profile';
import { markdownHtml, seoPosts, sitemapXml } from './posts';

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

	it('본문의 HTML은 그리지 않고 글자로, 그림은 뺀다', () => {
		const html = markdownHtml('<script>alert(1)</script>\n\n![그림](./a.png) 220~440px');
		expect(html).not.toContain('<script>');
		expect(html).not.toContain('<img');
		expect(html).toContain('220~440px');
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
