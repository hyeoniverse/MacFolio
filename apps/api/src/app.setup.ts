import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { SESSION_COOKIE } from './auth/session.js';
import { originMatcher } from './common/cors.js';
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
	// 허용 목록의 *는 PR 미리보기 주소처럼 한 자리만 바뀌는 주소 (common/cors.ts)
	const allowedOrigin = originMatcher(config.corsOrigins);
	app.enableCors({
		origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) =>
			callback(null, allowedOrigin(origin)),
		credentials: true,
	});
	app.use(cookieParser());
	// 분석 이벤트는 sendBeacon이 text/plain(JSON 글자)으로 보낸다 (CORS 사전 요청을 피한다)
	(app as NestExpressApplication).useBodyParser('text', { type: 'text/plain', limit: '32kb' });
	app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
	app.useGlobalFilters(new HttpErrorFilter());

	SwaggerModule.setup('docs', app, createOpenApiDocument(app));
	return app;
}

/**
 * API 문서(OpenAPI). 서버의 /docs와, 사이트의 'API 문서' 앱이 쓰는 openapi.json(openapi.test.ts가 만든다)이 같은 것을 쓴다
 */
export function createOpenApiDocument(app: INestApplication) {
	return SwaggerModule.createDocument(
		app,
		new DocumentBuilder()
			.setTitle('MacFolio API')
			.setDescription('메시지(피드백), 블로그(관리자 편집), 메일')
			.setVersion('0.1.0')
			.addCookieAuth(SESSION_COOKIE)
			.build()
	);
}
