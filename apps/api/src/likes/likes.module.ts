import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PostsModule } from '../posts/posts.module.js';
import { VisitorsModule } from '../visitors/visitors.module.js';
import { LikesController } from './likes.controller.js';
import { LikesService } from './likes.service.js';

@Module({
	imports: [AuthModule, PostsModule, VisitorsModule],
	controllers: [LikesController],
	providers: [LikesService],
})
export class LikesModule {}
