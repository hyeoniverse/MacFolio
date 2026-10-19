import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { FinderController } from './finder.controller.js';
import { FinderService } from './finder.service.js';

@Module({
	imports: [AuthModule],
	controllers: [FinderController],
	providers: [FinderService],
})
export class FinderModule {}
