import { Body, Controller, Delete, Get, Put, UseGuards } from '@nestjs/common';
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
import { SiteService } from './site.service.js';

const PROFILE_EXAMPLE = {
	name: '김정현',
	nameEn: 'Kim Jeong Hyeon',
	role: 'Frontend Focused Fullstack Developer',
	school: '서울여자대학교',
	location: 'Seoul, South Korea',
	github: 'https://github.com/hyeoniverse',
	email: 'hyeoniverse.dev@gmail.com',
	skills: { frontend: ['React', 'TypeScript'], backend: ['Node.js'], interaction: ['GSAP'] },
	siteStack: ['React 19', 'Vite'],
};

/**
 * 사이트 콘텐츠: 사이트 주인의 프로필. 이 저장소를 가져다 띄우는 사람이 코드를 고치지 않고 시스템 설정에서 바꾼다.
 * 누구나 읽고, 관리자만 바꾼다. 저장한 값이 없으면 profile은 null이고 화면은 코드의 기본값을 쓴다
 */
@ApiTags('site')
@Controller('site')
export class SiteController {
	constructor(private readonly site: SiteService) {}

	@Get()
	@ApiOkResponse({
		description: '관리자가 저장한 프로필 (없으면 null)과 마지막으로 바꾼 시각',
		schema: { example: { profile: PROFILE_EXAMPLE, updatedAt: null } },
	})
	view() {
		return this.site.view();
	}

	@Put('profile')
	@UseGuards(AdminGuard)
	@RateLimit('write')
	@ApiCookieAuth(SESSION_COOKIE)
	@ApiBody({ schema: { example: PROFILE_EXAMPLE } })
	@ApiOkResponse({ description: '저장한 뒤의 사이트 콘텐츠' })
	@ApiBadRequestResponse({
		description: '규칙을 어겼다 (이름·이메일·GitHub 주소 필수, 길이, 개수). message에 이유를 모두 담는다',
	})
	@ApiUnauthorizedResponse({ description: '관리자로 로그인하지 않았다' })
	saveProfile(@Body() body: unknown, @CurrentAdmin() admin: AdminIdentity) {
		return this.site.saveProfile(body, admin.login);
	}

	@Delete('profile')
	@UseGuards(AdminGuard)
	@RateLimit('write')
	@ApiCookieAuth(SESSION_COOKIE)
	@ApiOkResponse({ description: '저장한 프로필을 지웠다 (코드의 기본값으로 돌아간다)' })
	@ApiUnauthorizedResponse({ description: '관리자로 로그인하지 않았다' })
	resetProfile(@CurrentAdmin() admin: AdminIdentity) {
		return this.site.resetProfile(admin.login);
	}
}
