import { Module } from '@nestjs/common';
import { SpeechClient } from './speech.client.js';
import { SpeechController } from './speech.controller.js';
import { SpeechService } from './speech.service.js';

@Module({
	controllers: [SpeechController],
	providers: [SpeechService, SpeechClient],
})
export class SpeechModule {}
