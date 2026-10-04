import { Module } from '@nestjs/common';
import { TranslateClient } from './translate.client.js';
import { TranslateController } from './translate.controller.js';
import { TranslateService } from './translate.service.js';

@Module({
	controllers: [TranslateController],
	providers: [TranslateService, TranslateClient],
})
export class TranslateModule {}
