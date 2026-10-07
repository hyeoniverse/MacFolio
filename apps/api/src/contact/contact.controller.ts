import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import {
	ApiBadGatewayResponse,
	ApiBadRequestResponse,
	ApiBody,
	ApiOkResponse,
	ApiServiceUnavailableResponse,
	ApiTags,
	ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { ContactService } from './contact.service.js';

/** 메일 앱의 연락 메일 (#25): 방문자가 사이트 주인에게 보낸다 */
@ApiTags('contact')
@Controller('contact')
export class ContactController {
	constructor(private readonly contact: ContactService) {}

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
	@ApiOkResponse({ description: '보냈다 ({ status: "sent" }). 받는 사람은 사이트 주인, Reply-To는 보낸 사람' })
	@ApiBadRequestResponse({ description: '입력 규칙을 어겼거나 사람 확인(Turnstile)에 실패했다' })
	@ApiTooManyRequestsResponse({ description: 'IP마다, 사이트 전체로 하루 상한에 닿았다' })
	@ApiServiceUnavailableResponse({ description: '서버에 메일 설정이 없다 (사이트는 메일 앱 열기로 대신한다)' })
	@ApiBadGatewayResponse({ description: '메일 서비스(Resend)가 받지 않았다' })
	send(@Body() body: unknown, @Req() request: Request) {
		return this.contact.send(body, request.ip ?? '');
	}
}
