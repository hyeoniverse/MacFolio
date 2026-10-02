import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { WallpapersController } from './wallpapers.controller.js';
import { WallpapersService } from './wallpapers.service.js';

@Module({
	imports: [AuthModule],
	controllers: [WallpapersController],
	providers: [WallpapersService],
})
export class WallpapersModule {}
