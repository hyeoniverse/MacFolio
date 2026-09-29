import {
	type CanActivate,
	createParamDecorator,
	type ExecutionContext,
	Injectable,
	UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { type AdminIdentity, AuthService } from './auth.service.js';
import { SESSION_COOKIE } from './session.js';

type AdminRequest = Request & { admin?: AdminIdentity };

/**
 * 관리자만 들어올 수 있는 API에 붙인다. 화면에서 단추를 숨기는 것과 별개로, 요청마다 서버가 세션을 확인한다.
 */
@Injectable()
export class AdminGuard implements CanActivate {
	constructor(private readonly auth: AuthService) {}

	async canActivate(context: ExecutionContext) {
		const request = context.switchToHttp().getRequest<AdminRequest>();
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
