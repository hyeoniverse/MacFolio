import { Global, Module } from '@nestjs/common';
import { APP_CONFIG, loadConfig } from './config.js';

/** 설정을 어디서나 주입받을 수 있게 한다 (@Inject(APP_CONFIG)) */
@Global()
@Module({
	providers: [{ provide: APP_CONFIG, useFactory: () => loadConfig() }],
	exports: [APP_CONFIG],
})
export class ConfigModule {}
