import { Inject, Injectable } from '@nestjs/common';
import { loadOgAssets, ogImagePng, type OgAssets } from '@macfolio/og-card';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { SiteService } from '../site/site.service.js';
import { PostsService } from './posts.service.js';

/** 들고 있을 카드 수. 넘으면 오래된 것부터 버린다 (한 장 100KB 안팎) */
const MAX_CARDS = 100;

/**
 * 서버에 쓴 글의 공유 카드 (packages/og-card). 저장소 글의 카드는 프론트엔드 빌드가 그린다.
 * 한 장 굽는 데 수백 ms가 들어 글마다 그린 것을 들고 있다가, 제목·날짜·분류·사이트 이름이 바뀌었을 때만 다시 그린다.
 * 주소의 ?v=는 보지 않으므로 아무 값이나 붙여 불러도 다시 그리지 않는다
 */
@Injectable()
export class PostCardService {
	private assets: Promise<OgAssets> | null = null;
	private readonly cards = new Map<string, { key: string; png: Promise<Buffer> }>();

	constructor(
		private readonly posts: PostsService,
		private readonly site: SiteService,
		@Inject(APP_CONFIG) private readonly config: AppConfig
	) {}

	async png(slug: string): Promise<Buffer> {
		const post = await this.posts.findPublic(slug);
		const site = `${await this.site.ownerName()}의 Mac`;
		const key = JSON.stringify([post.title, post.date, post.category, site]);
		const cached = this.cards.get(slug);
		if (cached?.key === key) return cached.png;
		this.assets ??= loadOgAssets(this.config.ogAssetsDir).catch((error: unknown) => {
			this.assets = null;
			throw error;
		});
		const entry = { key, png: this.assets.then((assets) => ogImagePng(post, { site, ...assets })) };
		entry.png.catch(() => {
			if (this.cards.get(slug) === entry) this.cards.delete(slug);
		});
		this.cards.delete(slug);
		this.cards.set(slug, entry);
		if (this.cards.size > MAX_CARDS) this.cards.delete(this.cards.keys().next().value!);
		return entry.png;
	}
}
