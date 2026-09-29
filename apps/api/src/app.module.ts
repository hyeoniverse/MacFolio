import { Module } from '@nestjs/common';
import { ConfigModule } from './config.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { HealthModule } from './health/health.module.js';

@Module({
	imports: [ConfigModule, PrismaModule, HealthModule],
})
export class AppModule {}
