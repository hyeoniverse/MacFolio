import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import {
	ApiBadRequestResponse,
	ApiBody,
	ApiCookieAuth,
	ApiCreatedResponse,
	ApiNoContentResponse,
	ApiNotFoundResponse,
	ApiOkResponse,
	ApiServiceUnavailableResponse,
	ApiTags,
	ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { DESKTOP_DOCUMENT_FOLDER, DOCUMENT_FOLDERS, MAX_DOCUMENT_BYTES } from '@macfolio/contracts';
import { AdminGuard, CurrentAdmin } from '../auth/admin.guard.js';
import type { AdminIdentity } from '../auth/auth.service.js';
import { SESSION_COOKIE } from '../auth/session.js';
import { RateLimit } from '../common/rate-limit.js';
import { DocumentsService } from './documents.service.js';

const fileFields = {
	folder: {
		description: '이력서·포트폴리오·자격증, 데스크탑(바탕화면), 또는 프로젝트 폴더 project:<프로젝트 id>',
		oneOf: [
			{ type: 'string', enum: [...DOCUMENT_FOLDERS, DESKTOP_DOCUMENT_FOLDER] },
			{ type: 'string', pattern: '^project:[a-z0-9][a-z0-9-]{0,39}$', example: 'project:macfolio' },
		],
	},
	name: {
		type: 'string',
		maxLength: 100,
		description: '확장자 포함 (pdf·그림·문서·영상·소리·zip, contracts의 DOCUMENT_EXTENSIONS)',
	},
	size: { type: 'integer', minimum: 1, maximum: MAX_DOCUMENT_BYTES },
};

/**
 * Finder의 문서 파일 (이력서·포트폴리오·자격증, 프로젝트 폴더). 누구나 목록을 보고, 관리자만 올리고 이름을 바꾸고 지운다.
 * 파일 자체는 R2에 있고 사이트 주소 /files/<key>로 내려간다 (사이트 Worker)
 */
@ApiTags('documents')
@Controller('documents')
export class DocumentsController {
	constructor(private readonly documents: DocumentsService) {}

	@Get()
	@ApiOkResponse({ description: '문서 파일 (폴더 순서, 그 안에서 올린 순서)' })
	list() {
		return this.documents.list();
	}

	@Post('uploads')
	@UseGuards(AdminGuard)
	@RateLimit('upload')
	@ApiCookieAuth(SESSION_COOKIE)
	@ApiBody({ schema: { type: 'object', required: ['folder', 'name', 'size'], properties: fileFields } })
	@ApiCreatedResponse({ description: 'R2에 바로 PUT할 서명 주소 (5분, Content-Length가 size여야 한다)' })
	@ApiBadRequestResponse({ description: '폴더·종류·크기가 맞지 않다' })
	@ApiUnauthorizedResponse({ description: '관리자로 로그인하지 않았다' })
	@ApiServiceUnavailableResponse({ description: '서버에 R2가 설정되지 않았다' })
	uploadTicket(@Body() body: unknown) {
		return this.documents.uploadTicket(body);
	}

	@Post()
	@UseGuards(AdminGuard)
	@RateLimit('upload')
	@ApiCookieAuth(SESSION_COOKIE)
	@ApiBody({
		schema: {
			type: 'object',
			required: ['folder', 'name', 'key', 'size'],
			properties: { ...fileFields, key: { type: 'string', description: '서명 주소를 받을 때의 키' } },
		},
	})
	@ApiCreatedResponse({ description: '목록에 더한 파일' })
	@ApiBadRequestResponse({ description: '파일이 R2에 없거나 크기·키가 맞지 않다' })
	@ApiUnauthorizedResponse({ description: '관리자로 로그인하지 않았다' })
	@ApiServiceUnavailableResponse({ description: '서버에 R2가 설정되지 않았다' })
	create(@Body() body: unknown, @CurrentAdmin() admin: AdminIdentity) {
		return this.documents.create(body, admin.login);
	}

	@Patch(':id')
	@UseGuards(AdminGuard)
	@RateLimit('write')
	@ApiCookieAuth(SESSION_COOKIE)
	@ApiBody({ schema: { type: 'object', required: ['name'], properties: { name: fileFields.name } } })
	@ApiOkResponse({ description: '이름을 바꾼 파일' })
	@ApiBadRequestResponse({ description: '이름이 비었거나 확장자가 바뀌었다' })
	@ApiNotFoundResponse({ description: '파일이 없다' })
	@ApiUnauthorizedResponse({ description: '관리자로 로그인하지 않았다' })
	rename(@Param('id') id: string, @Body() body: unknown) {
		return this.documents.rename(id, body);
	}

	@Delete(':id')
	@HttpCode(204)
	@UseGuards(AdminGuard)
	@RateLimit('write')
	@ApiCookieAuth(SESSION_COOKIE)
	@ApiNoContentResponse({ description: '지웠다 (R2의 파일도)' })
	@ApiNotFoundResponse({ description: '파일이 없다' })
	@ApiUnauthorizedResponse({ description: '관리자로 로그인하지 않았다' })
	@ApiServiceUnavailableResponse({ description: '서버에 R2가 설정되지 않았거나 R2가 지우지 못했다' })
	async remove(@Param('id') id: string) {
		await this.documents.remove(id);
	}
}
