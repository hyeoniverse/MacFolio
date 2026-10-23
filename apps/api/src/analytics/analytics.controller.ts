import { Body, Controller, Get, Header, HttpCode, Post, Query, Req, UseGuards } from '@nestjs/common';
import {
	ApiBadRequestResponse,
	ApiBody,
	ApiConsumes,
	ApiCookieAuth,
	ApiNoContentResponse,
	ApiOkResponse,
	ApiQuery,
	ApiTags,
	ApiTooManyRequestsResponse,
	ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AdminGuard } from '../auth/admin.guard.js';
import { AdminIpService } from '../auth/admin-ip.service.js';
import { AuthService } from '../auth/auth.service.js';
import { SESSION_COOKIE } from '../auth/session.js';
import { AnalyticsRecorder } from './analytics-recorder.service.js';
import { AnalyticsStats } from './analytics-stats.service.js';
import { SearchKeywordsService } from './search-keywords.service.js';
import { RateLimit } from '../common/rate-limit.js';

/**
 * 트래픽 분석 (#102). 사이트가 이벤트를 보내고, 관리자가 '활동 상태 보기' 앱으로 본다.
 * 원래 IP와 쿠키로 사람을 따라가지 않는다: 순방문자는 하루 해시, 나라는 Cloudflare 헤더
 */
@ApiTags('analytics')
@Controller('analytics')
export class AnalyticsController {
	constructor(
		private readonly recorder: AnalyticsRecorder,
		private readonly stats: AnalyticsStats,
		private readonly search: SearchKeywordsService,
		private readonly auth: AuthService,
		private readonly adminIps: AdminIpService
	) {}

	@Post('events')
	@RateLimit('events')
	@HttpCode(204)
	// Safari는 sendBeacon(no-cors) 응답에도 CORP를 따져서, helmet 기본값(same-origin)이면 다른 주소의 사이트가 보낸 것을 취소한다
	@Header('Cross-Origin-Resource-Policy', 'cross-origin')
	@ApiConsumes('text/plain', 'application/json')
	@ApiBody({
		schema: {
			example: {
				visitId: 'v-1a2b3c4d5e6f',
				events: [
					{ type: 'visit', path: '/memo/hello', referrer: 'github.com', device: 'desktop', language: 'ko-KR' },
					{ type: 'visit', path: '/', referrer: 'search.naver.com', searchTerm: 'macfolio', device: 'mobile' },
					{ type: 'app', app: 'memo' },
					{ type: 'item', app: 'memo', item: 'hello' },
					{ type: 'leave', duration: 95000 },
				],
			},
		},
		description:
			'navigator.sendBeacon이 text/plain(JSON 글자)으로 보낸다 (CORS 사전 요청이 없다). type: visit, app, item, link, leave. 한 번에 30개까지',
	})
	@ApiNoContentResponse({
		description:
			'받았다. 로봇, 관리자 세션, 관리자가 쓰는 IP(최근 30일 안에 관리자로 인증된 IP)에서 온 것은 저장하지 않는다',
	})
	@ApiBadRequestResponse({ description: '형식이 틀렸다 (하나라도 틀리면 전부 거절)' })
	@ApiTooManyRequestsResponse({ description: 'IP마다 1분에 30번까지' })
	async events(@Body() body: unknown, @Req() request: Request) {
		const ip = request.ip ?? '';
		// 관리자 세션이 있거나, 로그인하지 않았어도 관리자가 쓰는 IP면 세지 않는다
		const admin = await this.auth.findAdmin(request.cookies?.[SESSION_COOKIE]);
		if (admin) await this.adminIps.remember(ip);
		await this.recorder.record(body, {
			ip,
			userAgent: request.headers['user-agent'],
			country: request.headers['cf-ipcountry'],
			admin: !!admin || (await this.adminIps.isAdminIp(ip)),
		});
	}

	@Get('today')
	@ApiOkResponse({ description: '오늘(한국 시간) 순방문자 수. 누구나 본다 (1분마다 다시 센다)' })
	today() {
		return this.stats.todayVisitors();
	}

