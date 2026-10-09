import {
	BadRequestException,
	Controller,
	Get,
	HttpCode,
	Inject,
	Post,
	Query,
	Req,
	Res,
	ServiceUnavailableException,
	UseGuards,
} from '@nestjs/common';
import {
	ApiCookieAuth,
	ApiFoundResponse,
	ApiNoContentResponse,
	ApiOkResponse,
	ApiProperty,
	ApiTags,
	ApiTooManyRequestsResponse,
	ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SkipThrottle, ThrottlerGuard } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { AdminGuard, CurrentAdmin } from './admin.guard.js';
import { type AdminIdentity, AuthService } from './auth.service.js';
import { safeEqual, SESSION_COOKIE, SESSION_TTL_MS, STATE_COOKIE, STATE_TTL_MS, randomToken } from './session.js';

export class AdminResponse {
	@ApiProperty({ example: 'hyeoniverse' })
	login!: string;

	@ApiProperty({ example: '2026-10-02T10:03:00.000Z', description: '이 세션으로 로그인한 때 (ISO 8601)' })
	signedInAt!: string;

	@ApiProperty({ example: '2026-10-02T22:03:00.000Z', description: '이 세션이 끝나는 때 (ISO 8601)' })
	expiresAt!: string;
}

/**
 * 관리자 로그인 (GitHub OAuth).
 * 1. /auth/github → GitHub 로그인 화면 (state를 쿠키에 기억)
 * 2. GitHub → /auth/github/callback → state가 같은지 보고 세션 쿠키를 준 뒤 프론트엔드로 돌아간다
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
	constructor(
		private readonly auth: AuthService,
		@Inject(APP_CONFIG) private readonly config: AppConfig
	) {}

	/** 쿠키 공통 설정. 자바스크립트에서 읽을 수 없고(httpOnly), 다른 사이트에서 보낸 요청에는 붙지 않는다(Lax) */
	private cookie(maxAge: number, path = '/'): CookieOptions {
		return { httpOnly: true, sameSite: 'lax', secure: this.config.auth.secureCookies, maxAge, path };
	}

	/** 로그인을 마치고 프론트엔드로 돌아간다. 결과는 쿼리로 알린다 (signed-in, denied, cancelled) */
	private backToFrontend(response: Response, result: string) {
		const url = new URL(this.config.frontendUrl);
		url.searchParams.set('admin', result);
		response.redirect(302, url.toString());
	}

	@Get('github')
	@UseGuards(ThrottlerGuard)
	@SkipThrottle({ comment: true, like: true })
	@ApiTooManyRequestsResponse({ description: '짧은 시간에 너무 많이 시도했다' })
	@ApiFoundResponse({ description: 'GitHub 로그인 화면으로 보낸다' })
	github(@Res() response: Response) {
		if (!this.auth.enabled) throw new ServiceUnavailableException('관리자 로그인이 설정되지 않았습니다.');
		// 로그인을 시작한 브라우저만 콜백을 마칠 수 있게 한다 (CSRF 방지)
		const state = randomToken(16);
		response.cookie(STATE_COOKIE, state, this.cookie(STATE_TTL_MS, '/auth/github'));
		response.redirect(302, this.auth.authorizeUrl(state));
	}

	@Get('github/callback')
	@UseGuards(ThrottlerGuard)
	@SkipThrottle({ comment: true, like: true })
	@ApiTooManyRequestsResponse({ description: '짧은 시간에 너무 많이 시도했다' })
	@ApiFoundResponse({ description: '프론트엔드로 돌아간다 (?admin=signed-in | denied | cancelled)' })
	async callback(
		@Req() request: Request,
		@Res() response: Response,
		@Query('code') code?: string,
		@Query('state') state?: string,
		@Query('error') error?: string
	) {
		const expected = request.cookies?.[STATE_COOKIE] as string | undefined;
		response.clearCookie(STATE_COOKIE, { path: '/auth/github' });
		// GitHub 화면에서 취소했다
		if (error) return this.backToFrontend(response, 'cancelled');
		if (!safeEqual(state, expected) || !code) throw new BadRequestException('로그인 요청이 올바르지 않습니다.');

		const session = await this.auth.signIn(code);
		if (!session) return this.backToFrontend(response, 'denied');
		response.cookie(SESSION_COOKIE, session.token, this.cookie(SESSION_TTL_MS));
		this.backToFrontend(response, 'signed-in');
	}

	@Get('me')
	@UseGuards(AdminGuard)
	@ApiCookieAuth(SESSION_COOKIE)
	@ApiOkResponse({ type: AdminResponse })
	@ApiUnauthorizedResponse({ description: '관리자로 로그인하지 않았다' })
	me(@CurrentAdmin() admin: AdminIdentity): AdminResponse {
		return {
			login: admin.login,
			signedInAt: admin.signedInAt.toISOString(),
			expiresAt: admin.expiresAt.toISOString(),
		};
	}

	@Post('logout')
	@HttpCode(204)
	@ApiNoContentResponse({ description: '세션을 지웠다 (로그인하지 않았어도 204)' })
	async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
		await this.auth.signOut(request.cookies?.[SESSION_COOKIE]);
		response.clearCookie(SESSION_COOKIE, { path: '/' });
	}
}
