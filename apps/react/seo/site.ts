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
