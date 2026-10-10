import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { SecurityController } from './security.controller.js';
import { SecurityService } from './security.service.js';

/** 메일·댓글·메시지가 함께 쓰는 사람 확인 설정 (어느 모듈에서나 SecurityService를 받는다) */
@Global()
@Module({
	imports: [AuthModule],
	controllers: [SecurityController],
	providers: [SecurityService],
	exports: [SecurityService],
})
export class SecurityModule {}
