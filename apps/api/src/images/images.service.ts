import { BadRequestException, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { StockPhotoClient } from './stock.client.js';
import { fromPexels, fromUnsplash, parseSearch, type StockProvider } from './stock.js';

const KEY_NAMES: Record<StockProvider, string> = { unsplash: 'UNSPLASH_ACCESS_KEY', pexels: 'PEXELS_API_KEY' };

@Injectable()
export class ImagesService {
	constructor(
		@Inject(APP_CONFIG) private readonly config: AppConfig,
		private readonly client: StockPhotoClient
	) {}

	private key(provider: StockProvider) {
		const key =
			provider === 'unsplash' ? this.config.stockPhotos.unsplashAccessKey : this.config.stockPhotos.pexelsApiKey;
		if (!key) throw new ServiceUnavailableException(`${KEY_NAMES[provider]}가 설정되지 않았습니다.`);
		return key;
	}

	/** 쓸 수 있는 서비스 (키가 있는지) */
	providers() {
		return {
			unsplash: Boolean(this.config.stockPhotos.unsplashAccessKey),
			pexels: Boolean(this.config.stockPhotos.pexelsApiKey),
		};
	}

	async search(query: Record<string, unknown>) {
		const parsed = parseSearch(query);
		if ('errors' in parsed) throw new BadRequestException(parsed.errors);
		const { provider, q, page } = parsed.value;
		const key = this.key(provider);
		if (provider === 'unsplash') return fromUnsplash((await this.client.searchUnsplash(key, q, page)) as never, page);
		return fromPexels((await this.client.searchPexels(key, q, page)) as never);
	}

	async trackUnsplashDownload(id: string) {
		if (!/^[\w-]{1,64}$/.test(id)) throw new BadRequestException('사진 ID가 올바르지 않습니다.');
		await this.client.trackUnsplashDownload(this.key('unsplash'), id);
	}
}
