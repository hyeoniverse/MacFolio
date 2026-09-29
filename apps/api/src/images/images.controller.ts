import { Controller, Get, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
	ApiBadGatewayResponse,
	ApiCookieAuth,
	ApiNoContentResponse,
	ApiOkResponse,
	ApiQuery,
	ApiServiceUnavailableResponse,
	ApiTags,
	ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AdminGuard } from '../auth/admin.guard.js';
import { SESSION_COOKIE } from '../auth/session.js';
import { ImagesService } from './images.service.js';

/**
 * 글에 넣을 사진 찾기 (Unsplash, Pexels). API 키는 서버에만 두고, 관리자만 쓴다.
 */
@ApiTags('images')
@ApiCookieAuth(SESSION_COOKIE)
@ApiUnauthorizedResponse({ description: '관리자로 로그인하지 않았다' })
@UseGuards(AdminGuard)
@Controller('images')
export class ImagesController {
	constructor(private readonly images: ImagesService) {}

	@Get('providers')
	@ApiOkResponse({
		description: '서비스마다 키가 있어서 쓸 수 있는지',
		schema: { example: { unsplash: true, pexels: false } },
	})
	providers() {
		return this.images.providers();
	}

	@Get('search')
	@ApiQuery({ name: 'provider', enum: ['unsplash', 'pexels'] })
	@ApiQuery({ name: 'q', description: '검색어 (1~100자)' })
	@ApiQuery({ name: 'page', required: false, description: '1~50' })
	@ApiOkResponse({ description: '사진 (한 쪽 18장)과 다음 쪽이 있는지' })
	@ApiServiceUnavailableResponse({ description: '그 서비스의 키가 없다' })
	@ApiBadGatewayResponse({ description: '사진 서비스가 응답하지 않았다' })
	search(@Query() query: Record<string, unknown>) {
		return this.images.search(query);
	}

	@Post('unsplash/:id/download')
	@HttpCode(204)
	@ApiNoContentResponse({ description: 'Unsplash에 사진을 썼다고 알렸다 (가이드라인)' })
	async trackUnsplashDownload(@Param('id') id: string) {
		await this.images.trackUnsplashDownload(id);
	}
}
