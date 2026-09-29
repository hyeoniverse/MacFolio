// 사진 찾기(Unsplash, Pexels) 결과를 한 모양으로 맞춘다. 두 서비스 모두 사진가와 출처를 밝히고,
// Unsplash는 사진 주소를 그대로 써야 하고(핫링크) 링크에 utm 값을 붙여야 한다 (API 가이드라인).

export type StockProvider = 'unsplash' | 'pexels';
export const STOCK_PROVIDERS: StockProvider[] = ['unsplash', 'pexels'];

export interface StockPhoto {
	provider: StockProvider;
	id: string;
	/** 목록에 보일 작은 그림 */
	thumb: string;
	/** 글에 넣을 그림 (본문 폭에 충분한 크기) */
	url: string;
	width: number;
	height: number;
	/** 서비스가 준 설명 (대체 텍스트의 기본값) */
	alt: string;
	author: string;
	authorUrl: string;
	/** 사진 페이지 */
	pageUrl: string;
	/** 불러오기 전에 칠해 둘 색 */
	color: string | null;
}

export const PER_PAGE = 18;

const UTM = 'utm_source=macfolio&utm_medium=referral';
const withUtm = (url: string) => `${url}${url.includes('?') ? '&' : '?'}${UTM}`;

interface UnsplashPhoto {
	id: string;
	width: number;
	height: number;
	color?: string | null;
	description?: string | null;
	alt_description?: string | null;
	urls: { regular: string; small: string };
	links: { html: string };
	user: { name: string; links: { html: string } };
}

export function fromUnsplash(body: { results?: UnsplashPhoto[]; total_pages?: number }, page: number) {
	const results: StockPhoto[] = (body.results ?? []).map((photo) => ({
		provider: 'unsplash',
		id: photo.id,
		thumb: photo.urls.small,
		url: photo.urls.regular,
		width: photo.width,
		height: photo.height,
		alt: photo.alt_description ?? photo.description ?? '',
		author: photo.user.name,
		authorUrl: withUtm(photo.user.links.html),
		pageUrl: withUtm(photo.links.html),
		color: photo.color ?? null,
	}));
	return { results, hasMore: page < (body.total_pages ?? 0) };
}

interface PexelsPhoto {
	id: number;
	width: number;
	height: number;
	url: string;
	alt?: string | null;
	avg_color?: string | null;
	photographer: string;
	photographer_url: string;
	src: { large2x: string; medium: string };
}

export function fromPexels(body: { photos?: PexelsPhoto[]; next_page?: string }) {
	const results: StockPhoto[] = (body.photos ?? []).map((photo) => ({
		provider: 'pexels',
		id: String(photo.id),
		thumb: photo.src.medium,
		url: photo.src.large2x,
		width: photo.width,
		height: photo.height,
		alt: photo.alt ?? '',
		author: photo.photographer,
		authorUrl: photo.photographer_url,
		pageUrl: photo.url,
		color: photo.avg_color ?? null,
	}));
	return { results, hasMore: Boolean(body.next_page) };
}

/** 검색 요청 검사: 서비스, 검색어 1~100자, 쪽 1~50 */
export function parseSearch(
	query: Record<string, unknown>
): { value: { provider: StockProvider; q: string; page: number } } | { errors: string[] } {
	const errors: string[] = [];
	const provider = query.provider as StockProvider;
	if (!STOCK_PROVIDERS.includes(provider)) errors.push('provider는 unsplash 또는 pexels입니다.');
	const q = typeof query.q === 'string' ? query.q.trim() : '';
	if (q.length < 1 || q.length > 100) errors.push('검색어는 1~100자입니다.');
	const page = query.page === undefined ? 1 : Number(query.page);
	if (!Number.isInteger(page) || page < 1 || page > 50) errors.push('page는 1~50입니다.');
	return errors.length ? { errors } : { value: { provider, q, page } };
}
