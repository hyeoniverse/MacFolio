import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_CONFIG, type AppConfig } from './config.js';
import { ConfigModule } from './config.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { HealthModule } from './health/health.module.js';
import { AuthModule } from './auth/auth.module.js';
import { MemoModule } from './memo/memo.module.js';
import { CommentsModule } from './comments/comments.module.js';
import { PostsModule } from './posts/posts.module.js';
import { FilesModule } from './files/files.module.js';

@Module({
	imports: [
		ConfigModule,
		// 요청 제한 (IP마다 1분에): 로그인, 댓글. 경로마다 ThrottlerGuard를 걸고 해당하지 않는 제한은 건너뛴다
		ThrottlerModule.forRootAsync({
			inject: [APP_CONFIG],
			useFactory: (config: AppConfig) => [
				{ name: 'login', ttl: 60_000, limit: config.auth.loginRateLimit },
				{ name: 'comment', ttl: 60_000, limit: config.commentRateLimit },
			],
		}),
		PrismaModule,
		HealthModule,
		AuthModule,
		MemoModule,
		CommentsModule,
		PostsModule,
		FilesModule,
	],
})
export class AppModule {}
