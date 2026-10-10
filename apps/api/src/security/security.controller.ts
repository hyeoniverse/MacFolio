import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import {
	ApiBadRequestResponse,
	ApiBody,
	ApiCookieAuth,
	ApiOkResponse,
	ApiTags,
	ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AdminGuard, CurrentAdmin } from '../auth/admin.guard.js';
import type { AdminIdentity } from '../auth/auth.service.js';
import { SESSION_COOKIE } from '../auth/session.js';
import { RateLimit } from '../common/rate-limit.js';
import { SecurityService } from './security.service.js';

/**
 * 보안 설정: 메일·댓글·메시지를 쓸 때 사람 확인(Cloudflare Turnstile)을 할지. 누구나 읽고(화면이 위젯을 그릴지 정한다),
 * 관리자만 바꾼다 (시스템 설정의 '개인정보 보호 및 보안')
 */
@ApiTags('security')
@Controller('security')
export class SecurityController {
	constructor(private readonly security: SecurityService) {}

	@Get()
	@ApiOkResponse({
		description: '곳마다 사람 확인을 켰는지, 서버에 Turnstile 키가 있는지(available), 위젯의 사이트 키',
		schema: {
			example: {
				contact: true,
				comment: false,
				message: false,
				available: true,
				turnstileSiteKey: '0x4AAAA…',
				updatedAt: null,
			},
		},
	})
	get() {
		return this.security.view();
	}

	@Put()
	@UseGuards(AdminGuard)
	@RateLimit('write')
	@ApiCookieAuth(SESSION_COOKIE)
	@ApiBody({ schema: { example: { comment: true } } })
	@ApiOkResponse({ description: '바꾼 뒤의 설정' })
	@ApiBadRequestResponse({ description: '모르는 설정, true/false가 아닌 값, 바꿀 것이 없음' })
	@ApiUnauthorizedResponse({ description: '관리자로 로그인하지 않았다' })
	update(@Body() body: unknown, @CurrentAdmin() admin: AdminIdentity) {
		return this.security.update(body, admin.login);
	}
}
