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

const PROJECTS_EXAMPLE = {
	items: [
		{ id: 'macfolio', override: { tagline: '웹에서 만나는 Mac' } },
		{ id: 'devcourse', hidden: true },
		{
			id: 'new-project',
			override: {
				name: '새 프로젝트',
				url: 'https://github.com/hyeoniverse/new-project',
				demo: 'https://new-project.example.com',
				app: { label: '새 앱', icon: 'projects/new-project/app-icon.png' },
			},
		},
	],
};

const RESUME_EXAMPLE = {
	markdown: '# 김정현\n\n> 화면에서 서버까지, 끝까지 만들고 운영하는 개발자\n\n## 강점\n- **끝까지 운영** — …',
};
const WIDGETS_EXAMPLE = { photoAlbum: 'folder:widget01' };

const RESUME_EN_EXAMPLE = {
	markdown: '# Jeonghyeon Kim\n\n> I build and run products end to end\n\n## Strengths\n- **Ships and operates** — …',
};

/**
 * 사이트 콘텐츠: 사이트 주인의 프로필·프로젝트·이력서. 이 저장소를 가져다 띄우는 사람이 코드를 고치지 않고 시스템 설정에서 바꾼다.
 * 누구나 읽고, 관리자만 바꾼다. 저장한 값이 없으면 profile은 null이고 화면은 코드의 기본값을 쓴다
 */
@ApiTags('site')
@Controller('site')
export class SiteController {
	constructor(private readonly site: SiteService) {}

	@Get()
	@ApiOkResponse({
		description: '관리자가 저장한 프로필·프로젝트·이력서·위젯 기본값 (없으면 null)과 마지막으로 바꾼 시각',
		schema: {
			example: {
				profile: PROFILE_EXAMPLE,
				projects: PROJECTS_EXAMPLE,
				resume: RESUME_EXAMPLE,
				resumeEn: null,
				widgets: WIDGETS_EXAMPLE,
				updatedAt: null,
			},
		},
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

	@Put('projects')
	@UseGuards(AdminGuard)
	@RateLimit('write')
	@ApiCookieAuth(SESSION_COOKIE)
	@ApiBody({ schema: { example: PROJECTS_EXAMPLE } })
	@ApiOkResponse({ description: '저장한 뒤의 사이트 콘텐츠' })
	@ApiBadRequestResponse({
		description:
			'규칙을 어겼다 (id 모양·겹침·앱 이름, 링크·iframe은 https, 그림은 사이트 안 경로나 https, 길이·개수). message에 어디가 왜 틀렸는지 모두 담는다',
	})
	@ApiUnauthorizedResponse({ description: '관리자로 로그인하지 않았다' })
	saveProjects(@Body() body: unknown, @CurrentAdmin() admin: AdminIdentity) {
		return this.site.saveProjects(body, admin.login);
	}

	@Delete('projects')
	@UseGuards(AdminGuard)
	@RateLimit('write')
	@ApiCookieAuth(SESSION_COOKIE)
	@ApiOkResponse({ description: '저장한 프로젝트를 지웠다 (코드의 기본값으로 돌아간다)' })
	@ApiUnauthorizedResponse({ description: '관리자로 로그인하지 않았다' })
	resetProjects(@CurrentAdmin() admin: AdminIdentity) {
		return this.site.resetProjects(admin.login);
	}

	@Put('resume')
	@UseGuards(AdminGuard)
	@RateLimit('write')
	@ApiCookieAuth(SESSION_COOKIE)
	@ApiBody({ schema: { example: RESUME_EXAMPLE } })
	@ApiOkResponse({ description: '저장한 뒤의 사이트 콘텐츠' })
	@ApiBadRequestResponse({ description: '규칙을 어겼다 (비었음, 길이, 쓸 수 없는 글자). message에 이유를 담는다' })
	@ApiUnauthorizedResponse({ description: '관리자로 로그인하지 않았다' })
	saveResume(@Body() body: unknown, @CurrentAdmin() admin: AdminIdentity) {
		return this.site.saveResume(body, admin.login);
	}

	@Delete('resume')
	@UseGuards(AdminGuard)
	@RateLimit('write')
	@ApiCookieAuth(SESSION_COOKIE)
	@ApiOkResponse({ description: '저장한 이력서를 지웠다 (코드의 기본 이력서로 돌아간다)' })
	@ApiUnauthorizedResponse({ description: '관리자로 로그인하지 않았다' })
	resetResume(@CurrentAdmin() admin: AdminIdentity) {
		return this.site.resetResume(admin.login);
	}

	@Put('resume/en')
	@UseGuards(AdminGuard)
	@RateLimit('write')
	@ApiCookieAuth(SESSION_COOKIE)
	@ApiBody({ schema: { example: RESUME_EN_EXAMPLE } })
	@ApiOkResponse({ description: '저장한 뒤의 사이트 콘텐츠 (영문 이력서는 resumeEn)' })
	@ApiBadRequestResponse({ description: '규칙을 어겼다 (비었음, 길이, 쓸 수 없는 글자). message에 이유를 담는다' })
	@ApiUnauthorizedResponse({ description: '관리자로 로그인하지 않았다' })
	saveResumeEn(@Body() body: unknown, @CurrentAdmin() admin: AdminIdentity) {
		return this.site.saveResume(body, admin.login, 'en');
	}

	@Delete('resume/en')
	@UseGuards(AdminGuard)
	@RateLimit('write')
	@ApiCookieAuth(SESSION_COOKIE)
	@ApiOkResponse({ description: '저장한 영문 이력서를 지웠다 (코드의 기본 영문 이력서로 돌아간다)' })
	@ApiUnauthorizedResponse({ description: '관리자로 로그인하지 않았다' })
	resetResumeEn(@CurrentAdmin() admin: AdminIdentity) {
		return this.site.resetResume(admin.login, 'en');
	}

	@Put('widgets')
	@UseGuards(AdminGuard)
	@RateLimit('write')
	@ApiCookieAuth(SESSION_COOKIE)
	@ApiBody({ schema: { example: WIDGETS_EXAMPLE } })
	@ApiOkResponse({
		description:
			'저장한 뒤의 사이트 콘텐츠 (widgets). 방문자가 자기 브라우저에서 고르지 않은 위젯은 이 값을 쓴다. photoAlbum이 null이면 기본값 없음',
	})
	@ApiBadRequestResponse({
		description: '규칙을 어겼다 (글자가 아님, 100자 넘음, 쓸 수 없는 글자). message에 이유를 담는다',
	})
	@ApiUnauthorizedResponse({ description: '관리자로 로그인하지 않았다' })
	saveWidgets(@Body() body: unknown, @CurrentAdmin() admin: AdminIdentity) {
		return this.site.saveWidgets(body, admin.login);
	}
}
