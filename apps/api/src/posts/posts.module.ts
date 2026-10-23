import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PostsController } from './posts.controller.js';
import { PostCardService } from './card.service.js';
import { PostsService } from './posts.service.js';
import { SecretPosts } from './secret-posts.service.js';

@Module({
	imports: [AuthModule],
	controllers: [PostsController],
	providers: [PostsService, PostCardService, SecretPosts],
	// 댓글·좋아요·트래픽 분석·메모 정리 내용이 방문자에게 비밀 글을 감출 때 쓴다
	exports: [SecretPosts],
})
export class PostsModule {}
