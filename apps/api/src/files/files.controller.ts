import { Controller, Get, Param, Post, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
	ApiBadRequestResponse,
	ApiBody,
	ApiConsumes,
	ApiCookieAuth,
	ApiCreatedResponse,
	ApiNotFoundResponse,
	ApiOkResponse,
	ApiPayloadTooLargeResponse,
	ApiTags,
	ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { AdminGuard, CurrentAdmin } from '../auth/admin.guard.js';
import type { AdminIdentity } from '../auth/auth.service.js';
import { SESSION_COOKIE } from '../auth/session.js';
import { FilesService, type IncomingFile } from './files.service.js';
import { contentDisposition, MAX_UPLOAD_BYTES } from './rules.js';

/**
 * 글에 넣는 이미지와 첨부 파일. 관리자만 올리고, 누구나 받는다.
 * 올린 파일은 이 사이트와 다른 주소(API)에서 내려가므로, 받는 쪽에서 스크립트로 실행되지 않게 막는다.
 */
@ApiTags('files')
@Controller('files')
export class FilesController {
	constructor(private readonly files: FilesService) {}

	@Post()
	@UseGuards(AdminGuard)
	@UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }))
	@ApiCookieAuth(SESSION_COOKIE)
	@ApiConsumes('multipart/form-data')
	@ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
	@ApiCreatedResponse({ description: '올린 파일 (주소는 /files/:id)' })
	@ApiBadRequestResponse({ description: '파일이 없다' })
	@ApiPayloadTooLargeResponse({ description: '10MB를 넘는다' })
	@ApiUnauthorizedResponse({ description: '관리자로 로그인하지 않았다' })
	upload(@UploadedFile() file: IncomingFile | undefined, @CurrentAdmin() admin: AdminIdentity) {
		return this.files.upload(file, admin.login);
	}

	@Get(':id')
	@ApiOkResponse({ description: '파일. 이미지는 바로 보이고, 나머지는 내려받는다' })
	@ApiNotFoundResponse({ description: '파일이 없다' })
	async download(@Param('id') id: string, @Res() res: Response) {
		const file = await this.files.find(id);
		res.set({
			'Content-Type': file.type,
			'Content-Length': String(file.size),
			// 이미지만 바로 보여 주고, 나머지(HTML·SVG 등)는 내려받게 해서 이 주소에서 실행되지 않게 한다
			'Content-Disposition': contentDisposition(file.image ? 'inline' : 'attachment', file.name),
			'X-Content-Type-Options': 'nosniff',
			'Content-Security-Policy': "default-src 'none'; sandbox",
			// 다른 주소(프론트엔드)의 <img>에서 불러올 수 있게 (helmet 기본값은 same-origin)
			'Cross-Origin-Resource-Policy': 'cross-origin',
			// 같은 주소의 파일은 바뀌지 않는다
			'Cache-Control': 'public, max-age=31536000, immutable',
		});
		res.end(Buffer.from(file.data));
	}
}
