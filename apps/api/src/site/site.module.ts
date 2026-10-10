import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { SiteController } from './site.controller.js';
import { SiteService } from './site.service.js';

/** 사이트 콘텐츠 (프로필). 댓글·메시지가 관리자 이름을 여기서 읽는다 */
@Global()
@Module({
	imports: [AuthModule],
	controllers: [SiteController],
	providers: [SiteService],
	exports: [SiteService],
})
export class SiteModule {}
