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
import { SpeechService } from './speech.service.js';
import { RateLimit } from '../common/rate-limit.js';

/**
 * 음성 만들기 데모 (Safari의 HYEONIVERSE 페이지). 짧은 글을 Fish → Google → Edge 차례로 MP3로 만든다.
 * IP마다 하루 SPEECH_PER_IP_PER_DAY번, 사이트 전체 하루 SPEECH_TOTAL_PER_DAY번까지
 */
@ApiTags('speech')
@Controller('speech')
export class SpeechController {
	constructor(private readonly speech: SpeechService) {}

	@Get()
	@ApiOkResponse({
		description: '이 IP가 오늘 더 만들 수 있는 횟수와 상한',
		schema: { example: { remaining: 3, perIp: 3, total: 50 } },
	})
	status(@Req() request: Request) {
		return this.speech.status(request.ip ?? '');
	}

	@Post()
	@RateLimit('demo')
	@HttpCode(200)
	@ApiBody({ schema: { example: { text: '안녕하세요, 방금 만든 목소리입니다.', lang: 'ko', skip: ['fish'] } } })
	@ApiOkResponse({
		description: '만든 MP3(base64)와 만든 공급자, 공급자마다 시도한 결과, 남은 횟수',
		schema: {
			example: {
				provider: 'google',
				attempts: [
					{ provider: 'fish', state: 'skip', reason: '막아 둠' },
					{ provider: 'google', state: 'ok' },
				],
				audio: '//uQx…',
				remaining: 2,
			},
		},
	})
	@ApiBadRequestResponse({ description: '글이 비었거나 80자를 넘거나, 읽지 않는 내용이다' })
	@ApiTooManyRequestsResponse({ description: '오늘 만들 수 있는 횟수를 다 썼다' })
	@ApiBadGatewayResponse({ description: '세 공급자 모두 만들지 못했다 (쓴 횟수는 돌려준다)' })
	synthesize(@Body() body: unknown, @Req() request: Request) {
		return this.speech.synthesize(body, request.ip ?? '');
	}
}
