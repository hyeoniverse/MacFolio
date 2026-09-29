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
import { MemoService } from './memo.service.js';

const ORGANIZATION_EXAMPLE = {
	folders: ['읽을거리'],
	posts: { 'cra-to-vite': '읽을거리' },
	moves: [{ from: '개발기/MacFolio', to: '읽을거리/MacFolio' }],
	pins: { 'read-only-memo': true },
};

/**
 * 메모(블로그) 정리 내용. 누구나 읽고(방문자도 관리자가 정리한 폴더로 본다), 관리자만 바꾼다.
 */
@ApiTags('memo')
@Controller('memo')
export class MemoController {
	constructor(private readonly memo: MemoService) {}

	@Get('organization')
	@ApiOkResponse({
		description: '정리 내용과 마지막으로 바꾼 시각',
		schema: { example: { ...ORGANIZATION_EXAMPLE, updatedAt: null } },
	})
	getOrganization() {
		return this.memo.getOrganization();
	}

	@Put('organization')
	@UseGuards(AdminGuard)
	@ApiCookieAuth(SESSION_COOKIE)
	@ApiBody({ schema: { example: ORGANIZATION_EXAMPLE } })
	@ApiOkResponse({ description: '저장한 정리 내용' })
	@ApiBadRequestResponse({ description: '규칙을 어겼다 (4단 폴더, 잘못된 이름 등). message에 이유를 모두 담는다' })
	@ApiUnauthorizedResponse({ description: '관리자로 로그인하지 않았다' })
	saveOrganization(@Body() body: unknown, @CurrentAdmin() admin: AdminIdentity) {
		return this.memo.saveOrganization(body, admin.login);
	}
}
