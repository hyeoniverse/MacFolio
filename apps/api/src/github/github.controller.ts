import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import {
	ApiBadGatewayResponse,
	ApiBadRequestResponse,
	ApiBody,
	ApiCookieAuth,
	ApiNotFoundResponse,
	ApiOkResponse,
	ApiTags,
	ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AdminGuard, CurrentAdmin } from '../auth/admin.guard.js';
import type { AdminIdentity } from '../auth/auth.service.js';
import { SESSION_COOKIE } from '../auth/session.js';
import { GithubService } from './github.service.js';
import { MAX_SHOWCASE } from './showcase.js';
import { RateLimit } from '../common/rate-limit.js';

/**
 * GitHub 앱에 보여 줄 관리자의 GitHub 프로필·README·저장소·활동.
 * 누구나 읽고, 관리자만 보일 저장소를 고른다 (시스템 설정 → GitHub).
 */
@ApiTags('github')
@Controller('github')
export class GithubController {
	constructor(private readonly github: GithubService) {}

	@Get('profile')
	@ApiOkResponse({ description: '프로필, README(Markdown), 고른 저장소. 서버가 한동안 들고 있다가 새로 받는다' })
	@ApiBadGatewayResponse({ description: 'GitHub에 닿지 못했고 들고 있는 값도 없다' })
	profile() {
		return this.github.profile();
	}

	@Get('activity')
	@ApiOkResponse({ description: '기여 달력(지난 1년)과 최근 공개 활동. 서버가 한동안 들고 있다가 새로 받는다' })
	@ApiBadGatewayResponse({ description: 'GitHub에 닿지 못했고 들고 있는 값도 없다' })
	activity() {
		return this.github.activity();
	}

	@Get('candidates')
	@UseGuards(AdminGuard)
	@ApiCookieAuth(SESSION_COOKIE)
	@ApiOkResponse({ description: '고른 저장소 이름과, 고를 수 있는 저장소 (내 저장소 → 조직 저장소)' })
	@ApiUnauthorizedResponse({ description: '관리자로 로그인하지 않았다' })
	candidates() {
		return this.github.candidates();
	}

	@Get('repos/:owner/:name')
	@UseGuards(AdminGuard)
	@ApiCookieAuth(SESSION_COOKIE)
	@ApiOkResponse({ description: '저장소 카드 (직접 입력한 저장소 확인)' })
	@ApiNotFoundResponse({ description: '없거나 비공개인 저장소' })
	@ApiUnauthorizedResponse({ description: '관리자로 로그인하지 않았다' })
	lookup(@Param('owner') owner: string, @Param('name') name: string) {
		return this.github.lookup(`${owner}/${name}`);
	}

	@Put('showcase')
	@UseGuards(AdminGuard)
	@RateLimit('write')
	@ApiCookieAuth(SESSION_COOKIE)
	@ApiBody({ schema: { example: { repos: ['hyeoniverse/MacFolio', 'Devcourse-NewPick/front'] } } })
	@ApiOkResponse({ description: '저장한 목록 (GitHub에 적힌 이름으로)' })
	@ApiBadRequestResponse({ description: `이름이 잘못되었거나, 같은 저장소가 두 번 있거나, ${MAX_SHOWCASE}개를 넘는다` })
	@ApiNotFoundResponse({ description: '새로 더한 저장소가 GitHub에 없거나 비공개다' })
	@ApiUnauthorizedResponse({ description: '관리자로 로그인하지 않았다' })
	saveShowcase(@Body() body: unknown, @CurrentAdmin() admin: AdminIdentity) {
		return this.github.saveShowcase(body, admin.login);
	}
}
