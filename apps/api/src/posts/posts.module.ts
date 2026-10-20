import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PostsController } from './posts.controller.js';
import { PostCardService } from './card.service.js';
import { PostsService } from './posts.service.js';

@Module({
	imports: [AuthModule],
	controllers: [PostsController],
	providers: [PostsService, PostCardService],
})
export class PostsModule {}
