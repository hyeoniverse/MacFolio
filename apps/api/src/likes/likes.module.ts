import { Module } from '@nestjs/common';
import { VisitorsModule } from '../visitors/visitors.module.js';
import { LikesController } from './likes.controller.js';
import { LikesService } from './likes.service.js';

@Module({
	imports: [VisitorsModule],
	controllers: [LikesController],
	providers: [LikesService],
})
export class LikesModule {}
