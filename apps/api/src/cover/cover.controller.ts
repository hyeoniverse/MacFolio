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
import { CoverService } from './cover.service.js';

/**
 * AI 커버 데모 (Safari의 HYEONIVERSE 페이지). 제목으로 Hugging Face FLUX가 16:9 커버를 그린다.
 * IP마다 하루 COVER_PER_IP_PER_DAY번, 사이트 전체 하루 COVER_TOTAL_PER_DAY번까지
 */
@ApiTags('cover')
@Controller('cover')
export class CoverController {
	constructor(private readonly service: CoverService) {}

	@Get()
	@ApiOkResponse({
		description: '이 IP가 오늘 더 그릴 수 있는 횟수와 상한',
		schema: { example: { remaining: 1, perIp: 1, total: 5 } },
	})
	status(@Req() request: Request) {
		return this.service.status(request.ip ?? '');
	}

	@Post()
	@HttpCode(200)
	@ApiBody({ schema: { example: { title: '혼자 만드는 포트폴리오', style: 'watercolor', skip: [] } } })
	@ApiOkResponse({
		description: '그린 그림(base64)과 종류, 그린 공급자, 공급자마다 시도한 결과, 남은 횟수',
		schema: {
			example: {
				provider: 'huggingface',
				attempts: [{ provider: 'huggingface', state: 'ok' }],
				image: '/9j/4AAQ…',
				mime: 'image/jpeg',
				remaining: 0,
			},
		},
	})
	@ApiBadRequestResponse({ description: '제목이 비었거나 60자를 넘거나, 그리지 않는 내용이다' })
	@ApiTooManyRequestsResponse({ description: '오늘 그릴 수 있는 횟수를 다 썼다' })
	@ApiBadGatewayResponse({ description: '두 공급자 모두 그리지 못했다 (쓴 횟수는 돌려준다)' })
	generate(@Body() body: unknown, @Req() request: Request) {
		return this.service.generate(body, request.ip ?? '');
	}
}
