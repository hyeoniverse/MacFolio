import { BadGatewayException, Injectable } from '@nestjs/common';
import { PER_PAGE } from './stock.js';

/**
 * Unsplash·Pexels API. 테스트에서는 이 클래스를 가짜로 바꿔 바깥에 요청하지 않는다.
 * 돌려주는 값은 각 서비스의 JSON 그대로이고, 모양 맞추기는 stock.ts가 한다.
 */
@Injectable()
export class StockPhotoClient {
	private async getJson(url: string, headers: Record<string, string>) {
		const response = await fetch(url, { headers }).catch(() => {
			throw new BadGatewayException('사진 서비스에 연결할 수 없습니다.');
		});
		if (!response.ok) throw new BadGatewayException(`사진 서비스가 요청을 거절했습니다 (${response.status}).`);
		return response.json() as Promise<unknown>;
	}

	searchUnsplash(accessKey: string, q: string, page: number) {
		const params = new URLSearchParams({
			query: q,
			page: String(page),
			per_page: String(PER_PAGE),
			content_filter: 'high',
		});
		return this.getJson(`https://api.unsplash.com/search/photos?${params}`, {
			Authorization: `Client-ID ${accessKey}`,
			'Accept-Version': 'v1',
		});
	}

	searchPexels(apiKey: string, q: string, page: number) {
		const params = new URLSearchParams({ query: q, page: String(page), per_page: String(PER_PAGE) });
		return this.getJson(`https://api.pexels.com/v1/search?${params}`, { Authorization: apiKey });
	}

	/** Unsplash 가이드라인: 사진을 글에 넣으면 '내려받음'을 알린다 */
	async trackUnsplashDownload(accessKey: string, id: string) {
		await this.getJson(`https://api.unsplash.com/photos/${encodeURIComponent(id)}/download`, {
			Authorization: `Client-ID ${accessKey}`,
			'Accept-Version': 'v1',
		});
	}
}
