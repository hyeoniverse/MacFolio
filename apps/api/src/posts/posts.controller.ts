import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put, UseGuards } from '@nestjs/common';
import {
	ApiBadRequestResponse,
	ApiBody,
	ApiCookieAuth,
	ApiNoContentResponse,
	ApiOkResponse,
	ApiTags,
	ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AdminGuard, CurrentAdmin } from '../auth/admin.guard.js';
import type { AdminIdentity } from '../auth/auth.service.js';
import { SESSION_COOKIE } from '../auth/session.js';
import { PostsService } from './posts.service.js';

const POST_EXAMPLE = {
	title: '새 글',
	date: '2026-09-29',
	category: '개발기/MacFolio',
	summary: '목록에 보일 한 줄',
	body: '## 제목\n\n본문 (Markdown)',
};

/**
 * 블로그 글. 누구나 읽고, 관리자만 쓰고 고치고 지운다.
 * 저장소의 Markdown 글은 그대로 두고, 여기 있는 글이 같은 주소의 글을 대신하거나(고친 글) 가린다(지운 글).
 */
@ApiTags('posts')
@Controller('posts')
export class PostsController {
	constructor(private readonly posts: PostsService) {}

	@Get()
	@ApiOkResponse({ description: '서버에 있는 글 (지운 표시 포함)' })
	list() {
		return this.posts.list();
	}

	@Post()
	@UseGuards(AdminGuard)
	@ApiCookieAuth(SESSION_COOKIE)
	@ApiBody({ schema: { example: POST_EXAMPLE } })
	@ApiBadRequestResponse({ description: '입력 규칙을 어겼다' })
	@ApiUnauthorizedResponse({ description: '관리자로 로그인하지 않았다' })
	create(@Body() body: unknown, @CurrentAdmin() admin: AdminIdentity) {
		return this.posts.create(body, admin.login);
	}

	@Put(':slug')
	@UseGuards(AdminGuard)
	@ApiCookieAuth(SESSION_COOKIE)
	@ApiBody({ schema: { example: POST_EXAMPLE } })
	@ApiOkResponse({ description: '고친 글 (서버에 없던 Markdown 글이면 새로 만든다)' })
	@ApiUnauthorizedResponse({ description: '관리자로 로그인하지 않았다' })
	update(@Param('slug') slug: string, @Body() body: unknown, @CurrentAdmin() admin: AdminIdentity) {
		return this.posts.update(slug, body, admin.login);
	}

	@Delete(':slug')
	@HttpCode(204)
	@UseGuards(AdminGuard)
	@ApiCookieAuth(SESSION_COOKIE)
	@ApiNoContentResponse({ description: '지웠다' })
	@ApiUnauthorizedResponse({ description: '관리자로 로그인하지 않았다' })
	async remove(@Param('slug') slug: string, @CurrentAdmin() admin: AdminIdentity) {
		await this.posts.remove(slug, admin.login);
	}
}
