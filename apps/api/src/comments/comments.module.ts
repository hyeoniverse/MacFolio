import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { VisitorsModule } from '../visitors/visitors.module.js';
import { CommentsController } from './comments.controller.js';
import { CommentsService } from './comments.service.js';

@Module({
	imports: [AuthModule, VisitorsModule],
	controllers: [CommentsController],
	providers: [CommentsService],
})
export class CommentsModule {}
