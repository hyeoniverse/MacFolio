// 빌드(seo/posts.ts)와 Worker(worker/seo.ts)가 함께 쓰는 값. vite.config.ts가 읽으므로 다른 패키지를 가져오지 않는다

/** 실제 사이트 주소. canonical·og:url·sitemap은 미리보기에서도 이 주소를 가리킨다 */
export const SITE_ORIGIN = 'https://macfolio.hyeoniverse.com';

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
}

const escapeXml = (text: string) =>
	text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** sitemap.xml: 첫 화면, 글(lastmod는 글 날짜), 프로젝트. 빌드가 저장소 글로 한 번 만들고, Worker가 서버에 쓴 글까지 합쳐 다시 만든다 */
export function sitemapXml(posts: Pick<SeoPost, 'slug' | 'date'>[], projectIds: string[]): string {
	const entry = (path: string, lastmod?: string) =>
		`\t<url><loc>${escapeXml(`${SITE_ORIGIN}${path}`)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`;
	const newest = posts.reduce((max, post) => (post.date > max ? post.date : max), '');
	const urls = [
		entry('/', newest || undefined),
		...posts.map((post) => entry(`/memo/${encodeURIComponent(post.slug)}`, post.date)),
		...projectIds.map((id) => entry(`/safari/${encodeURIComponent(id)}`)),
	];
	return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}
