// 관리자가 서버에 쓴 글(API의 GET /posts). 저장소 글과 같은 주소면 그 글을 대신하고(고친 글), deleted면 가린다(지운 글·예약 글).
// 화면(apps/memo)과 같은 규칙으로 합쳐서, 검색엔진용 첫 화면과 sitemap.xml에도 서버에 쓴 글이 들어간다
import { escapeHtml } from './seo';
import { ogCardVersion, type SeoPost } from '../seo/site';

/** API에 묻는 한도. 넘으면 저장소 글만 쓴다 */
const FETCH_TIMEOUT_MS = 1500;
/** 같은 Worker 인스턴스는 이만큼 받은 값을 다시 쓴다 (siteHtml.ts의 CACHE_MS와 같다) */
export const SERVER_POSTS_CACHE_MS = 60_000;
/** API에 닿지 않았으면 이만큼 뒤에 다시 묻는다 */
const FAILURE_CACHE_MS = 10_000;

/** GET /posts의 항목 (apps/api/src/posts의 PublicPost) */
export interface ServerPost {
	slug: string;
	title: string;
	date: string;
	category: string;
	summary: string;
	body: string;
	deleted: boolean;
}

const isServerPost = (value: unknown): value is ServerPost => {
	if (typeof value !== 'object' || value === null) return false;
	const item = value as Record<string, unknown>;
	return (
		typeof item.slug === 'string' &&
		typeof item.deleted === 'boolean' &&
		(item.deleted ||
			(typeof item.title === 'string' &&
				typeof item.date === 'string' &&
				typeof item.body === 'string' &&
				typeof item.summary === 'string'))
	);
};

/** 본문의 마지막 줄 해시태그 (#MacFolio #SEO) */
const tagsOfBody = (body: string) => {
	const last = body.trimEnd().split('\n').at(-1) ?? '';
	return /^(#[^\s#]+\s*)+$/.test(last.trim()) ? [...last.matchAll(/#([^\s#]+)/g)].map((match) => match[1]) : [];
};

/**
 * 서버 글의 Markdown을 크롤러용 HTML로. Worker에서는 Markdown 변환기를 돌리지 않고(번들이 커진다)
 * 제목 줄은 h2, 나머지는 빈 줄로 나눈 문단으로만 바꾼다. 글자는 모두 이스케이프한다
 */
export function plainHtml(markdown: string): string {
	return markdown
		.split(/\n{2,}/)
		.map((block) => block.trim())
		.filter((block) => block && !/^(#[^\s#]+\s*)+$/.test(block) && !/^!\[/.test(block))
		.map((block) => {
			const heading = /^#{1,6}\s+(.+)$/.exec(block);
			return heading ? `<h2>${escapeHtml(heading[1])}</h2>` : `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`;
		})
		.join('');
}

const PHOTO = /\.(png|jpe?g|webp|gif)$/i;

/**
 * 본문의 첫 사진: 관리자가 올린 파일(API의 /files/<id>. 올릴 때 내용으로 종류를 가려 사진만 그림으로 받는다)이나
 * 확장자가 사진인 https 주소. SVG는 카카오톡·X 등이 공유 카드로 그리지 않아 건너뛴다
 */
export function firstPhoto(markdown: string, apiUrl: string): string | undefined {
	for (const match of markdown.matchAll(/!\[[^\]]*\]\(\s*([^)\s]+)/g)) {
		const src = match[1];
		if (src.startsWith(`${apiUrl}/files/`)) return src;
		if (src.startsWith('https://') && PHOTO.test(src.split(/[?#]/)[0])) return src;
	}
	return undefined;
}

/**
 * 저장소 글에 서버 글을 합친다: 같은 주소는 서버 것으로, 지운 글은 빼고, 새 글은 더한다. 최신 글이 앞.
 * apiUrl이 있으면 서버 글의 공유 그림을 정한다: 본문의 첫 사진, 없으면 API가 제목으로 그린 카드(GET /posts/<글>/og.png).
 * 카드 주소의 v는 API가 읽지 않고, 제목이 바뀌면 주소가 바뀌어 메신저·SNS가 새로 받게 한다
 */
export function mergeServerPosts(posts: SeoPost[], server: ServerPost[], apiUrl?: string): SeoPost[] {
	const bySlug = new Map(posts.map((post) => [post.slug, post]));
	for (const item of server) {
		if (item.deleted) {
			bySlug.delete(item.slug);
			continue;
		}
		const post: SeoPost = {
			slug: item.slug,
			title: item.title,
			date: item.date,
			summary: item.summary,
			category: item.category ?? '',
			tags: tagsOfBody(item.body),
			html: plainHtml(item.body),
		};
		if (apiUrl) {
			post.image =
				firstPhoto(item.body, apiUrl) ??
				`${apiUrl}/posts/${encodeURIComponent(item.slug)}/og.png?v=${ogCardVersion(post)}`;
		}
		bySlug.set(item.slug, post);
	}
	return [...bySlug.values()].sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
}

let cached: { at: number; ttl: number; value: Promise<ServerPost[] | null> } | null = null;

/** API의 GET /posts. 닿지 않으면 null (저장소 글만 쓰고, 없는 글 주소도 404로 단정하지 않는다) */
export function fetchServerPosts(
	apiUrl: string,
	fetchImpl: typeof fetch = fetch,
	now = Date.now()
): Promise<ServerPost[] | null> {
	if (cached && now - cached.at < cached.ttl) return cached.value;
	const entry = { at: now, ttl: SERVER_POSTS_CACHE_MS, value: Promise.resolve<ServerPost[] | null>(null) };
	entry.value = fetchImpl(`${apiUrl}/posts`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
		.then(async (response) => {
			if (!response.ok) throw new Error(String(response.status));
			const rows: unknown = await response.json();
			return Array.isArray(rows) ? rows.filter(isServerPost) : [];
		})
		.catch(() => {
			entry.ttl = FAILURE_CACHE_MS;
			return null;
		});
	cached = entry;
	return entry.value;
}

/** 시험에서 캐시를 비운다 */
export const clearServerPostsCache = () => {
	cached = null;
};
