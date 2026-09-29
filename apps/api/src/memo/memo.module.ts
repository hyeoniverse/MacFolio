import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { MemoController } from './memo.controller.js';
import { MemoService } from './memo.service.js';

@Module({
	imports: [AuthModule],
	controllers: [MemoController],
	providers: [MemoService],
})
export class MemoModule {}
