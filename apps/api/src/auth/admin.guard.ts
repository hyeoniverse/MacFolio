import {
	type CanActivate,
	createParamDecorator,
	type ExecutionContext,
	ForbiddenException,
	Inject,
	Injectable,
	UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { cookiesAllowedFrom, originClassifier } from '../common/cors.js';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { type AdminIdentity, AuthService } from './auth.service.js';
import { SESSION_COOKIE } from './session.js';

type AdminRequest = Request & { admin?: AdminIdentity };

/**
 * 관리자만 들어올 수 있는 API에 붙인다. 화면에서 단추를 숨기는 것과 별개로, 요청마다 서버가 세션을 확인한다.
 * 브라우저가 보낸 Origin이 그대로 적은 주소가 아니면(PR 미리보기, 다른 사이트) 세션이 맞아도 거절한다:
 * 쿠키는 SameSite=Lax라 애초에 안 오지만, 브라우저 설정이나 버그로 왔을 때도 관리자 기능이 열리지 않게.
 */
@Injectable()
export class AdminGuard implements CanActivate {
	private readonly cookiesAllowed: (origin: string | undefined) => boolean;

	constructor(
		private readonly auth: AuthService,
		@Inject(APP_CONFIG) config: AppConfig
	) {
		this.cookiesAllowed = cookiesAllowedFrom(originClassifier(config.corsOrigins));
	}

	async canActivate(context: ExecutionContext) {
		const request = context.switchToHttp().getRequest<AdminRequest>();
		if (!this.cookiesAllowed(request.headers.origin))
			throw new ForbiddenException('이 주소에서는 관리자 기능을 쓸 수 없습니다.');
		const admin = await this.auth.findAdmin(request.cookies?.[SESSION_COOKIE]);
		if (!admin) throw new UnauthorizedException('관리자 로그인이 필요합니다.');
		request.admin = admin;
		return true;
	}
}

/** AdminGuard가 확인한 관리자 */
export const CurrentAdmin = createParamDecorator(
	(_data: unknown, context: ExecutionContext) => context.switchToHttp().getRequest<AdminRequest>().admin
);
