import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { SESSION_COOKIE } from './auth/session.js';
import { HttpErrorFilter } from './common/http-error.filter.js';
import { APP_CONFIG, type AppConfig } from './config.js';

/**
 * 서버와 e2e 테스트가 같이 쓰는 앱 설정. 여기서 빠진 설정은 테스트에서도 빠진다.
 * - helmet: 보안 헤더
 * - CORS: 허용한 프론트엔드 주소만, 쿠키 포함 (관리자 세션)
 * - 쿠키 읽기 (관리자 세션, OAuth state)
 * - 입력 검증: DTO에 없는 필드는 거절한다
 * - 에러 응답 모양 통일, API 문서(/docs)
 */
export function configureApp(app: INestApplication) {
	const config = app.get<AppConfig>(APP_CONFIG);

	// 프록시 뒤에서 실제 IP를 읽는다 (요청 제한). 0이면 X-Forwarded-For를 믿지 않는다
	(app as NestExpressApplication).set('trust proxy', config.trustProxy);
	app.use(helmet());
	// API 문서(/docs)만 사이트 안의 'API 문서' 앱이 iframe으로 띄울 수 있게, 허용한 프론트엔드 주소에서는 넣게 한다.
	// 나머지 경로는 helmet 기본값대로 다른 사이트의 iframe에 넣을 수 없다 (클릭재킹 방지)
	(app as NestExpressApplication).use('/docs', (_request: Request, response: Response, next: NextFunction) => {
		response.removeHeader('X-Frame-Options');
		const policy = response.getHeader('Content-Security-Policy');
		if (typeof policy === 'string')
			response.setHeader(
				'Content-Security-Policy',
				policy.replace(/frame-ancestors [^;]*/, `frame-ancestors 'self' ${config.corsOrigins.join(' ')}`)
			);
		next();
	});
	app.enableCors({ origin: config.corsOrigins, credentials: true });
	app.use(cookieParser());
	app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
	app.useGlobalFilters(new HttpErrorFilter());

	const document = SwaggerModule.createDocument(
		app,
		new DocumentBuilder()
			.setTitle('MacFolio API')
			.setDescription('메시지(피드백), 블로그(관리자 편집), 메일')
			.setVersion('0.1.0')
			.addCookieAuth(SESSION_COOKIE)
			.build()
	);
	SwaggerModule.setup('docs', app, document);
	return app;
}
