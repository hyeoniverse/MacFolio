import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post, Put, UseGuards } from '@nestjs/common';
import {
	ApiBadRequestResponse,
	ApiBody,
	ApiCookieAuth,
	ApiNoContentResponse,
	ApiNotFoundResponse,
	ApiOkResponse,
	ApiTags,
	ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AdminGuard, CurrentAdmin } from '../auth/admin.guard.js';
import type { AdminIdentity } from '../auth/auth.service.js';
import { SESSION_COOKIE } from '../auth/session.js';
import { PostsService } from './posts.service.js';

const POST_EXAMPLE = {
	title: '새 글',
	date: '2026-09-29',
	category: '개발기/MacFolio',
	summary: '목록에 보일 한 줄',
	body: '## 제목\n\n본문 (Markdown)',
};

/**
 * 블로그 글. 누구나 게시한 글을 읽고, 관리자만 쓰고 고치고 지운다.
 * 고치는 동안은 임시 저장에만 쓰고, 게시해야 방문자에게 보인다. 날짜가 미래면 그날부터 보인다 (예약 발행).
 * 게시할 때마다 버전을 남겨 되돌릴 수 있다.
 * 저장소의 Markdown 글은 그대로 두고, 여기 있는 글이 같은 주소의 글을 대신하거나(고친 글) 가린다(지운 글, 예약 글).
 */
@ApiTags('posts')
@Controller('posts')
export class PostsController {
	constructor(private readonly posts: PostsService) {}

	@Get()
	@ApiOkResponse({ description: '게시한 글 중 날짜가 된 것과, 저장소 글을 가릴 표시(지운 글·예약 글)' })
	list() {
		return this.posts.listPublic();
	}

	@Get('admin')
	@UseGuards(AdminGuard)
	@ApiCookieAuth(SESSION_COOKIE)
	@ApiOkResponse({ description: '모든 글: 게시한 내용, 임시 저장, 버전 수' })
	@ApiUnauthorizedResponse({ description: '관리자로 로그인하지 않았다' })
	listAdmin() {
		return this.posts.listAdmin();
	}

	@Post()
	@UseGuards(AdminGuard)
	@ApiCookieAuth(SESSION_COOKIE)
	@ApiBody({ schema: { example: POST_EXAMPLE } })
	@ApiBadRequestResponse({ description: '입력 규칙을 어겼다' })
	@ApiUnauthorizedResponse({ description: '관리자로 로그인하지 않았다' })
	create(@Body() body: unknown, @CurrentAdmin() admin: AdminIdentity) {
		return this.posts.create(body, admin.login);
	}

	@Put(':slug/draft')
	@UseGuards(AdminGuard)
	@ApiCookieAuth(SESSION_COOKIE)
	@ApiBody({ schema: { example: POST_EXAMPLE } })
	@ApiOkResponse({ description: '임시 저장했다 (방문자에게는 아직 보이지 않는다)' })
	saveDraft(@Param('slug') slug: string, @Body() body: unknown, @CurrentAdmin() admin: AdminIdentity) {
		return this.posts.saveDraft(slug, body, admin.login);
	}

	@Delete(':slug/draft')
	@UseGuards(AdminGuard)
	@ApiCookieAuth(SESSION_COOKIE)
	@ApiOkResponse({ description: '임시 저장을 버렸다. 게시한 적 없는 글이면 null (글이 사라진다)' })
	@ApiNotFoundResponse({ description: '글이 없다' })
	discardDraft(@Param('slug') slug: string) {
		return this.posts.discardDraft(slug);
	}

	@Post(':slug/publish')
	@HttpCode(200)
	@UseGuards(AdminGuard)
	@ApiCookieAuth(SESSION_COOKIE)
	@ApiBody({ schema: { example: POST_EXAMPLE } })
	@ApiOkResponse({ description: '게시했다 (날짜가 미래면 그날부터 보인다). 버전이 하나 늘어난다' })
	publish(@Param('slug') slug: string, @Body() body: unknown, @CurrentAdmin() admin: AdminIdentity) {
		return this.posts.publish(slug, body, admin.login);
	}

	@Get(':slug/revisions')
	@UseGuards(AdminGuard)
	@ApiCookieAuth(SESSION_COOKIE)
	@ApiOkResponse({ description: '게시한 버전들 (최근 것부터)' })
	revisions(@Param('slug') slug: string) {
		return this.posts.revisions(slug);
	}

	@Get(':slug/revisions/:id')
	@UseGuards(AdminGuard)
	@ApiCookieAuth(SESSION_COOKIE)
	@ApiOkResponse({ description: '버전 하나의 내용' })
	@ApiNotFoundResponse({ description: '버전이 없다' })
	revision(@Param('slug') slug: string, @Param('id', ParseIntPipe) id: number) {
		return this.posts.revision(slug, id);
	}

	@Delete(':slug')
	@HttpCode(204)
	@UseGuards(AdminGuard)
	@ApiCookieAuth(SESSION_COOKIE)
	@ApiNoContentResponse({ description: '지웠다' })
	@ApiUnauthorizedResponse({ description: '관리자로 로그인하지 않았다' })
	async remove(@Param('slug') slug: string, @CurrentAdmin() admin: AdminIdentity) {
		await this.posts.remove(slug, admin.login);
	}
}
