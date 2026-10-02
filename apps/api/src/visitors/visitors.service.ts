import { Inject, Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { randomToken } from '../auth/session.js';
import { hashVisitor, VISITOR_COOKIE, VISITOR_TOKEN, VISITOR_TTL_MS, visitorName } from './visitor.js';

/** 요청을 보낸 방문자. 토큰 원문은 쿠키에만 있고, 서버는 해시만 다룬다 */
export interface Visitor {
	/** DB에 두는 값 (토큰의 HMAC) */
	hash: string;
	/** 화면에 보이는 이름 (예: 🦊 날쌘 여우) */
	name: string;
}

@Injectable()
export class VisitorsService {
	constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

	private toVisitor(token: string): Visitor {
		const hash = hashVisitor(token, this.config.ipHashSecret);
		return { hash, name: visitorName(hash) };
	}

	/** 쿠키가 있으면 그 방문자 (읽기 전용 요청: 쿠키를 새로 주지 않는다) */
	peek(request: Request): Visitor | null {
		const token = request.cookies?.[VISITOR_COOKIE];
		return typeof token === 'string' && VISITOR_TOKEN.test(token) ? this.toVisitor(token) : null;
	}

	/** 쿠키가 없으면 새로 주고, 있으면 유지 시간을 늘린다 (쓰기 요청, 이름 묻기) */
	identify(request: Request, response: Response): Visitor {
		const saved = request.cookies?.[VISITOR_COOKIE];
		const token = typeof saved === 'string' && VISITOR_TOKEN.test(saved) ? saved : randomToken(24);
		response.cookie(VISITOR_COOKIE, token, {
			httpOnly: true,
			sameSite: 'lax',
			secure: this.config.auth.secureCookies,
			maxAge: VISITOR_TTL_MS,
			path: '/',
		});
		return this.toVisitor(token);
	}
}
