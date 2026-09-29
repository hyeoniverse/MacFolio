import { Module } from '@nestjs/common';
import { AdminGuard } from './admin.guard.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { GithubClient } from './github.client.js';

@Module({
	controllers: [AuthController],
	providers: [AuthService, GithubClient, AdminGuard],
	exports: [AuthService, AdminGuard],
})
export class AuthModule {}
