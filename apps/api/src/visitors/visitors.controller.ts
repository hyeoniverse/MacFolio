import { Controller, Get, Req, Res } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { VisitorsService } from './visitors.service.js';

/** 방문자 이름. 처음 온 브라우저에는 쿠키를 주고 이름을 정한다 */
@ApiTags('visitor')
@Controller('visitor')
export class VisitorsController {
	constructor(private readonly visitors: VisitorsService) {}

	@Get()
	@ApiOkResponse({ description: '이 브라우저의 이름', schema: { example: { name: '🦊 날쌘 여우' } } })
	me(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
		return { name: this.visitors.identify(request, response).name };
	}
}
