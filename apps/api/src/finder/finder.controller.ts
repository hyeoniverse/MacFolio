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
import { FinderService } from './finder.service.js';

const LAYOUT_EXAMPLE = {
	folders: [
		{ id: 'folder:k3x9a1', name: '발표 자료', parent: 'docs' },
		{ id: 'folder:p0q2r7', name: '작업', parent: 'desktop' },
	],
	files: { 'file:resume/abc123.pdf': 'folder:k3x9a1' },
	aliases: ['docs:이력서', 'docs:포트폴리오', 'docs:자격증', 'projects'],
};

/**
 * Finder의 폴더 구조. 누구나 읽고(방문자도 관리자가 정리한 폴더로 본다), 관리자만 바꾼다.
 * 파일을 옮겨도 R2 키와 문서 표의 폴더는 그대로이고, 보이는 자리만 여기에 적는다
 */
@ApiTags('finder')
@Controller('finder')
export class FinderController {
	constructor(private readonly finder: FinderService) {}

	@Get('layout')
	@ApiOkResponse({
		description: '폴더 구조와 마지막으로 바꾼 시각',
		schema: { example: { ...LAYOUT_EXAMPLE, updatedAt: null } },
	})
	getLayout() {
		return this.finder.getLayout();
	}

	@Put('layout')
	@UseGuards(AdminGuard)
	@RateLimit('write')
	@ApiCookieAuth(SESSION_COOKIE)
	@ApiBody({ schema: { example: LAYOUT_EXAMPLE } })
	@ApiOkResponse({ description: '저장한 폴더 구조' })
	@ApiBadRequestResponse({
		description: '규칙을 어겼다 (없는 상위 폴더, 고리, 겹친 이름 등). message에 이유를 모두 담는다',
	})
	@ApiUnauthorizedResponse({ description: '관리자로 로그인하지 않았다' })
	saveLayout(@Body() body: unknown, @CurrentAdmin() admin: AdminIdentity) {
		return this.finder.saveLayout(body, admin.login);
	}
}
