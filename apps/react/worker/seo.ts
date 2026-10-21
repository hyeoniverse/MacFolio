// 검색엔진이 읽을 첫 화면. 사이트는 자바스크립트로만 그려서, 스크립트를 돌리지 않는 크롤러에게는 빈 <div id="root">만 보인다.
// 그래서 주소마다(/, /memo/<글>, /safari/<프로젝트>) index.html에
// 1) <head>의 제목·설명·canonical·Open Graph·구조화 데이터(JSON-LD)를 맞추고
// 2) <div id="root"> 안에 화면과 같은 내용(글 본문, 프로젝트 소개, 모든 글·프로젝트 링크)을 넣는다.
// 넣은 내용은 화면에 보이지 않게 숨기고(index.html의 .seo-content), 앱이 그리기 시작하면 React가 root 안을 통째로 바꾼다
import { readProfile } from '@macfolio/contracts';
import { mergeProjects, readProjects, type Project } from '@macfolio/desktop-core/site';
import { lastModified, SITE_ORIGIN, siteChannel, type SeoPost } from '../seo/site';
import { DEFAULT_PROJECTS, PROFILE } from '../src/shared/profile';

export { SITE_ORIGIN, type SeoPost };

/** 빌드가 만드는 글 목록 (vite.config.ts의 seoPlugin, seo/posts.ts) */
export const SEO_POSTS_PATH = '/seo/posts.json';
/** 공유 카드의 기본 그림 (public/og-image.jpg, 1200×630) */
export const OG_IMAGE = `${SITE_ORIGIN}/og-image.jpg`;
/** index.html의 숨김 스타일과 같은 이름 */
export const SEO_CONTENT_CLASS = 'seo-content';

/** 한 주소의 <head>와 크롤러용 본문 */
export interface SeoPage {
	title: string;
	description: string;
	/** 없으면 canonical을 넣지 않는다 (색인하지 않을 주소) */
	canonical: string | null;
	type: 'website' | 'article';
	image: string;
	publishedTime?: string;
	modifiedTime?: string;
	jsonLd: Record<string, unknown> | null;
	/** <div id="root"> 안에 넣을 HTML (이미 이스케이프한 것) */
	body: string;
	noindex: boolean;
	/** 글·프로젝트 주소인데 그런 글·프로젝트가 없다 (글 목록을 모두 받았으면 Worker가 404로 답한다) */
	notFound?: boolean;
}

