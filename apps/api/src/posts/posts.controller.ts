import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	Param,
	ParseIntPipe,
	Post,
	Put,
	Res,
	UseGuards,
} from '@nestjs/common';
import {
	ApiConflictResponse,
	ApiBadRequestResponse,
	ApiBody,
	ApiCookieAuth,
	ApiNoContentResponse,
	ApiNotFoundResponse,
	ApiOkResponse,
	ApiProduces,
	ApiTags,
	ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AdminGuard, CurrentAdmin } from '../auth/admin.guard.js';
import type { AdminIdentity } from '../auth/auth.service.js';
import { SESSION_COOKIE } from '../auth/session.js';
import type { Response } from 'express';
import { PostCardService } from './card.service.js';
import { PostsService } from './posts.service.js';
import { RateLimit } from '../common/rate-limit.js';

const POST_EXAMPLE = {
	title: '새 글',
	date: '2026-09-29',
	category: '개발기/MacFolio',
	series: '트래픽 분석',
	seriesOrder: 3,
	summary: '목록에 보일 한 줄',
	body: '## 제목\n\n본문 (Markdown)',
};

/**
 * 블로그 글. 누구나 게시한 글을 읽고, 관리자만 쓰고 고치고 지운다.
 * 고치는 동안은 임시 저장에만 쓰고, 게시해야 방문자에게 보인다. 날짜가 미래면 그날부터 보인다 (예약 발행).
 * 게시할 때마다 버전을 남겨 되돌릴 수 있다.
 * 저장소의 Markdown 글은 그대로 두고, 여기 있는 글이 같은 주소의 글을 대신하거나(고친 글) 가린다(지운 글, 예약 글).
 * 비밀 글은 관리자에게만 보인다: 방문자용 목록과 공유 카드에서 빠지고, 없는 글과 같게 답한다.
 */
@ApiTags('posts')
@Controller('posts')
export class PostsController {
	constructor(
		private readonly posts: PostsService,
		private readonly cards: PostCardService
	) {}

	@Get()
	@ApiOkResponse({
		description:
			'게시한 글 중 날짜가 된 것과, 저장소 글을 가릴 표시(지운 글·예약 글). 비밀 글은 관리자 세션이어도 넣지 않는다 (관리자는 /posts/admin)',
	})
	list() {
		return this.posts.listPublic();
	}

	@Get(':slug/og.png')
	@ApiProduces('image/png')
	@ApiOkResponse({
		description:
			'공유 카드 그림 (1200×630 PNG, 글 제목으로 그린다). 사이트의 og:image가 쓴다. 주소에 붙는 ?v=는 캐시를 바꾸려는 값이라 보지 않는다',
	})
	@ApiNotFoundResponse({ description: '방문자에게 보이는 글이 없다 (임시 저장, 지운 글, 예약 글, 비밀 글 포함)' })
	async card(@Param('slug') slug: string, @Res() res: Response) {
		const png = await this.cards.png(slug);
		res.set({
			'Content-Type': 'image/png',
			// 카카오톡·X 등 다른 곳에서 불러간다 (helmet 기본값은 same-origin)
			'Cross-Origin-Resource-Policy': 'cross-origin',
			'X-Content-Type-Options': 'nosniff',
			// 제목이 바뀌면 사이트가 ?v=를 바꿔 새 주소로 부른다. 같은 주소는 하루 동안 Cloudflare와 브라우저가 들고 있는다
			'Cache-Control': 'public, max-age=86400',
		});
		res.send(png);
	}

	@Get('admin')
	@UseGuards(AdminGuard)
	@ApiCookieAuth(SESSION_COOKIE)
	@ApiOkResponse({ description: '모든 글: 게시한 내용, 임시 저장, 버전 수, 비밀 글 여부' })
	@ApiUnauthorizedResponse({ description: '관리자로 로그인하지 않았다' })
	listAdmin() {
		return this.posts.listAdmin();
	}

	@Post()
	@UseGuards(AdminGuard)
	@RateLimit('write')
	@ApiCookieAuth(SESSION_COOKIE)
	@ApiBody({ schema: { example: POST_EXAMPLE } })
	@ApiBadRequestResponse({ description: '입력 규칙을 어겼다' })
	@ApiUnauthorizedResponse({ description: '관리자로 로그인하지 않았다' })
	create(@Body() body: unknown, @CurrentAdmin() admin: AdminIdentity) {
		return this.posts.create(body, admin.login);
	}

	@Put(':slug/draft')
	@UseGuards(AdminGuard)
	@RateLimit('write')
	@ApiCookieAuth(SESSION_COOKIE)
	@ApiBody({ schema: { example: POST_EXAMPLE } })
	@ApiOkResponse({ description: '임시 저장했다 (방문자에게는 아직 보이지 않는다)' })
	saveDraft(@Param('slug') slug: string, @Body() body: unknown, @CurrentAdmin() admin: AdminIdentity) {
		return this.posts.saveDraft(slug, body, admin.login);
	}

