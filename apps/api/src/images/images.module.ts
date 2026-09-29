import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ImagesController } from './images.controller.js';
import { ImagesService } from './images.service.js';
import { StockPhotoClient } from './stock.client.js';

@Module({
	imports: [AuthModule],
	controllers: [ImagesController],
	providers: [ImagesService, StockPhotoClient],
})
export class ImagesModule {}
