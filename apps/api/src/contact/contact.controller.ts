import { Body, Controller, Get, HttpCode, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import {
	ApiBadGatewayResponse,
	ApiBadRequestResponse,
	ApiBody,
	ApiCookieAuth,
	ApiNotFoundResponse,
	ApiOkResponse,
	ApiServiceUnavailableResponse,
	ApiTags,
	ApiTooManyRequestsResponse,
	ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AdminGuard } from '../auth/admin.guard.js';
import { VisitorsService } from '../visitors/visitors.service.js';
import { ContactService } from './contact.service.js';

/**
 * 메일 앱의 연락 메일 (#25): 방문자가 사이트 주인에게 보낸다. 보낸 메일은 보낸 브라우저(방문자 쿠키)의 보낸 편지함에만 보이고,
 * 관리자는 받은 편지함에서 모두 보고 답장한다
 */
@ApiTags('contact')
@Controller('contact')
export class ContactController {
	constructor(
		private readonly contact: ContactService,
		private readonly visitors: VisitorsService
	) {}

	@Get()
	@ApiOkResponse({
		description:
			'enabled: 서버에서 보낼 수 있다 (아니면 사이트가 방문자의 메일 앱을 연다). turnstileSiteKey: 사람 확인 위젯에 쓸 공개 키 (없으면 null)',
	})
	status() {
		return this.contact.status();
	}

	@Post()
	@HttpCode(200)
	@ApiBody({
		schema: {
			example: {
				name: '민수',
				email: 'minsu@example.com',
				subject: '포트폴리오 잘 봤습니다',
				body: '안녕하세요…',
				turnstileToken: '(Turnstile이 준 토큰)',
			},
		},
	})
	@ApiOkResponse({
		description:
			'보냈다 ({ status: "sent", mail }). 받는 사람은 사이트 주인, Reply-To는 보낸 사람. 처음 보내는 브라우저에는 방문자 쿠키를 준다',
	})
	@ApiBadRequestResponse({ description: '입력 규칙을 어겼거나 사람 확인(Turnstile)에 실패했다' })
	@ApiTooManyRequestsResponse({ description: 'IP마다, 사이트 전체로 하루 상한에 닿았다' })
	@ApiServiceUnavailableResponse({ description: '서버에 메일 설정이 없다 (사이트는 메일 앱 열기로 대신한다)' })
	@ApiBadGatewayResponse({ description: '메일 서비스(Resend)가 받지 않았다' })
	send(@Body() body: unknown, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
		return this.contact.send(body, request.ip ?? '', this.visitors.identify(request, response));
	}

	@Get('mine')
	@ApiOkResponse({
		description: '이 브라우저(방문자 쿠키)가 보낸 메일과 관리자 답장 (보낸 편지함). 쿠키가 없으면 빈 목록',
	})
	mine(@Req() request: Request) {
		return this.contact.mine(this.visitors.peek(request));
	}

	@Get('inbox')
	@UseGuards(AdminGuard)
	@ApiCookieAuth()
	@ApiOkResponse({ description: '받은 모든 메일과 답장 (관리자의 받은 편지함, 새 것부터)' })
	@ApiUnauthorizedResponse({ description: '관리자 로그인이 필요하다' })
	inbox() {
		return this.contact.inbox();
	}

	@Post(':id/reply')
	@HttpCode(200)
	@UseGuards(AdminGuard)
	@ApiCookieAuth()
	@ApiBody({ schema: { example: { body: '연락 주셔서 감사합니다!' } } })
	@ApiOkResponse({ description: '답장을 보냈다: 답장이 붙은 메일. 방문자의 주소로 가고 Reply-To는 사이트 주인' })
	@ApiBadRequestResponse({ description: '답장 내용이 비었거나 너무 길다' })
	@ApiNotFoundResponse({ description: '메일이 없다' })
	@ApiUnauthorizedResponse({ description: '관리자 로그인이 필요하다' })
	@ApiBadGatewayResponse({ description: '메일 서비스(Resend)가 받지 않았다' })
	reply(@Param('id') id: string, @Body() body: unknown) {
		return this.contact.reply(id, body);
	}
}
