import { Module } from '@nestjs/common';
import { SummaryClient } from './summary.client.js';
import { SummaryController } from './summary.controller.js';
import { SummaryService } from './summary.service.js';

@Module({
	controllers: [SummaryController],
	providers: [SummaryService, SummaryClient],
})
export class SummaryModule {}
