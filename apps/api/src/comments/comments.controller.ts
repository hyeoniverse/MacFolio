import { Body, Controller, Delete, Get, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import {
	ApiBadRequestResponse,
	ApiBody,
	ApiCreatedResponse,
	ApiForbiddenResponse,
	ApiNoContentResponse,
	ApiNotFoundResponse,
	ApiOkResponse,
	ApiTags,
	ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { SkipThrottle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service.js';
import { SESSION_COOKIE } from '../auth/session.js';
import { CommentsService } from './comments.service.js';

/**
 * 블로그 글의 댓글. 누구나 읽고 쓴다. 관리자로 로그인했으면 김정현으로 쓰고 무엇이든 지운다.
 * 쓰기·지우기는 IP마다 1분에 COMMENT_RATE_LIMIT번까지 (도배, 비밀번호 무작위 대입을 늦춘다).
 */
@ApiTags('comments')
@Controller()
export class CommentsController {
	constructor(
		private readonly comments: CommentsService,
		private readonly auth: AuthService
	) {}

	/** 로그인한 관리자 (없으면 null). 방문자도 쓰는 경로라 Guard 대신 직접 확인한다 */
	private admin(request: Request) {
		return this.auth.findAdmin(request.cookies?.[SESSION_COOKIE]);
	}

	@Get('posts/:slug/comments')
	@ApiOkResponse({ description: '댓글 (오래된 것부터). 비밀번호·IP 해시는 담지 않는다' })
	list(@Param('slug') slug: string) {
		return this.comments.list(slug);
	}

	@Post('posts/:slug/comments')
	@UseGuards(ThrottlerGuard)
	@SkipThrottle({ login: true })
	@ApiBody({ schema: { example: { name: '민수', password: '1234', body: '잘 봤어요!' } } })
	@ApiCreatedResponse({ description: '쓴 댓글' })
	@ApiBadRequestResponse({ description: '입력 규칙을 어겼다 (이름 1~20자, 비밀번호 4~20자, 내용 1~500자)' })
	@ApiTooManyRequestsResponse({ description: '짧은 시간에 너무 많이 썼다' })
	async create(@Param('slug') slug: string, @Body() body: unknown, @Req() request: Request) {
		return this.comments.create(slug, body, request.ip ?? '', await this.admin(request));
	}

	@Delete('comments/:id')
	@HttpCode(204)
	@UseGuards(ThrottlerGuard)
	@SkipThrottle({ login: true })
	@ApiBody({ required: false, schema: { example: { password: '1234' } } })
	@ApiNoContentResponse({ description: '지웠다' })
	@ApiForbiddenResponse({ description: '비밀번호가 맞지 않는다' })
	@ApiNotFoundResponse({ description: '댓글이 없다' })
	async remove(@Param('id') id: string, @Body() body: unknown, @Req() request: Request) {
		await this.comments.remove(id, body, await this.admin(request));
	}
}
