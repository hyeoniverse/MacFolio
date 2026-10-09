import { Body, Controller, Delete, Get, HttpCode, Param, Post, Req, Res } from '@nestjs/common';
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
import type { Request, Response } from 'express';
import { AuthService } from '../auth/auth.service.js';
import { SESSION_COOKIE } from '../auth/session.js';
import { VisitorsService } from '../visitors/visitors.service.js';
import { CommentsService } from './comments.service.js';
import { RateLimit } from '../common/rate-limit.js';

/**
 * 블로그 글의 댓글. 누구나 읽고 쓴다. 방문자는 쿠키로 정한 이름으로 쓰고, 같은 브라우저에서 쓴 것만 지운다.
 * 관리자로 로그인했으면 김정현으로 쓰고 무엇이든 지운다. 쓰기·지우기는 IP마다 1분에 COMMENT_RATE_LIMIT번까지 (도배를 늦춘다).
 */
@ApiTags('comments')
@Controller()
export class CommentsController {
	constructor(
		private readonly comments: CommentsService,
		private readonly auth: AuthService,
		private readonly visitors: VisitorsService
	) {}

	/** 로그인한 관리자 (없으면 null). 방문자도 쓰는 경로라 Guard 대신 직접 확인한다 */
	private admin(request: Request) {
		return this.auth.findAdmin(request.cookies?.[SESSION_COOKIE]);
	}

	@Get('posts/:slug/comments')
	@ApiOkResponse({ description: '댓글 (오래된 것부터). mine: 이 브라우저가 쓴 댓글. 방문자·IP 해시는 담지 않는다' })
	list(@Param('slug') slug: string, @Req() request: Request) {
		return this.comments.list(slug, this.visitors.peek(request));
	}

	@Post('posts/:slug/comments')
	@RateLimit('comment')
	@ApiBody({ schema: { example: { body: '잘 봤어요!' } } })
	@ApiCreatedResponse({ description: '쓴 댓글. 처음 쓰는 브라우저에는 방문자 쿠키를 준다' })
	@ApiBadRequestResponse({ description: '입력 규칙을 어겼다 (내용 1~500자)' })
	@ApiTooManyRequestsResponse({ description: '짧은 시간에 너무 많이 썼다' })
	async create(
		@Param('slug') slug: string,
		@Body() body: unknown,
		@Req() request: Request,
		@Res({ passthrough: true }) response: Response
	) {
		const visitor = this.visitors.identify(request, response);
		return this.comments.create(slug, body, request.ip ?? '', visitor, await this.admin(request));
	}

	@Delete('comments/:id')
	@HttpCode(204)
	@RateLimit('comment')
	@ApiNoContentResponse({ description: '지웠다' })
	@ApiForbiddenResponse({ description: '다른 브라우저에서 쓴 댓글이다' })
	@ApiNotFoundResponse({ description: '댓글이 없다' })
	async remove(@Param('id') id: string, @Req() request: Request) {
		await this.comments.remove(id, this.visitors.peek(request), await this.admin(request));
	}
}
