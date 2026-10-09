import { Body, Controller, Get, HttpCode, Post, Query, Req, UseGuards } from '@nestjs/common';
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
import { AuthService } from '../auth/auth.service.js';
import { SESSION_COOKIE } from '../auth/session.js';
import { AnalyticsService } from './analytics.service.js';
import { RateLimit } from '../common/rate-limit.js';

/**
 * 트래픽 분석 (#102). 사이트가 이벤트를 보내고, 관리자가 '활동 상태 보기' 앱으로 본다.
 * 원래 IP와 쿠키로 사람을 따라가지 않는다: 순방문자는 하루 해시, 나라는 Cloudflare 헤더
 */
@ApiTags('analytics')
@Controller('analytics')
export class AnalyticsController {
	constructor(
		private readonly analytics: AnalyticsService,
		private readonly auth: AuthService
	) {}

	@Post('events')
	@RateLimit('events')
	@HttpCode(204)
	@ApiConsumes('text/plain', 'application/json')
	@ApiBody({
		schema: {
			example: {
				visitId: 'v-1a2b3c4d5e6f',
				events: [
					{ type: 'visit', path: '/memo/hello', referrer: 'github.com', device: 'desktop', language: 'ko-KR' },
					{ type: 'app', app: 'memo' },
					{ type: 'item', app: 'memo', item: 'hello' },
					{ type: 'leave', duration: 95000 },
				],
			},
		},
		description:
			'navigator.sendBeacon이 text/plain(JSON 글자)으로 보낸다 (CORS 사전 요청이 없다). type: visit, app, item, link, leave. 한 번에 30개까지',
	})
	@ApiNoContentResponse({ description: '받았다. 로봇과 관리자 세션은 저장하지 않는다' })
	@ApiBadRequestResponse({ description: '형식이 틀렸다 (하나라도 틀리면 전부 거절)' })
	@ApiTooManyRequestsResponse({ description: 'IP마다 1분에 30번까지' })
	async events(@Body() body: unknown, @Req() request: Request) {
		const admin = await this.auth.findAdmin(request.cookies?.[SESSION_COOKIE]);
		await this.analytics.record(body, {
			ip: request.ip ?? '',
			userAgent: request.headers['user-agent'],
			country: request.headers['cf-ipcountry'],
			admin: !!admin,
		});
	}

	@Get('today')
	@ApiOkResponse({ description: '오늘(한국 시간) 순방문자 수. 누구나 본다 (1분마다 다시 센다)' })
	today() {
		return this.analytics.todayVisitors();
	}

	@Get('summary')
	@ApiQuery({ name: 'from', required: false, description: 'YYYY-MM-DD (기본: to의 6일 전)' })
	@ApiQuery({ name: 'to', required: false, description: 'YYYY-MM-DD (기본: 오늘, 한국 시간)' })
	@ApiOkResponse({
		description:
			'일별 방문, 합계(앞의 같은 길이 기간과 비교), 들어온 곳(묶음)·앱·글·나라·기기별 표. 누구나 본다. ' +
			'관리자(scope: admin)에게만 들어온 곳의 호스트와 utm 표가 있다. 방문자에게는 1분 동안 같은 값을 준다',
	})
	@ApiBadRequestResponse({ description: '기간이 틀렸다 (1~366일)' })
	async summary(@Query('from') from: unknown, @Query('to') to: unknown, @Req() request: Request) {
		const admin = await this.auth.findAdmin(request.cookies?.[SESSION_COOKIE]);
		return this.analytics.summary(from, to, !!admin);
	}

	@Get('views')
	@ApiQuery({ name: 'app', required: true, description: '앱 이름 (memo: 블로그 글, safari: 프로젝트)' })
	@ApiOkResponse({ description: '항목마다 전체 기간 조회수 (한 방문에서 같은 글은 한 번). 누구나 본다' })
	@ApiBadRequestResponse({ description: 'app이 틀렸다' })
	views(@Query('app') app: unknown) {
		return this.analytics.views(app);
	}

	@Get('live')
	@UseGuards(AdminGuard)
	@ApiCookieAuth()
	@ApiQuery({ name: 'minutes', required: false, description: '최근 몇 분 (기본 30, 최대 1440)' })
	@ApiOkResponse({ description: '최근 방문: 나라·기기·들어온 곳·가린 IP(7일)와 연 앱·본 글의 흐름' })
	@ApiUnauthorizedResponse({ description: '관리자 로그인이 필요하다' })
	live(@Query('minutes') minutes: unknown) {
		return this.analytics.live(minutes);
	}
}
