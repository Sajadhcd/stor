import { Module } from '@nestjs/common';
import { TenantsService } from './tenants/tenants.service.js';
import { StoresService } from './stores/stores.service.js';
import { StoresController } from './stores/stores.controller.js';
import { IdentityModule } from '../identity/identity.module.js';

@Module({
  imports: [IdentityModule],
  controllers: [StoresController],
  providers: [TenantsService, StoresService],
  exports: [TenantsService, StoresService],
})
export class SaasCoreModule {}
