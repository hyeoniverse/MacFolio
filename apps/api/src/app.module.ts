import { Module } from '@nestjs/common';
import { ConfigModule } from './config.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { HealthModule } from './health/health.module.js';
import { AuthModule } from './auth/auth.module.js';

@Module({
	imports: [ConfigModule, PrismaModule, HealthModule, AuthModule],
})
export class AppModule {}
