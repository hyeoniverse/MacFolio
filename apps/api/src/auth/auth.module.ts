import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { AdminGuard } from './admin.guard.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { GithubClient } from './github.client.js';

@Module({
	imports: [
		// 로그인 요청은 IP마다 1분에 AUTH_RATE_LIMIT번까지 (자동화된 시도를 늦춘다). 컨트롤러에서 로그인 경로에만 건다
		ThrottlerModule.forRootAsync({
			inject: [APP_CONFIG],
			useFactory: (config: AppConfig) => [{ name: 'login', ttl: 60_000, limit: config.auth.loginRateLimit }],
		}),
	],
	controllers: [AuthController],
	providers: [AuthService, GithubClient, AdminGuard],
	exports: [AuthService, AdminGuard],
})
export class AuthModule {}
