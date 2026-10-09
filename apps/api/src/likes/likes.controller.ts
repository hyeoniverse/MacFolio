import { Controller, Delete, Get, Param, Put, Req, Res } from '@nestjs/common';
import {
	ApiBadRequestResponse,
	ApiNotFoundResponse,
	ApiOkResponse,
	ApiTags,
	ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { VisitorsService } from '../visitors/visitors.service.js';
import { LikesService } from './likes.service.js';
import { RateLimit } from '../common/rate-limit.js';

/**
 * 블로그 글과 댓글의 좋아요. 누구나 누른다 (로그인 없이). 같은 브라우저(방문자 쿠키)는 하나에 한 번만 센다.
 * 누르기·취소는 경로·IP마다 1분에 LIKE_RATE_LIMIT번까지
 */
@ApiTags('likes')
@Controller()
export class LikesController {
	constructor(
		private readonly likes: LikesService,
		private readonly visitors: VisitorsService
	) {}

	@Get('posts/stats')
	@ApiOkResponse({
		description: '글마다 댓글 수와 좋아요 수 ({ 주소: { comments, likes } }). 하나라도 있는 글만. 인기글 순위에 쓴다',
	})
	stats() {
		return this.likes.stats();
	}

	@Get('posts/:slug/likes')
	@ApiOkResponse({ description: '좋아요 수와 이 브라우저가 눌렀는지 ({ count, liked })' })
	@ApiBadRequestResponse({ description: '글 주소가 올바르지 않다' })
	post(@Param('slug') slug: string, @Req() request: Request) {
		return this.likes.post(slug, this.visitors.peek(request));
	}

	@Put('posts/:slug/like')
	@RateLimit('like')
	@ApiOkResponse({ description: '눌렀다. 이미 눌렀으면 그대로. 처음 누르는 브라우저에는 방문자 쿠키를 준다' })
	@ApiTooManyRequestsResponse({ description: '짧은 시간에 너무 많이 눌렀다' })
	likePost(@Param('slug') slug: string, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
		return this.likes.setPost(slug, this.visitors.identify(request, response), true);
	}

	@Delete('posts/:slug/like')
	@RateLimit('like')
	@ApiOkResponse({ description: '취소했다. 누르지 않았으면 그대로' })
	unlikePost(@Param('slug') slug: string, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
		return this.likes.setPost(slug, this.visitors.identify(request, response), false);
	}

	@Put('comments/:id/like')
	@RateLimit('like')
	@ApiOkResponse({ description: '댓글에 눌렀다 ({ count, liked })' })
	@ApiNotFoundResponse({ description: '댓글이 없다' })
	likeComment(@Param('id') id: string, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
		return this.likes.setComment(id, this.visitors.identify(request, response), true);
	}

	@Delete('comments/:id/like')
	@RateLimit('like')
	@ApiOkResponse({ description: '댓글의 좋아요를 취소했다' })
	@ApiNotFoundResponse({ description: '댓글이 없다' })
	unlikeComment(@Param('id') id: string, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
		return this.likes.setComment(id, this.visitors.identify(request, response), false);
	}
}
