import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import {
	ApiBadRequestResponse,
	ApiBody,
	ApiCookieAuth,
	ApiOkResponse,
	ApiTags,
	ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AdminGuard, CurrentAdmin } from '../auth/admin.guard.js';
import type { AdminIdentity } from '../auth/auth.service.js';
import { SESSION_COOKIE } from '../auth/session.js';
import { PhotosService } from './photos.service.js';
import { CAPTION_MAX } from './rules.js';
import { RateLimit } from '../common/rate-limit.js';

/**
 * 사진 앱의 캡션 (#21). 사진은 프로젝트 정보에서 꺼내고, 관리자가 고친 캡션만 여기 둔다.
 * 누구나 읽고, 관리자만 고친다 (사진 정보의 캡션 칸)
 */
@ApiTags('photos')
@Controller('photos')
export class PhotosController {
	constructor(private readonly photos: PhotosService) {}

	@Get('captions')
	@ApiOkResponse({
		description: '관리자가 고친 캡션 { 사진 주소: 캡션 }. 없는 사진은 원래 캡션을 쓴다',
		schema: { example: { '/imgs/projects/qru/screenshot.jpg': 'QR 명함 첫 화면' } },
	})
	captions() {
		return this.photos.captions();
	}

	@Put('captions')
	@UseGuards(AdminGuard)
	@RateLimit('write')
	@ApiCookieAuth(SESSION_COOKIE)
	@ApiBody({ schema: { example: { src: '/imgs/projects/qru/screenshot.jpg', caption: 'QR 명함 첫 화면' } } })
	@ApiOkResponse({ description: '고친 뒤의 캡션 전체. 캡션을 비우면 원래 캡션으로 돌아간다' })
	@ApiBadRequestResponse({ description: `사진 주소가 잘못되었거나 캡션이 ${CAPTION_MAX}자를 넘는다` })
	@ApiUnauthorizedResponse({ description: '관리자로 로그인하지 않았다' })
	save(@Body() body: unknown, @CurrentAdmin() admin: AdminIdentity) {
		return this.photos.save(body, admin.login);
	}
}
