import { Module } from '@nestjs/common';
import { CoverClient } from './cover.client.js';
import { CoverController } from './cover.controller.js';
import { CoverService } from './cover.service.js';

@Module({
	controllers: [CoverController],
	providers: [CoverService, CoverClient],
})
export class CoverModule {}
