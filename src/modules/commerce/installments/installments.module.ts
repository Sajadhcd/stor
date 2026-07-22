import { Module } from '@nestjs/common';
import { InstallmentsService } from './installments.service.js';
import { InstallmentsController } from './installments.controller.js';
import { AccountingModule } from '../accounting/accounting.module.js';
import { IdentityModule } from '../../identity/identity.module.js';

@Module({
  imports: [AccountingModule, IdentityModule],
  controllers: [InstallmentsController],
  providers: [InstallmentsService],
  exports: [InstallmentsService],
})
export class InstallmentsModule {}
