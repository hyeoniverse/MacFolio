import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { GithubApiClient } from './github-api.client.js';
import { GithubController } from './github.controller.js';
import { GithubService } from './github.service.js';
import { LanguagesService } from './languages.service.js';

@Module({
	imports: [AuthModule],
	controllers: [GithubController],
	providers: [GithubService, LanguagesService, GithubApiClient],
})
export class GithubModule {}