	@Get('summary')
	@ApiQuery({ name: 'from', required: false, description: 'YYYY-MM-DD (기본: to의 6일 전)' })
	@ApiQuery({ name: 'to', required: false, description: 'YYYY-MM-DD (기본: 오늘, 한국 시간)' })
	@ApiQuery({
		name: 'utm',
		required: false,
		description:
			'출처·매체·캠페인 조합 키 (예: linkedin / social / resume-2026, 빈 칸은 빈 글자). 관리자에게만 그 조합의 일별 방문(utmTrend)을 더한다. 방문자에게는 무시한다',
	})
	@ApiOkResponse({
		description:
			'일별 방문, 합계(앞의 같은 길이 기간과 비교), 들어온 곳(묶음)·앱·글·나라·기기별 표. 누구나 본다. ' +
			'관리자(scope: admin)에게만 들어온 곳의 호스트·검색어와 utm 표가 있다. 방문자에게는 1분 동안 같은 값을 준다',
	})
	@ApiBadRequestResponse({ description: '기간이 틀렸다 (1~366일), utm이 틀렸다' })
	async summary(
		@Query('from') from: unknown,
		@Query('to') to: unknown,
		@Query('utm') utm: unknown,
		@Req() request: Request
	) {
		const admin = await this.auth.findAdmin(request.cookies?.[SESSION_COOKIE]);
		return this.stats.summary(from, to, !!admin, new Date(), utm);
	}

	@Get('views')
	@ApiQuery({ name: 'app', required: true, description: '앱 이름 (memo: 블로그 글, safari: 프로젝트)' })
	@ApiOkResponse({ description: '항목마다 전체 기간 조회수 (한 방문에서 같은 글은 한 번). 누구나 본다' })
	@ApiBadRequestResponse({ description: 'app이 틀렸다' })
	views(@Query('app') app: unknown) {
		return this.stats.views(app);
	}

	@Get('search')
	@UseGuards(AdminGuard)
	@ApiCookieAuth()
	@ApiQuery({ name: 'from', required: false, description: 'YYYY-MM-DD (기본: to의 6일 전)' })
	@ApiQuery({ name: 'to', required: false, description: 'YYYY-MM-DD (기본: 오늘, 한국 시간)' })
	@ApiOkResponse({
		description:
			'Google Search Console의 검색어: 기간의 (검색어, 페이지)마다 클릭·노출과 평균 순위, 노출 많은 순 1000줄까지. ' +
			'서버에 서비스 계정(GSC_*)이 없으면 configured: false. Search Console은 2~3일 늦다',
	})
	@ApiBadRequestResponse({ description: '기간이 틀렸다 (1~366일)' })
	@ApiUnauthorizedResponse({ description: '관리자 로그인이 필요하다' })
	searchKeywords(@Query('from') from: unknown, @Query('to') to: unknown) {
		return this.search.keywords(from, to);
	}

	@Post('search/sync')
	@UseGuards(AdminGuard)
	@RateLimit('write')
	@ApiCookieAuth()
	@ApiQuery({ name: 'from', required: false, description: 'YYYY-MM-DD (기본: to의 6일 전)' })
	@ApiQuery({ name: 'to', required: false, description: 'YYYY-MM-DD (기본: 오늘, 한국 시간)' })
	@ApiOkResponse({
		description:
			'Search Console에서 지금 가져오고(서버는 6시간마다 저절로 가져온다), 그 기간의 검색어를 GET과 같은 모양으로 준다',
	})
	@ApiUnauthorizedResponse({ description: '관리자 로그인이 필요하다' })
	@HttpCode(200)
	async syncSearchKeywords(@Query('from') from: unknown, @Query('to') to: unknown) {
		await this.search.sync();
		return this.search.keywords(from, to);
	}

	@Get('live')
	@UseGuards(AdminGuard)
	@ApiCookieAuth()
	@ApiQuery({ name: 'minutes', required: false, description: '최근 몇 분 (기본 30, 최대 10080 = 가린 IP를 두는 7일)' })
	@ApiOkResponse({ description: '최근 방문: 나라·기기·들어온 곳·가린 IP(7일)와 연 앱·본 글의 흐름' })
	@ApiUnauthorizedResponse({ description: '관리자 로그인이 필요하다' })
	live(@Query('minutes') minutes: unknown) {
		return this.stats.live(minutes);
	}
}