	@Delete(':slug/draft')
	@UseGuards(AdminGuard)
	@RateLimit('write')
	@ApiCookieAuth(SESSION_COOKIE)
	@ApiOkResponse({ description: '임시 저장을 버렸다. 게시한 적 없는 글이면 null (글이 사라진다)' })
	@ApiNotFoundResponse({ description: '글이 없다' })
	discardDraft(@Param('slug') slug: string) {
		return this.posts.discardDraft(slug);
	}

	@Post(':slug/publish')
	@HttpCode(200)
	@UseGuards(AdminGuard)
	@RateLimit('write')
	@ApiCookieAuth(SESSION_COOKIE)
	@ApiBody({ schema: { example: POST_EXAMPLE } })
	@ApiOkResponse({ description: '게시했다 (날짜가 미래면 그날부터 보인다). 버전이 하나 늘어난다' })
	publish(@Param('slug') slug: string, @Body() body: unknown, @CurrentAdmin() admin: AdminIdentity) {
		return this.posts.publish(slug, body, admin.login);
	}

	@Put(':slug/secret')
	@UseGuards(AdminGuard)
	@RateLimit('write')
	@ApiCookieAuth(SESSION_COOKIE)
	@ApiBody({ schema: { example: { secret: true } } })
	@ApiOkResponse({
		description:
			'비밀 글로 지정했다(secret: true) 또는 풀었다. 비밀 글은 관리자에게만 보인다: 방문자용 목록·공유 카드·댓글·좋아요·조회수·메모 정리 내용에서 빠진다',
	})
	@ApiBadRequestResponse({ description: 'secret이 true나 false가 아니다' })
	@ApiNotFoundResponse({ description: "서버에 없는 글이다 ('최근 삭제된 항목'의 글 포함)" })
	@ApiConflictResponse({ description: '잠긴 메모다' })
	@ApiUnauthorizedResponse({ description: '관리자로 로그인하지 않았다' })
	setSecret(@Param('slug') slug: string, @Body() body: unknown, @CurrentAdmin() admin: AdminIdentity) {
		return this.posts.setSecret(slug, body, admin.login);
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

	@Post(':slug/restore')
	@HttpCode(200)
	@UseGuards(AdminGuard)
	@RateLimit('write')
	@ApiCookieAuth(SESSION_COOKIE)
	@ApiOkResponse({ description: '되살렸다. 서버에 내용이 없던 저장소 글이면 null (파일이 다시 보인다)' })
	@ApiNotFoundResponse({ description: "'최근 삭제된 항목'에 없다" })
	restore(@Param('slug') slug: string) {
		return this.posts.restore(slug);
	}

	@Delete(':slug/permanent')
	@HttpCode(204)
	@UseGuards(AdminGuard)
	@RateLimit('write')
	@ApiCookieAuth(SESSION_COOKIE)
	@ApiNoContentResponse({ description: '영구히 지웠다 (내용·버전을 지우고, 저장소 글을 가리는 표시만 남긴다)' })
	@ApiNotFoundResponse({ description: "'최근 삭제된 항목'에 없다" })
	async purge(@Param('slug') slug: string, @CurrentAdmin() admin: AdminIdentity) {
		await this.posts.purge(slug, admin.login);
	}

	@Delete(':slug/server-copy')
	@HttpCode(204)
	@UseGuards(AdminGuard)
	@RateLimit('write')
	@ApiCookieAuth(SESSION_COOKIE)
	@ApiNoContentResponse({
		description:
			'저장소 글로 되돌렸다: 서버의 게시 내용·임시 저장·버전을 지워 저장소의 Markdown 파일이 보인다. 저장소에 없는 글이면 글이 사라진다',
	})
	@ApiNotFoundResponse({ description: '서버에 없는 글이다' })
	@ApiConflictResponse({ description: '잠긴 메모다' })
	async revertToRepository(@Param('slug') slug: string) {
		await this.posts.revertToRepository(slug);
	}

	@Delete(':slug')
	@HttpCode(204)
	@UseGuards(AdminGuard)
	@RateLimit('write')
	@ApiCookieAuth(SESSION_COOKIE)
	@ApiNoContentResponse({ description: "지웠다 ('최근 삭제된 항목'으로, 30일 동안 되살릴 수 있다)" })
	@ApiUnauthorizedResponse({ description: '관리자로 로그인하지 않았다' })
	async remove(@Param('slug') slug: string, @CurrentAdmin() admin: AdminIdentity) {
		await this.posts.remove(slug, admin.login);
	}
}
