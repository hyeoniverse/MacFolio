import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { AdminGuard } from '../auth/admin.guard.js';
import { SESSION_COOKIE } from '../auth/session.js';
import { ResourcesService } from './resources.service.js';

/** 서버 자원 사용률과 Oracle Always Free 유휴 회수 위험 (관리자만) */
@ApiTags('resources')
@Controller('resources')
export class ResourcesController {
	constructor(private readonly resources: ResourcesService) {}

	@Get()
	@UseGuards(AdminGuard)
	@ApiCookieAuth(SESSION_COOKIE)
	@ApiOkResponse({
		description:
			'감시 모드(off·free·payg)와 최근 7일 사용률(한 시간 평균), 가장 최근 표본. free면 유휴 회수 위험(조건마다 값과 기준)과 알림 메일 상태',
	})
	@ApiUnauthorizedResponse({ description: '관리자로 로그인하지 않았다' })
	status() {
		return this.resources.status();
	}
}
