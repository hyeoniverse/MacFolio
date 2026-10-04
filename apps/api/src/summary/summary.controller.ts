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
import { SummaryService } from './summary.service.js';

/**
 * AI 요약 데모 (Safari의 HYEONIVERSE 페이지). 붙여 넣은 글을 Gemini가 한국어·영어로 한두 문장씩 요약한다.
 * IP마다 하루 SUMMARY_PER_IP_PER_DAY번, 사이트 전체 하루 SUMMARY_TOTAL_PER_DAY번까지
 */
@ApiTags('summary')
@Controller('summary')
export class SummaryController {
	constructor(private readonly service: SummaryService) {}

	@Get()
	@ApiOkResponse({
		description: '이 IP가 오늘 더 요약할 수 있는 횟수와 상한',
		schema: { example: { remaining: 3, perIp: 3, total: 50 } },
	})
	status(@Req() request: Request) {
		return this.service.status(request.ip ?? '');
	}

	@Post()
	@HttpCode(200)
	@ApiBody({ schema: { example: { text: '흩어져 있던 프로젝트와 글을 한 곳에서 보여 주는 개인 포트폴리오입니다.' } } })
	@ApiOkResponse({
		description: '두 언어 요약과 만든 공급자, 남은 횟수',
		schema: {
			example: {
				provider: 'gemini',
				ko: '프로젝트와 글을 한 곳에 모은 개인 포트폴리오입니다.',
				en: 'A personal portfolio that gathers projects and writing in one place.',
				remaining: 2,
			},
		},
	})
	@ApiBadRequestResponse({ description: '글이 비었거나 800자를 넘거나, 요약하지 않는 내용이다' })
	@ApiTooManyRequestsResponse({ description: '오늘 요약할 수 있는 횟수를 다 썼다' })
	@ApiBadGatewayResponse({ description: 'Gemini가 요약하지 못했다 (쓴 횟수는 돌려준다)' })
	summarize(@Body() body: unknown, @Req() request: Request) {
		return this.service.summarize(body, request.ip ?? '');
	}
}