interface SiteData {
	posts: SeoPost[];
	projects: Project[];
	profile: { name: string; nameEn: string; role: string; github: string };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

/** HTML 글자와 속성 값 */
export const escapeHtml = (text: string) =>
	text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');

/** <script> 안의 JSON. "</script>"로 빠져나가지 못하게 <를 <로 (siteHtml.ts의 injectSiteContent와 같다) */
const jsonForScript = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');

const postPath = (slug: string) => `/memo/${encodeURIComponent(slug)}`;
const projectPath = (id: string) => `/safari/${encodeURIComponent(id)}`;

/** 관리자가 고친 사이트 콘텐츠(GET /site)를 코드의 기본값에 합친다. 화면(shared/site/siteContent.ts)과 같은 규칙 */
export function siteDataOf(content: unknown, posts: SeoPost[], apiUrl?: string): SiteData {
	const record = isRecord(content) ? content : {};
	const saved = readProjects(record.projects, { allowOrigins: apiUrl ? [apiUrl] : [] });
	return {
		posts,
		projects: mergeProjects(DEFAULT_PROJECTS, saved),
		profile: readProfile(record.profile) ?? PROFILE,
	};
}

/** 그림 주소를 전체 주소로. 쓸 수 없으면 기본 그림 */
const imageUrl = (src: string | undefined) => {
	if (src?.startsWith('https://')) return src;
	if (src?.startsWith('/')) return `${SITE_ORIGIN}${src}`;
	return OG_IMAGE;
};

const siteTitle = (data: SiteData) => siteChannel(data.profile.name).title;
const siteDescription = (data: SiteData) => siteChannel(data.profile.name).description;

const personLd = (data: SiteData) => ({
	'@type': 'Person',
	name: data.profile.name,
	alternateName: data.profile.nameEn,
	jobTitle: data.profile.role,
	url: SITE_ORIGIN,
	...(data.profile.github && { sameAs: [data.profile.github] }),
});

/** 첫 화면: 소개와 모든 글·프로젝트 링크 (크롤러가 따라간다) */
function homePage(data: SiteData, canonical: string | null): SeoPage {
	const title = siteTitle(data);
	const description = siteDescription(data);
	const postItems = data.posts
		.map(
			(post) =>
				`<li><a href="${escapeHtml(postPath(post.slug))}">${escapeHtml(post.title)}</a> <time datetime="${escapeHtml(post.date)}">${escapeHtml(post.date)}</time></li>`
		)
		.join('');
	const projectItems = data.projects
		.map(
			(project) =>
				`<li><a href="${escapeHtml(projectPath(project.id))}">${escapeHtml(project.name)}</a>${project.description ? `: ${escapeHtml(project.description)}` : ''}</li>`
		)
		.join('');
	const body =
		`<header><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p>` +
		`<p>${escapeHtml(data.profile.name)} (${escapeHtml(data.profile.nameEn)}) · ${escapeHtml(data.profile.role)}</p></header>` +
		`<nav aria-label="프로젝트"><h2>프로젝트</h2><ul>${projectItems}</ul></nav>` +
		`<nav aria-label="글"><h2>글</h2><ul>${postItems}</ul></nav>`;
	return {
		title,
		description,
		canonical,
		type: 'website',
		image: OG_IMAGE,
		jsonLd: {
			'@context': 'https://schema.org',
			'@graph': [
				{ ...personLd(data), '@id': `${SITE_ORIGIN}/#person` },
				{
					'@type': 'WebSite',
					name: title,
					url: SITE_ORIGIN,
					inLanguage: 'ko',
					author: { '@id': `${SITE_ORIGIN}/#person` },
				},
			],
		},
		body,
		noindex: false,
	};
}

function postPage(data: SiteData, post: SeoPost): SeoPage {
	const url = `${SITE_ORIGIN}${postPath(post.slug)}`;
	const tags = post.tags.length ? `<ul>${post.tags.map((tag) => `<li>#${escapeHtml(tag)}</li>`).join('')}</ul>` : '';
	const image = post.image ?? OG_IMAGE;
	return {
		title: `${post.title} — ${siteTitle(data)}`,
		description: post.summary,
		canonical: url,
		type: 'article',
		image,
		publishedTime: post.date,
		modifiedTime: post.updated,
		jsonLd: {
			'@context': 'https://schema.org',
			'@type': 'BlogPosting',
			headline: post.title,
			description: post.summary,
			datePublished: post.date,
			dateModified: lastModified(post),
			inLanguage: 'ko',
			url,
			mainEntityOfPage: url,
			image,
			articleSection: post.category,
			...(post.tags.length && { keywords: post.tags.join(', ') }),
			author: personLd(data),
		},
		body:
			`<article><h1>${escapeHtml(post.title)}</h1>` +
			`<p><time datetime="${escapeHtml(post.date)}">${escapeHtml(post.date)}</time> · ${escapeHtml(post.category)}</p>` +
			`${post.html}${tags}</article>` +
			`<p><a href="/">${escapeHtml(siteTitle(data))}</a></p>`,
		noindex: false,
	};
}

function projectPage(data: SiteData, project: Project): SeoPage {
	const url = `${SITE_ORIGIN}${projectPath(project.id)}`;
	const description = project.description || project.tagline || project.name;
	const links = [
		project.url && `<li><a href="${escapeHtml(project.url)}">GitHub 저장소</a></li>`,
		project.demo && `<li><a href="${escapeHtml(project.demo)}">데모</a></li>`,
	]
		.filter(Boolean)
		.join('');
	const image = imageUrl(project.image);
	return {
		title: `${project.name} — ${siteTitle(data)}`,
		description,
		canonical: url,
		type: 'website',
		image,
		jsonLd: {
			'@context': 'https://schema.org',
			'@type': 'CreativeWork',
			name: project.name,
			headline: project.tagline || project.name,
			description,
			url,
			image,
			inLanguage: 'ko',
			...(project.stack.length && { keywords: project.stack.join(', ') }),
			...(project.url && { codeRepository: project.url, sameAs: [project.url] }),
			author: personLd(data),
		},
		body:
			`<article><h1>${escapeHtml(project.name)}</h1>` +
			(project.tagline ? `<p>${escapeHtml(project.tagline)}</p>` : '') +
			`<p>${escapeHtml(description)}</p>` +
			(project.context ? `<p>${escapeHtml(project.context)}</p>` : '') +
			(project.stack.length ? `<p>${project.stack.map(escapeHtml).join(', ')}</p>` : '') +
			(links ? `<ul>${links}</ul>` : '') +
			`</article><p><a href="/">${escapeHtml(siteTitle(data))}</a></p>`,
		noindex: false,
	};
}

/** 주소 한 칸을 푼다. 잘못된 % 표기면 null */
const decodeSegment = (segment: string) => {
	try {
		return decodeURIComponent(segment);
	} catch {
		return null;
	}
};

/**
 * 주소의 페이지. 글·프로젝트 주소인데 그런 글·프로젝트가 없으면 색인하지 않게(noindex) 하고 notFound로 표시한다.
 * 다른 앱 주소(/finder 등)는 첫 화면과 같은 내용이라 canonical을 첫 화면으로
 */
export function seoPage(pathname: string, data: SiteData): SeoPage {
	const match = /^\/(memo|safari)\/([^/]+)\/?$/.exec(pathname);
	if (match) {
		const id = decodeSegment(match[2]);
		const post = match[1] === 'memo' ? data.posts.find((item) => item.slug === id) : undefined;
		if (post) return postPage(data, post);
		const project = match[1] === 'safari' ? data.projects.find((item) => item.id === id) : undefined;
		if (project) return projectPage(data, project);
		return { ...homePage(data, null), noindex: true, notFound: true };
	}
	return homePage(data, `${SITE_ORIGIN}/`);
}

/** <head>에 넣을 태그 (제목·설명은 applySeo가 있던 것을 바꾼다) */
function headTags(page: SeoPage): string {
	const meta = (attr: 'name' | 'property', key: string, value: string) =>
		`<meta ${attr}="${key}" content="${escapeHtml(value)}" />`;
	const tags = [
		page.noindex && meta('name', 'robots', 'noindex'),
		page.canonical && `<link rel="canonical" href="${escapeHtml(page.canonical)}" />`,
		meta('property', 'og:type', page.type),
		meta('property', 'og:site_name', page.title.split(' — ').at(-1)!),
		meta('property', 'og:title', page.title),
		meta('property', 'og:description', page.description),
		page.canonical && meta('property', 'og:url', page.canonical),
		meta('property', 'og:image', page.image),
		meta('property', 'og:locale', 'ko_KR'),
		page.publishedTime && meta('property', 'article:published_time', page.publishedTime),
		page.modifiedTime && meta('property', 'article:modified_time', page.modifiedTime),
		meta('name', 'twitter:card', 'summary_large_image'),
		meta('name', 'twitter:title', page.title),
		meta('name', 'twitter:description', page.description),
		meta('name', 'twitter:image', page.image),
		page.jsonLd && `<script type="application/ld+json">${jsonForScript(page.jsonLd)}</script>`,
	];
	return tags.filter(Boolean).join('');
}

const TITLE = /<title>[\s\S]*?<\/title>/;
const DESCRIPTION = /<meta\s+name="description"[^>]*>/;
const ROOT = '<div id="root"></div>';

/** index.html에 페이지를 넣는다: 제목·설명은 있던 것을 바꾸고(겹치지 않게), 나머지는 </head> 앞에, 본문은 root 안에 */
export function applySeo(html: string, page: SeoPage): string {
	const title = `<title>${escapeHtml(page.title)}</title>`;
	const description = `<meta name="description" content="${escapeHtml(page.description)}" />`;
	let out = TITLE.test(html) ? html.replace(TITLE, () => title) : html.replace('</head>', () => `${title}</head>`);
	out = DESCRIPTION.test(out)
		? out.replace(DESCRIPTION, () => description)
		: out.replace('</head>', () => `${description}</head>`);
	out = out.replace('</head>', () => `${headTags(page)}</head>`);
	return out.replace(ROOT, () => `<div id="root"><div class="${SEO_CONTENT_CLASS}">${page.body}</div></div>`);
}

/** 빌드한 글 목록이 맞는 모양인지 (틀린 항목은 뺀다) */
function readSeoPosts(value: unknown): SeoPost[] {
	if (!Array.isArray(value)) return [];
	return value.filter(
		(item): item is SeoPost =>
			isRecord(item) &&
			typeof item.slug === 'string' &&
			typeof item.title === 'string' &&
			typeof item.date === 'string' &&
			typeof item.summary === 'string' &&
			typeof item.category === 'string' &&
			typeof item.html === 'string' &&
			Array.isArray(item.tags) &&
			(item.updated === undefined || typeof item.updated === 'string') &&
			(item.image === undefined || typeof item.image === 'string')
	);
}

let postsCache: Promise<SeoPost[]> | null = null;

/** 정적 파일의 글 목록. 배포마다 같으니 한 번 받으면 계속 쓰고, 받지 못했으면 다음 요청에 다시 묻는다 */
export function fetchSeoPosts(
	assets: { fetch: (request: Request | URL | string) => Promise<Response> },
	origin: string
): Promise<SeoPost[]> {
	if (postsCache) return postsCache;
	const value = assets
		.fetch(new URL(SEO_POSTS_PATH, origin))
		.then(async (response) => (response.ok ? readSeoPosts(await response.json()) : null))
		.catch(() => null)
		.then((posts) => {
			if (posts === null) postsCache = null;
			return posts ?? [];
		});
	postsCache = value;
	return value;
}

/** 시험에서 캐시를 비운다 */
export const clearSeoPostsCache = () => {
	postsCache = null;
};

/** 미리보기(*.workers.dev) 주소는 검색에 나오지 않게 한다 */
export const isPreviewHost = (hostname: string) => hostname.endsWith('.workers.dev');
