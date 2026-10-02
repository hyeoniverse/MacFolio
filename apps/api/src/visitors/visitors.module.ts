import { Module } from '@nestjs/common';
import { VisitorsController } from './visitors.controller.js';
import { VisitorsService } from './visitors.service.js';

@Module({
	controllers: [VisitorsController],
	providers: [VisitorsService],
	exports: [VisitorsService],
})
export class VisitorsModule {}
