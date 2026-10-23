import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PostsModule } from '../posts/posts.module.js';
import { AnalyticsController } from './analytics.controller.js';
import { AnalyticsRecorder } from './analytics-recorder.service.js';
import { AnalyticsRollup } from './analytics-rollup.service.js';
import { AnalyticsStats } from './analytics-stats.service.js';
import { SearchKeywordsService } from './search-keywords.service.js';

@Module({
	imports: [AuthModule, PostsModule],
	controllers: [AnalyticsController],
	providers: [AnalyticsRecorder, AnalyticsRollup, AnalyticsStats, SearchKeywordsService],
})
export class AnalyticsModule {}
