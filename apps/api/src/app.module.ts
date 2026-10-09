import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { RATE_LIMIT_NAMES, RATE_LIMIT_TTL_MS } from './common/rate-limit.js';
import { APP_CONFIG, type AppConfig } from './config.js';
import { ConfigModule } from './config.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { HealthModule } from './health/health.module.js';
import { AuthModule } from './auth/auth.module.js';
import { MemoModule } from './memo/memo.module.js';
import { CommentsModule } from './comments/comments.module.js';
import { MessagesModule } from './messages/messages.module.js';
import { VisitorsModule } from './visitors/visitors.module.js';
import { PostsModule } from './posts/posts.module.js';
import { FilesModule } from './files/files.module.js';
import { ImagesModule } from './images/images.module.js';
import { WallpapersModule } from './wallpapers/wallpapers.module.js';
import { GithubModule } from './github/github.module.js';
import { PhotosModule } from './photos/photos.module.js';
import { SpeechModule } from './speech/speech.module.js';
import { TranslateModule } from './translate/translate.module.js';
import { SummaryModule } from './summary/summary.module.js';
import { CoverModule } from './cover/cover.module.js';
import { AnalyticsModule } from './analytics/analytics.module.js';
import { ResourcesModule } from './resources/resources.module.js';
import { ContactModule } from './contact/contact.module.js';

@Module({
	imports: [
		ConfigModule,
		// 요청 제한 (IP마다 1분에). 쓰기 경로마다 @RateLimit('이름')으로 하나를 건다 (common/rate-limit.ts)
		ThrottlerModule.forRootAsync({
			inject: [APP_CONFIG],
			useFactory: (config: AppConfig) =>
				RATE_LIMIT_NAMES.map((name) => ({ name, ttl: RATE_LIMIT_TTL_MS, limit: config.rateLimits[name] })),
		}),
		PrismaModule,
		HealthModule,
		AuthModule,
		MemoModule,
		VisitorsModule,
		CommentsModule,
		MessagesModule,
		PostsModule,
		FilesModule,
		ImagesModule,
		WallpapersModule,
		GithubModule,
		PhotosModule,
		SpeechModule,
		TranslateModule,
		SummaryModule,
		CoverModule,
		AnalyticsModule,
		ResourcesModule,
		ContactModule,
	],
})
export class AppModule {}
