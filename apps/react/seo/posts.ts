// 빌드할 때 만드는 검색엔진용 파일 (vite.config.ts의 seoPlugin).
// - seo/posts.json: 저장소의 Markdown 글을 HTML로 그려 둔 목록. Worker가 글 주소의 첫 화면에 넣는다 (worker/seo.ts)
// - sitemap.xml: 첫 화면, 모든 글, 모든 프로젝트 주소
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkCjkFriendly from 'remark-cjk-friendly';
import remarkGfm from 'remark-gfm';
// vite.config.ts가 읽는 파일이라 패키지 이름(빌드한 dist) 대신 desktop-core의 src를 바로 가져온다
import { createStaticPostRepository, tagsOf } from '../../../packages/desktop-core/src/memo';
import type { SeoPost } from './site';

/** 본문을 HTML로. 화면(MemoMarkdown)과 같은 Markdown 규칙이고, 그림은 뺀다 (빌드한 그림 주소는 화면만 안다) */
export function markdownHtml(markdown: string): string {
	return renderToStaticMarkup(
		createElement(
			ReactMarkdown,
			{
				// 화면의 GFM_OPTIONS와 같다: ~ 하나는 취소선이 아니다
				remarkPlugins: [[remarkGfm, { singleTilde: false }], remarkCjkFriendly],
				remarkRehypeOptions: { footnoteLabel: '각주' },
				components: { img: () => null },
			},
			markdown
		)
	);
}

/** 파일 경로 → 내용에서 글 목록 (최신 글이 먼저). 머리말이 잘못된 파일은 화면처럼 뺀다 */
export async function seoPosts(files: Record<string, string>): Promise<SeoPost[]> {
	const posts = await createStaticPostRepository(files).list();
	return [...posts]
		.sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug))
		.map((post) => ({
			slug: post.slug,
			title: post.title,
			date: post.date,
			summary: post.summary,
			category: post.category,
			tags: tagsOf(post.body),
			html: markdownHtml(post.body),
		}));
}

export { sitemapXml } from './site';
