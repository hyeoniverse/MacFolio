import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	Param,
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
import { MAX_UPLOAD_BYTES } from '../files/rules.js';
import { WallpapersService } from './wallpapers.service.js';

/**
 * 관리자가 더한 배경화면 (시스템 설정 → 배경화면). 누구나 목록을 보고, 관리자만 올리고 지운다.
 * 이미지는 브라우저에서 줄여서(원본·썸네일) 보낸다.
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
	@UseInterceptors(
		FileFieldsInterceptor(
			[
				{ name: 'image', maxCount: 1 },
				{ name: 'thumbnail', maxCount: 1 },
			],
			{ limits: { fileSize: MAX_UPLOAD_BYTES, files: 2 } }
		)
	)
	@ApiCookieAuth(SESSION_COOKIE)
	@ApiConsumes('multipart/form-data')
	@ApiBody({
		schema: {
			type: 'object',
			required: ['kind', 'image', 'thumbnail'],
			properties: {
				kind: { type: 'string', enum: ['mac', 'ios'] },
				name: { type: 'string', maxLength: 40, description: '비우면 파일 이름' },
				image: { type: 'string', format: 'binary' },
				thumbnail: { type: 'string', format: 'binary' },
			},
		},
	})
	@ApiCreatedResponse({ description: '더한 배경화면' })
	@ApiBadRequestResponse({ description: '묶음이 틀렸거나 이미지가 없거나 이미지가 아니다' })
	@ApiPayloadTooLargeResponse({ description: '이미지 한 장이 10MB를 넘는다' })
	@ApiUnauthorizedResponse({ description: '관리자로 로그인하지 않았다' })
	create(
		@UploadedFiles() files: { image?: IncomingFile[]; thumbnail?: IncomingFile[] } | undefined,
		@Body() body: { kind?: unknown; name?: unknown },
		@CurrentAdmin() admin: AdminIdentity
	) {
		return this.wallpapers.create(
			{ kind: body?.kind, name: body?.name, image: files?.image?.[0], thumbnail: files?.thumbnail?.[0] },
			admin.login
		);
	}

	@Delete(':id')
	@HttpCode(204)
	@UseGuards(AdminGuard)
	@ApiCookieAuth(SESSION_COOKIE)
	@ApiNoContentResponse({ description: '지웠다 (이미지 두 장도 함께)' })
	@ApiNotFoundResponse({ description: '배경화면이 없다' })
	@ApiUnauthorizedResponse({ description: '관리자로 로그인하지 않았다' })
	async remove(@Param('id') id: string) {
		await this.wallpapers.remove(id);
	}
}
