// 빌드(seo/posts.ts)와 Worker(worker/seo.ts)가 함께 쓰는 값. vite.config.ts가 읽으므로 다른 패키지를 가져오지 않는다

/** 실제 사이트 주소. canonical·og:url·sitemap은 미리보기에서도 이 주소를 가리킨다 */
export const SITE_ORIGIN = 'https://macfolio.hyeoniverse.com';

/** 사이트 제목·설명 (첫 화면과 RSS 채널) */
export const siteChannel = (name: string) => ({
	title: `${name}의 Mac`,
	description: `macOS 데스크톱을 웹으로 구현한 ${name}의 포트폴리오`,
});

/** 빌드할 때 Markdown 글을 HTML로 그려 둔 것 (dist/seo/posts.json의 항목) */
export interface SeoPost {
	slug: string;
	title: string;
	/** YYYY-MM-DD */
	date: string;
	summary: string;
	category: string;
	tags: string[];
	/** 본문 HTML (react-markdown으로 그린 것) */
	html: string;
	/** 마지막으로 고친 날 YYYY-MM-DD (빌드한 글은 git 기록). 글 날짜보다 뒤일 때만 있다 */
	updated?: string;
	/** 공유 카드에 쓸 본문의 첫 사진 (전체 주소). 없으면 사이트 기본 그림 */
	image?: string;
}

const escapeXml = (text: string) =>
	text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** 글을 마지막으로 고친 날 (고친 적 없으면 글 날짜) */
export const lastModified = (post: Pick<SeoPost, 'date' | 'updated'>) => post.updated ?? post.date;

/** sitemap.xml: 첫 화면, 글(lastmod는 고친 날), 프로젝트. 빌드가 저장소 글로 한 번 만들고, Worker가 서버에 쓴 글까지 합쳐 다시 만든다 */
export function sitemapXml(posts: Pick<SeoPost, 'slug' | 'date' | 'updated'>[], projectIds: string[]): string {
	const entry = (path: string, lastmod?: string) =>
		`\t<url><loc>${escapeXml(`${SITE_ORIGIN}${path}`)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`;
	const newest = posts.reduce((max, post) => (lastModified(post) > max ? lastModified(post) : max), '');
	const urls = [
		entry('/', newest || undefined),
		...posts.map((post) => entry(`/memo/${encodeURIComponent(post.slug)}`, lastModified(post))),
		...projectIds.map((id) => entry(`/safari/${encodeURIComponent(id)}`)),
	];
	return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

/** 글 날짜(YYYY-MM-DD)를 RSS의 날짜 모양(RFC 822)으로. 한국 시각 0시 */
const rssDate = (date: string) => new Date(`${date}T00:00:00+09:00`).toUTCString();

/**
 * rss.xml: 모든 글의 제목·요약·주소 (최신 글이 먼저). 네이버 서치어드바이저와 피드 구독기가 읽는다.
 * sitemap.xml처럼 빌드가 한 번 만들고, Worker가 서버에 쓴 글까지 합쳐 다시 만든다
 */
export function rssXml(
	posts: Pick<SeoPost, 'slug' | 'title' | 'date' | 'summary' | 'category'>[],
	channel: { title: string; description: string }
): string {
	const items = posts.map((post) => {
		const link = escapeXml(`${SITE_ORIGIN}/memo/${encodeURIComponent(post.slug)}`);
		return (
			`\t<item><title>${escapeXml(post.title)}</title><link>${link}</link><guid isPermaLink="true">${link}</guid>` +
			`<pubDate>${rssDate(post.date)}</pubDate>${post.category ? `<category>${escapeXml(post.category)}</category>` : ''}` +
			`<description>${escapeXml(post.summary)}</description></item>`
		);
	});
	const newest = posts.reduce((max, post) => (post.date > max ? post.date : max), '');
	return (
		`<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n<channel>\n` +
		`\t<title>${escapeXml(channel.title)}</title>\n\t<link>${SITE_ORIGIN}/</link>\n` +
		`\t<description>${escapeXml(channel.description)}</description>\n\t<language>ko</language>\n` +
		`\t<atom:link href="${SITE_ORIGIN}/rss.xml" rel="self" type="application/rss+xml" />\n` +
		(newest ? `\t<lastBuildDate>${rssDate(newest)}</lastBuildDate>\n` : '') +
		`${items.join('\n')}${items.length ? '\n' : ''}</channel>\n</rss>\n`
	);
}
