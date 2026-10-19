import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	Param,
	Patch,
	Post,
	UploadedFiles,
	UseGuards,
	UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import {
	ApiBadRequestResponse,
	ApiBody,
	ApiConsumes,
	ApiCookieAuth,
	ApiCreatedResponse,
	ApiNoContentResponse,
	ApiNotFoundResponse,
	ApiOkResponse,
	ApiPayloadTooLargeResponse,
	ApiTags,
	ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AdminGuard, CurrentAdmin } from '../auth/admin.guard.js';
import type { AdminIdentity } from '../auth/auth.service.js';
import { SESSION_COOKIE } from '../auth/session.js';
import type { IncomingFile } from '../files/files.service.js';
import { MAX_WALLPAPER_VIDEO_BYTES } from '../files/rules.js';
import { WallpapersService } from './wallpapers.service.js';
import { RateLimit } from '../common/rate-limit.js';

/**
 * 관리자가 더한 배경화면 (시스템 설정 → 배경화면). 데스크톱·휴대폰 어디서나 고른다.
 * 누구나 목록을 보고, 관리자만 올리고 이름을 바꾸고 지운다.
 * 사진은 브라우저에서 줄여서(원본·썸네일) 보낸다. GIF·MP4는 원본 그대로, 썸네일(포스터)은 브라우저가 첫 장면으로 만든다.
 */
@ApiTags('wallpapers')
@Controller('wallpapers')
export class WallpapersController {
	constructor(private readonly wallpapers: WallpapersService) {}

	@Get()
	@ApiOkResponse({ description: '더한 배경화면 (올린 순서). 이미지 주소는 /files/:id' })
	list() {
		return this.wallpapers.list();
	}

	@Post()
	@UseGuards(AdminGuard)
	@RateLimit('upload')
	@UseInterceptors(
		FileFieldsInterceptor(
			[
				{ name: 'image', maxCount: 1 },
				{ name: 'thumbnail', maxCount: 1 },
			],
			// 한도는 큰 쪽(동영상 30MB)에 맞추고, 이미지 10MB는 서비스에서 다시 본다
			{ limits: { fileSize: MAX_WALLPAPER_VIDEO_BYTES, files: 2 } }
		)
	)
	@ApiCookieAuth(SESSION_COOKIE)
	@ApiConsumes('multipart/form-data')
	@ApiBody({
		schema: {
			type: 'object',
			required: ['image', 'thumbnail'],
			properties: {
				name: { type: 'string', maxLength: 40, description: '비우면 파일 이름' },
				image: { type: 'string', format: 'binary' },
				thumbnail: { type: 'string', format: 'binary' },
			},
		},
	})
	@ApiCreatedResponse({ description: '더한 배경화면' })
	@ApiBadRequestResponse({ description: '파일이 없거나 이미지·MP4가 아니다' })
	@ApiPayloadTooLargeResponse({ description: '이미지가 10MB, 동영상이 30MB를 넘는다' })
	@ApiUnauthorizedResponse({ description: '관리자로 로그인하지 않았다' })
	create(
		@UploadedFiles() files: { image?: IncomingFile[]; thumbnail?: IncomingFile[] } | undefined,
		@Body() body: { name?: unknown },
		@CurrentAdmin() admin: AdminIdentity
	) {
		return this.wallpapers.create(
			{ name: body?.name, image: files?.image?.[0], thumbnail: files?.thumbnail?.[0] },
			admin.login
		);
	}

	@Patch(':id')
	@UseGuards(AdminGuard)
	@RateLimit('write')
	@ApiCookieAuth(SESSION_COOKIE)
	@ApiBody({ schema: { type: 'object', required: ['name'], properties: { name: { type: 'string', maxLength: 40 } } } })
	@ApiOkResponse({ description: '이름을 바꾼 배경화면' })
	@ApiBadRequestResponse({ description: '이름이 비었다' })
	@ApiNotFoundResponse({ description: '배경화면이 없다' })
	@ApiUnauthorizedResponse({ description: '관리자로 로그인하지 않았다' })
	rename(@Param('id') id: string, @Body() body: unknown) {
		return this.wallpapers.rename(id, body);
	}

	@Delete(':id')
	@HttpCode(204)
	@UseGuards(AdminGuard)
	@RateLimit('write')
	@ApiCookieAuth(SESSION_COOKIE)
	@ApiNoContentResponse({ description: '지웠다 (이미지 두 장도 함께)' })
	@ApiNotFoundResponse({ description: '배경화면이 없다' })
	@ApiUnauthorizedResponse({ description: '관리자로 로그인하지 않았다' })
	async remove(@Param('id') id: string) {
		await this.wallpapers.remove(id);
	}
}
