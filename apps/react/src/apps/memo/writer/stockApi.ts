// 사진 찾기 (API가 Unsplash·Pexels에 대신 묻는다. 키는 서버에만 있다)
import { api, apiFetch } from '@/shared/api/client';

export type StockProvider = 'unsplash' | 'pexels';

export interface StockPhoto {
	provider: StockProvider;
	id: string;
	thumb: string;
	url: string;
	width: number;
	height: number;
	alt: string;
	author: string;
	authorUrl: string;
	pageUrl: string;
	color: string | null;
}

export const PROVIDER_LABEL: Record<StockProvider, string> = { unsplash: 'Unsplash', pexels: 'Pexels' };

const PROVIDER_HOME: Record<StockProvider, string> = {
	unsplash: 'https://unsplash.com/?utm_source=macfolio&utm_medium=referral',
	pexels: 'https://www.pexels.com',
};

/** 출처 캡션 (두 서비스 모두 사진가와 서비스를 밝히라고 한다). 캡션의 [글자](주소)는 링크로 보인다 */
export const creditCaption = (photo: StockPhoto) =>
	`사진: [${photo.author.replace(/[[\]]/g, '')}](${photo.authorUrl}), [${PROVIDER_LABEL[photo.provider]}](${PROVIDER_HOME[photo.provider]})`;

const get = <T>(apiUrl: string, path: string) => api<T>(path, { apiUrl, fallback: '사진을 찾지 못했습니다.' });

export const fetchProviders = (apiUrl: string) => get<Record<StockProvider, boolean>>(apiUrl, '/images/providers');

export const searchStock = (apiUrl: string, provider: StockProvider, q: string, page: number) =>
	get<{ results: StockPhoto[]; hasMore: boolean }>(
		apiUrl,
		`/images/search?${new URLSearchParams({ provider, q, page: String(page) })}`
	);

/** Unsplash 가이드라인: 사진을 넣으면 알린다 (실패해도 넣기는 그대로) */
export const trackUnsplash = (apiUrl: string, id: string) =>
	apiFetch(`/images/unsplash/${encodeURIComponent(id)}/download`, { method: 'POST', apiUrl }).catch(() => undefined);
