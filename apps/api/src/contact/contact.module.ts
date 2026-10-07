import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { VisitorsModule } from '../visitors/visitors.module.js';
import { ContactController } from './contact.controller.js';
import { ContactService } from './contact.service.js';

@Module({ imports: [AuthModule, VisitorsModule], controllers: [ContactController], providers: [ContactService] })
export class ContactModule {}
