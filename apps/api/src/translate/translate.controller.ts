import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import {
	ApiBadGatewayResponse,
	ApiBadRequestResponse,
	ApiBody,
	ApiOkResponse,
	ApiTags,
	ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { TranslateService } from './translate.service.js';
import { RateLimit } from '../common/rate-limit.js';

/**
 * 번역 데모 (Safari의 HYEONIVERSE 페이지). 짧은 칸(최대 3칸, 합쳐 200자)을 DeepL → Google 차례로 한 번에 번역한다.
 * IP마다 하루 TRANSLATE_PER_IP_PER_DAY번, 사이트 전체 하루 TRANSLATE_TOTAL_PER_DAY번까지
 */
@ApiTags('translate')
@Controller('translate')
export class TranslateController {
	constructor(private readonly service: TranslateService) {}

	@Get()
	@ApiOkResponse({
		description: '이 IP가 오늘 더 번역할 수 있는 횟수와 상한',
		schema: { example: { remaining: 3, perIp: 3, total: 50 } },
	})
	status(@Req() request: Request) {
		return this.service.status(request.ip ?? '');
	}

	@Post()
	@RateLimit('demo')
	@HttpCode(200)
	@ApiBody({
		schema: {
			example: {
				texts: ['혼자 설계하고 운영하는 포트폴리오 사이트', '개인 포트폴리오입니다.'],
				from: 'ko',
				to: 'en',
				skip: [],
			},
		},
	})
	@ApiOkResponse({
		description: '칸마다 번역한 글(보낸 차례 그대로)과 번역한 공급자, 공급자마다 시도한 결과, 남은 횟수',
		schema: {
			example: {
				provider: 'google',
				attempts: [
					{ provider: 'deepl', state: 'fail', reason: '사용 한도에 닿았습니다' },
					{ provider: 'google', state: 'ok' },
				],
				texts: ['A portfolio site designed and operated solo', 'A personal portfolio.'],
				remaining: 2,
			},
		},
	})
	@ApiBadRequestResponse({ description: '칸이 비었거나 3칸·200자를 넘거나, 번역하지 않는 내용이다' })
	@ApiTooManyRequestsResponse({ description: '오늘 번역할 수 있는 횟수를 다 썼다' })
	@ApiBadGatewayResponse({ description: '두 공급자 모두 번역하지 못했다 (쓴 횟수는 돌려준다)' })
	translate(@Body() body: unknown, @Req() request: Request) {
		return this.service.translate(body, request.ip ?? '');
	}
}
