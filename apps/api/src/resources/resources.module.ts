import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ResourcesController } from './resources.controller.js';
import { PROC_READER, readProc, ResourcesService } from './resources.service.js';

@Module({
	imports: [AuthModule],
	controllers: [ResourcesController],
	providers: [ResourcesService, { provide: PROC_READER, useValue: readProc }],
})
export class ResourcesModule {}
