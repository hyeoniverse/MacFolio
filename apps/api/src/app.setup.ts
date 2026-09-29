import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
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

	app.use(helmet());
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
