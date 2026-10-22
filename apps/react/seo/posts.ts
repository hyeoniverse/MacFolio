// 빌드할 때 만드는 검색엔진용 파일 (vite.config.ts의 seoPlugin).
// - seo/posts.json: 저장소의 Markdown 글을 HTML로 그려 둔 목록. Worker가 글 주소의 첫 화면에 넣는다 (worker/seo.ts)
// - sitemap.xml: 첫 화면, 모든 글, 모든 프로젝트 주소
// - rss.xml: 모든 글의 제목·요약
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkCjkFriendly from 'remark-cjk-friendly';
import remarkGfm from 'remark-gfm';
// vite.config.ts가 읽는 파일이라 패키지 이름(빌드한 dist) 대신 desktop-core의 src를 바로 가져온다
import { createStaticPostRepository, resolveImageSrc, tagsOf } from '../../../packages/desktop-core/src/memo';
import { SITE_ORIGIN, type SeoPost } from './site';

/** content 폴더 기준 그림 경로(images/a.png) → 빌드한 주소(/assets/a-해시.png). 화면의 contentImages.ts와 같은 모양 */
export type ContentImages = Record<string, string>;

/** 본문을 HTML로. 화면(MemoMarkdown)과 같은 Markdown 규칙이고, 그림은 빌드한 주소로 바꾼다 (찾지 못한 그림은 뺀다) */
export function markdownHtml(markdown: string, images: ContentImages = {}): string {
	return renderToStaticMarkup(
		createElement(
			ReactMarkdown,
			{
				// 화면의 GFM_OPTIONS와 같다: ~ 하나는 취소선이 아니다
				remarkPlugins: [[remarkGfm, { singleTilde: false }], remarkCjkFriendly],
				remarkRehypeOptions: { footnoteLabel: '각주' },
				components: {
					img: ({ src, alt, title }) => {
						const resolved = resolveImageSrc(typeof src === 'string' ? src : undefined, images);
						return resolved && createElement('img', { src: resolved, alt: alt ?? '', title, loading: 'lazy' });
					},
				},
			},
			markdown
		)
	);
}

/** 공유 카드에 쓸 수 있는 그림 (SVG는 카카오톡·X 등이 그리지 않는다) */
const CARD_IMAGE = /\.(png|jpe?g|webp|gif)$/i;

/** 본문의 첫 사진(전체 주소). 공유 카드와 구조화 데이터의 image가 된다 */
export function cardImage(markdown: string, images: ContentImages): string | undefined {
	for (const match of markdown.matchAll(/!\[[^\]]*\]\(\s*([^)\s]+)/g)) {
		const resolved = resolveImageSrc(match[1], images);
		if (!resolved || !CARD_IMAGE.test(resolved.split(/[?#]/)[0])) continue;
		if (resolved.startsWith('https://')) return resolved;
		if (resolved.startsWith('/')) return `${SITE_ORIGIN}${resolved}`;
	}
	return undefined;
}

/**
 * `git log --format=%x00%cd --date=format-local:%Y-%m-%d --name-only --relative`의 출력 → 글 slug → 마지막으로 고친 날.
 * 기록은 최신 커밋이 먼저라 파일마다 처음 나온 날이 마지막으로 고친 날이다
 */
export function updatedDates(log: string): Record<string, string> {
	const dates: Record<string, string> = {};
	for (const commit of log.split('\0')) {
		const [date, ...names] = commit.trim().split('\n');
		if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) continue;
		for (const name of names) {
			const slug = /^([^/]+)\.md$/.exec(name.trim())?.[1];
			if (slug && !(slug in dates)) dates[slug] = date;
		}
	}
	return dates;
}

/**
 * `git log --diff-filter=A --format=%x00%cI --name-only --relative`의 출력 → 글 slug → 올린 때 (처음 더한 커밋, ISO UTC).
 * 같은 날 글의 순서를 정한다 (머리말의 날짜에는 시각이 없다). 기록은 최신 커밋이 먼저라, 지웠다 다시 더한 글은 가장 처음 더한 때
 */
export function createdTimes(log: string): Record<string, string> {
	const times: Record<string, string> = {};
	for (const commit of log.split('\0')) {
		const [time, ...names] = commit.trim().split('\n');
		const at = Date.parse(time ?? '');
		if (!Number.isFinite(at)) continue;
		for (const name of names) {
			const slug = /^([^/]+)\.md$/.exec(name.trim())?.[1];
			if (slug) times[slug] = new Date(at).toISOString();
		}
	}
	return times;
}

/** 빌드가 넘기는 것: 빌드한 그림 주소, 글 slug → 마지막으로 고친 날, 글 slug → 올린 때 */
export interface SeoPostOptions {
	images?: ContentImages;
	updated?: Record<string, string>;
	created?: Record<string, string>;
}

/** 파일 경로 → 내용에서 글 목록 (최신 글이 먼저). 머리말이 잘못된 파일은 화면처럼 뺀다 */
export async function seoPosts(
	files: Record<string, string>,
	{ images = {}, updated = {}, created = {} }: SeoPostOptions = {}
): Promise<SeoPost[]> {
	// 사이트의 메모 목록과 같은 순서: 최신 글이 먼저, 같은 날이면 나중에 올린 글이 먼저 (sortPosts)
	const posts = await createStaticPostRepository(files, undefined, created).list();
	return posts.map((post) => {
		const changed = updated[post.slug];
		const image = cardImage(post.body, images);
		return {
			slug: post.slug,
			title: post.title,
			date: post.date,
			summary: post.summary,
			category: post.category,
			tags: tagsOf(post.body),
			html: markdownHtml(post.body, images),
			...(changed && changed > post.date && { updated: changed }),
			...(image && { image }),
		};
	});
}

/** 위젯에 보일 최근 글 (빌드할 때 'virtual:recent-posts'로 넣는다). 본문 없이 제목·날짜·분류만 */
export interface RecentPost {
	slug: string;
	title: string;
	date: string;
	category: string;
}

/** 최신 글 limit편 (날짜가 같으면 나중에 올린 글이 먼저, 메모 목록과 같다). 미래 날짜(예약 글)는 뺀다 */
export async function recentPosts(
	files: Record<string, string>,
	limit: number,
	today: string,
	created: Record<string, string> = {}
): Promise<RecentPost[]> {
	const posts = await createStaticPostRepository(files, undefined, created).list();
	return posts
		.filter((post) => post.date <= today)
		.slice(0, limit)
		.map(({ slug, title, date, category }) => ({ slug, title, date, category }));
}

export { rssXml, siteChannel, sitemapXml } from './site';
