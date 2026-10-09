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
import { MessagesService } from './messages.service.js';
import { RateLimit } from '../common/rate-limit.js';

/**
 * 메시지 앱 (감상·의견·피드백). 누구나 읽고 쓴다. 이름·비밀번호는 받지 않는다 (방문자 쿠키로 정한 이름).
 * 쓰기·지우기는 댓글과 같은 제한 (IP마다 1분에 COMMENT_RATE_LIMIT번).
 */
@ApiTags('messages')
@Controller('messages')
export class MessagesController {
	constructor(
		private readonly messages: MessagesService,
		private readonly auth: AuthService,
		private readonly visitors: VisitorsService
	) {}

	private admin(request: Request) {
		return this.auth.findAdmin(request.cookies?.[SESSION_COOKIE]);
	}

	@Get('threads')
	@ApiOkResponse({ description: '주인 안내(id: owner) + 방문자가 남긴 피드백. mine: 이 브라우저가 남긴 것' })
	listThreads(@Req() request: Request) {
		return this.messages.listThreads(this.visitors.peek(request));
	}

	@Get('threads/:id')
	@ApiOkResponse({ description: '피드백의 말풍선 (오래된 것부터). owner는 주인 안내에 단 답글' })
	@ApiNotFoundResponse({ description: '피드백이 없다' })
	listMessages(@Param('id') id: string, @Req() request: Request) {
		return this.messages.listMessages(id, this.visitors.peek(request));
	}

	@Post('threads')
	@RateLimit('comment')
	@ApiBody({ schema: { example: { body: '디자인이 깔끔해요' } } })
	@ApiCreatedResponse({ description: '새 피드백과 그 첫 말풍선' })
	@ApiBadRequestResponse({ description: '내용이 비었거나 500자를 넘는다' })
	@ApiTooManyRequestsResponse({ description: '짧은 시간에 너무 많이 썼다' })
	async createThread(@Body() body: unknown, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
		const visitor = this.visitors.identify(request, response);
		return this.messages.createThread(body, request.ip ?? '', visitor, await this.admin(request));
	}

	@Post('threads/:id')
	@RateLimit('comment')
	@ApiBody({ schema: { example: { body: '저도 그래요' } } })
	@ApiCreatedResponse({ description: '단 답글' })
	@ApiNotFoundResponse({ description: '피드백이 없다' })
	async post(
		@Param('id') id: string,
		@Body() body: unknown,
		@Req() request: Request,
		@Res({ passthrough: true }) response: Response
	) {
		const visitor = this.visitors.identify(request, response);
		return this.messages.post(id, body, request.ip ?? '', visitor, await this.admin(request));
	}

	@Delete(':id')
	@HttpCode(204)
	@RateLimit('comment')
	@ApiNoContentResponse({ description: '지웠다' })
	@ApiForbiddenResponse({ description: '다른 브라우저에서 쓴 메시지다' })
	@ApiNotFoundResponse({ description: '메시지가 없다' })
	async remove(@Param('id') id: string, @Req() request: Request) {
		await this.messages.remove(id, this.visitors.peek(request), await this.admin(request));
	}
}
