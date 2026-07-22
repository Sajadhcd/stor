import { Module } from '@nestjs/common';
import { AccountingService } from './accounting.service.js';
import { AccountingController } from './accounting.controller.js';
import { IdentityModule } from '../../identity/identity.module.js';

@Module({
  imports: [IdentityModule],
  controllers: [AccountingController],
  providers: [AccountingService],
  exports: [AccountingService],
})
export class AccountingModule {}
